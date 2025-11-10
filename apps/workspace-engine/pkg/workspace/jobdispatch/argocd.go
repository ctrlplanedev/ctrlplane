package jobdispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	applicationpkg "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
)

type argoCDAgentConfig struct {
	ServerUrl   string `json:"serverUrl"`
	ApiKey      string `json:"apiKey"`
	Application string `json:"application"`
	Template    string `json:"template"`
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

	var spec v1alpha1.ApplicationSpec
	if err := json.Unmarshal(buf.Bytes(), &spec); err != nil {
		return fmt.Errorf("failed to parse template output as ArgoCD Application spec: %w", err)
	}

	_, err = appClient.UpdateSpec(ctx, &applicationpkg.ApplicationUpdateSpecRequest{
		Name: &cfg.Application,
		Spec: &spec,
	})
	if err != nil {
		return fmt.Errorf("failed to update ArgoCD application spec: %w", err)
	}

	return nil
}
