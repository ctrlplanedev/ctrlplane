package jobdispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"text/template"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	applicationpkg "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/charmbracelet/log"
)

type argoCDAgentConfig struct {
	ServerUrl string `json:"serverUrl"`
	ApiKey    string `json:"apiKey"`
	Template  string `json:"template"`
}

type ArgoCDDispatcher struct {
	store *store.Store
}

func NewArgoCDDispatcher(store *store.Store) *ArgoCDDispatcher {
	return &ArgoCDDispatcher{
		store: store,
	}
}

func (d *ArgoCDDispatcher) parseConfig(job *oapi.Job) (argoCDAgentConfig, error) {
	var parsed argoCDAgentConfig
	rawCfg, err := json.Marshal(job.JobAgentConfig)
	if err != nil {
		return argoCDAgentConfig{}, err
	}
	if err := json.Unmarshal(rawCfg, &parsed); err != nil {
		return argoCDAgentConfig{}, err
	}
	if parsed.ServerUrl == "" {
		return argoCDAgentConfig{}, fmt.Errorf("missing required ArgoCD job config: serverUrl")
	}
	if parsed.ApiKey == "" {
		return argoCDAgentConfig{}, fmt.Errorf("missing required ArgoCD job config: apiKey")
	}
	if parsed.Template == "" {
		return argoCDAgentConfig{}, fmt.Errorf("missing required ArgoCD job config: template")
	}
	return parsed, nil
}

func (d *ArgoCDDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	jobWithRelease, err := d.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		return err
	}

	cfg, err := d.parseConfig(job)
	if err != nil {
		return err
	}

	t, err := template.New("argoCDAgentConfig").Parse(cfg.Template)
	if err != nil {
		return fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, jobWithRelease); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: cfg.ServerUrl,
		AuthToken:  cfg.ApiKey,
	})
	if err != nil {
		return fmt.Errorf("failed to create ArgoCD client: %w", err)
	}

	closer, appClient, err := client.NewApplicationClient()
	if err != nil {
		return fmt.Errorf("failed to create ArgoCD application client: %w", err)
	}
	defer closer.Close()

	var app v1alpha1.Application
	if err := json.Unmarshal(buf.Bytes(), &app); err != nil {
		return fmt.Errorf("failed to parse template output as ArgoCD Application: %w", err)
	}

	if app.ObjectMeta.Name == "" {
		return fmt.Errorf("application name is required in metadata.name")
	}

	upsert := true
	_, err = appClient.Create(ctx, &applicationpkg.ApplicationCreateRequest{
		Application: &app,
		Upsert:      &upsert,
	})
	if err != nil {
		return fmt.Errorf("failed to create ArgoCD application: %w", err)
	}

	// Start a verification to check ArgoCD Application health in Argo terms (Healthy + Synced).
	// Best-effort: log error but do not fail the dispatch.
	if err := d.startArgoApplicationVerification(ctx, jobWithRelease, cfg, app.ObjectMeta.Name); err != nil {
		log.Error("Failed to start ArgoCD application verification",
			"error", err,
			"job_id", job.Id,
			"server_url", cfg.ServerUrl)
	}
	return nil
}

// startArgoApplicationVerification creates a verification that checks the created ArgoCD Application's health and sync.
// It queries the ArgoCD API for the application and passes when health=Healthy and sync=Synced.
func (d *ArgoCDDispatcher) startArgoApplicationVerification(
	ctx context.Context,
	jobWithRelease *oapi.JobWithRelease,
	cfg argoCDAgentConfig,
	appName string,
) error {
	// Query the specific ArgoCD Application
	appURL := fmt.Sprintf("%s/api/v1/applications/%s", cfg.ServerUrl, appName)

	method := oapi.GET
	timeout := "5s"
	headers := map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", cfg.ApiKey),
	}

	provider := oapi.MetricProvider{}
	provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     appURL,
		Method:  &method,
		Timeout: &timeout,
		Headers: &headers,
		Type:    oapi.Http,
	})

	failureLimit := 2
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:     "argocd-application-health",
			Interval: "30s", // check every 30s
			Count:    10,    // take up to 10 measurements
			// Require ArgoCD application to be Healthy and Synced
			SuccessCondition: "result.statusCode == 200 && result.body.status.health.status == 'Healthy' && result.body.status.sync.status == 'Synced'",
			FailureLimit:     &failureLimit, // early stop on 2 failures
			Provider:         provider,
		},
	}

	// Create a verification manager on-demand and start verification for this release.
	manager := verification.NewManager(d.store)
	return manager.StartVerification(ctx, &jobWithRelease.Release, metrics)
}
