package jobdispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"text/template"
	"time"
	"workspace-engine/pkg/config"

	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	applicationpkg "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

var argoCDTracer = otel.Tracer("ArgoCDDispatcher")

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

func getK8sCompatibleName(name string) string {
	cleaned := strings.ReplaceAll(name, "/", "-")
	cleaned = strings.ReplaceAll(cleaned, ":", "-")
	return cleaned
}

func (d *ArgoCDDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	ctx, span := argoCDTracer.Start(ctx, "DispatchJob")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("release.id", job.ReleaseId),
	)

	jobWithRelease, err := d.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get job with release")
		return err
	}

	templatableJobWithRelease, err := jobWithRelease.ToTemplatable()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get templatable job")
		return fmt.Errorf("failed to get templatable job with release: %w", err)
	}

	cfg, err := d.parseConfig(job)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse config")
		return err
	}

	span.SetAttributes(attribute.String("argocd.server_url", cfg.ServerUrl))

	t, err := template.New("argoCDAgentConfig").Parse(cfg.Template)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse template")
		return fmt.Errorf("failed to parse template: %w", err)
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, templatableJobWithRelease); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to execute template")
		return fmt.Errorf("failed to execute template: %w", err)
	}

	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: cfg.ServerUrl,
		AuthToken:  cfg.ApiKey,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create ArgoCD client")
		return fmt.Errorf("failed to create ArgoCD client: %w", err)
	}

	closer, appClient, err := client.NewApplicationClient()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create application client")
		return fmt.Errorf("failed to create ArgoCD application client: %w", err)
	}
	defer closer.Close()

	var app v1alpha1.Application
	if err := json.Unmarshal(buf.Bytes(), &app); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse template output")
		return fmt.Errorf("failed to parse template output as ArgoCD Application: %w", err)
	}

	if app.ObjectMeta.Name == "" {
		err := fmt.Errorf("application name is required in metadata.name")
		span.RecordError(err)
		span.SetStatus(codes.Error, "missing application name")
		return err
	}

	// Clean the application name to make it valid for Kubernetes
	app.ObjectMeta.Name = getK8sCompatibleName(app.ObjectMeta.Name)

	span.SetAttributes(
		attribute.String("argocd.app_name", app.ObjectMeta.Name),
		attribute.String("argocd.app_namespace", app.ObjectMeta.Namespace),
	)

	upsert := true
	_, err = appClient.Create(ctx, &applicationpkg.ApplicationCreateRequest{
		Application: &app,
		Upsert:      &upsert,
	})
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create ArgoCD application")
		return fmt.Errorf("failed to create ArgoCD application: %w", err)
	}

	if err := d.startArgoApplicationVerification(ctx, jobWithRelease, cfg, app.ObjectMeta.Name); err != nil {
		span.RecordError(err)
		log.Error("Failed to start ArgoCD application verification",
			"error", err,
			"job_id", job.Id,
			"server_url", cfg.ServerUrl)
	}

	if err := d.sendJobUpdateEvent(job, cfg, app); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to send job update event")
		return err
	}

	span.SetStatus(codes.Ok, "job dispatched successfully")
	return nil
}

func (d *ArgoCDDispatcher) getKafkaProducer() (messaging.Producer, error) {
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, &confluentkafka.ConfigMap{
		"bootstrap.servers":        config.Global.KafkaBrokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})
}

func (d *ArgoCDDispatcher) sendJobUpdateEvent(job *oapi.Job, cfg argoCDAgentConfig, app v1alpha1.Application) error {
	_, span := argoCDTracer.Start(context.Background(), "sendJobUpdateEvent")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("argocd.app_name", app.ObjectMeta.Name),
	)

	workspaceId := d.store.ID()

	appUrl := fmt.Sprintf("%s/applications/%s/%s", cfg.ServerUrl, app.ObjectMeta.Namespace, app.ObjectMeta.Name)
	if !strings.HasPrefix(appUrl, "https://") {
		appUrl = "https://" + appUrl
	}

	links := make(map[string]string)
	links["ArgoCD Application"] = appUrl
	linksJSON, err := json.Marshal(links)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal links")
		return fmt.Errorf("failed to marshal links: %w", err)
	}
	job.Metadata[string("ctrlplane/links")] = string(linksJSON)

	job.Status = oapi.JobStatusSuccessful
	job.UpdatedAt = time.Now().UTC()
	job.CompletedAt = &job.UpdatedAt

	eventPayload := oapi.JobUpdateEvent{
		Id:             &job.Id,
		Job:            *job,
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{oapi.Status, oapi.Metadata, oapi.CompletedAt, oapi.UpdatedAt},
	}

	producer, err := d.getKafkaProducer()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create Kafka producer")
		return fmt.Errorf("failed to create Kafka producer: %w", err)
	}
	defer producer.Close()

	event := map[string]any{
		"eventType":   "job.updated",
		"workspaceId": workspaceId,
		"data":        eventPayload,
		"timestamp":   time.Now().Unix(),
	}

	eventBytes, err := json.Marshal(event)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to marshal event")
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to publish event")
		return err
	}

	span.SetStatus(codes.Ok, "event published")
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
	ctx, span := argoCDTracer.Start(ctx, "startArgoApplicationVerification")
	defer span.End()

	span.SetAttributes(
		attribute.String("argocd.app_name", appName),
		attribute.String("release.id", jobWithRelease.Release.ID()),
	)

	baseURL := cfg.ServerUrl
	if !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}

	// Query the specific ArgoCD Application
	appURL := fmt.Sprintf("%s/api/v1/applications/%s", baseURL, appName)

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
	if err := manager.StartVerification(ctx, &jobWithRelease.Release, metrics); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to start verification")
		return err
	}

	span.SetStatus(codes.Ok, "verification started")
	return nil
}
