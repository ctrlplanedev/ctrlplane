package jobdispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strings"
	"time"
	"workspace-engine/pkg/config"

	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	applicationpkg "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"google.golang.org/grpc"
	"sigs.k8s.io/yaml"
)

var argoCDTracer = otel.Tracer("ArgoCDDispatcher")

// ArgoCDApplicationClient interface for creating ArgoCD applications
type ArgoCDApplicationClient interface {
	Create(ctx context.Context, req *applicationpkg.ApplicationCreateRequest, opts ...grpc.CallOption) (*v1alpha1.Application, error)
}

// VerificationStarter interface for starting verifications
type VerificationStarter interface {
	StartVerification(ctx context.Context, job *oapi.Job, metrics []oapi.VerificationMetricSpec) error
}

// KafkaProducerFactory creates Kafka producers
type KafkaProducerFactory func() (messaging.Producer, error)

// ArgoCDAppClientFactory creates ArgoCD application clients
type ArgoCDAppClientFactory func(serverAddr, authToken string) (ArgoCDApplicationClient, error)

type ArgoCDDispatcher struct {
	store                *store.Store
	verification         VerificationStarter
	appClientFactory     ArgoCDAppClientFactory
	kafkaProducerFactory KafkaProducerFactory
}

func NewArgoCDDispatcher(store *store.Store, verification *verification.Manager) *ArgoCDDispatcher {
	return &ArgoCDDispatcher{
		store:        store,
		verification: verification,
	}
}

// NewArgoCDDispatcherWithFactories creates a dispatcher with custom factories for testing
func NewArgoCDDispatcherWithFactories(
	store *store.Store,
	verification VerificationStarter,
	appClientFactory ArgoCDAppClientFactory,
	kafkaProducerFactory KafkaProducerFactory,
) *ArgoCDDispatcher {
	return &ArgoCDDispatcher{
		store:                store,
		verification:         verification,
		appClientFactory:     appClientFactory,
		kafkaProducerFactory: kafkaProducerFactory,
	}
}

func getK8sCompatibleName(name string) string {
	// Replace invalid characters with hyphens
	cleaned := strings.ReplaceAll(name, "/", "-")
	cleaned = strings.ReplaceAll(cleaned, ":", "-")

	// Ensure it starts and ends with alphanumeric
	cleaned = strings.Trim(cleaned, "-_.")

	if len(cleaned) > 63 {
		return cleaned[:63]
	}

	return cleaned
}

func unmarshalApplication(data []byte, app *v1alpha1.Application) error {
	if err := yaml.Unmarshal(data, app); err == nil {
		return nil
	}

	if err := json.Unmarshal(data, app); err != nil {
		return fmt.Errorf("failed to parse as YAML or JSON: %w", err)
	}

	return nil
}

// isRetryableError checks if an error is a transient error that should be retried
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Check for HTTP status codes that indicate transient failures
	return strings.Contains(errStr, "502") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "504") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "temporarily unavailable")
}

func (d *ArgoCDDispatcher) DispatchJob(ctx context.Context, job *oapi.Job) error {
	ctx, span := argoCDTracer.Start(ctx, "ArgoCDDispatcher.DispatchJob")
	defer span.End()

	cfg, err := job.JobAgentConfig.AsFullArgoCDJobAgentConfig()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse job config")
		message := fmt.Sprintf("Invalid ArgoCD job agent configuration: %s", err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidJobAgent, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return err
	}

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("release.id", job.ReleaseId),
	)

	jobWithRelease, err := d.store.Jobs.GetWithRelease(job.Id)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get job with release")
		message := fmt.Sprintf("Failed to get job with release: %s", err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusFailure, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return err
	}

	if jobWithRelease.Resource == nil {
		err := fmt.Errorf("resource not found for job %s", job.Id)
		span.RecordError(err)
		span.SetStatus(codes.Error, "resource not found for job")
		message := "Resource not found for this job. Ensure the resource exists and is properly configured."
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusFailure, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return err
	}

	templatableJobWithRelease, err := jobWithRelease.ToTemplatable()
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get templatable job")
		message := fmt.Sprintf("Failed to prepare job data for templating: %s", err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusFailure, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return fmt.Errorf("failed to get templatable job with release: %w", err)
	}

	span.SetAttributes(attribute.String("cfg", fmt.Sprintf("%+v", cfg)))
	span.SetAttributes(attribute.String("argocd.server_url", cfg.ServerUrl))
	span.SetAttributes(attribute.Int("argocd.template_length", len(cfg.Template)))

	// Debug: Log if template is empty
	if cfg.Template == "" {
		log.Error("ArgoCD template is EMPTY!",
			"job_id", job.Id,
			"server_url", cfg.ServerUrl,
			"api_key_set", cfg.ApiKey != "",
		)
	}

	t, err := templatefuncs.Parse("argoCDAgentConfig", cfg.Template)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse template")
		message := fmt.Sprintf("Invalid ArgoCD Application template syntax: %s", err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidJobAgent, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return fmt.Errorf("failed to parse template: %w", err)
	}

	// Convert to map with lowercase keys for consistent template variable naming
	templateData := templatableJobWithRelease.ToTemplateData()

	var buf bytes.Buffer
	if err := t.Execute(&buf, templateData); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to execute template")
		message := fmt.Sprintf("Failed to execute ArgoCD Application template: %s", err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidJobAgent, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return fmt.Errorf("failed to execute template: %w", err)
	}

	var appClient ArgoCDApplicationClient
	var closer func()

	if d.appClientFactory != nil {
		client, err := d.appClientFactory(cfg.ServerUrl, cfg.ApiKey)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to create ArgoCD client")
			message := fmt.Sprintf("Failed to connect to ArgoCD server at %s: %s", cfg.ServerUrl, err.Error())
			if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidIntegration, message); sendErr != nil {
				log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
			}
			return fmt.Errorf("failed to create ArgoCD client: %w", err)
		}
		appClient = client
		closer = func() {} // No-op closer for factory-created clients
	} else {
		client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
			ServerAddr: cfg.ServerUrl,
			AuthToken:  cfg.ApiKey,
		})
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to create ArgoCD client")
			message := fmt.Sprintf("Failed to connect to ArgoCD server at %s: %s", cfg.ServerUrl, err.Error())
			if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidIntegration, message); sendErr != nil {
				log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
			}
			return fmt.Errorf("failed to create ArgoCD client: %w", err)
		}

		ioCloser, realAppClient, err := client.NewApplicationClient()
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "failed to create application client")
			message := fmt.Sprintf("Failed to create ArgoCD application client: %s", err.Error())
			if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidIntegration, message); sendErr != nil {
				log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
			}
			return fmt.Errorf("failed to create ArgoCD application client: %w", err)
		}
		appClient = realAppClient
		closer = func() { ioCloser.Close() }
	}
	defer closer()

	var app v1alpha1.Application
	if err := unmarshalApplication(buf.Bytes(), &app); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to parse template output")
		message := fmt.Sprintf("Template output is not a valid ArgoCD Application: %s", err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidJobAgent, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return fmt.Errorf("failed to parse template output as ArgoCD Application: %w", err)
	}

	if app.ObjectMeta.Name == "" {
		resourceName := ""
		if templatableJobWithRelease.Resource != nil {
			resourceName = templatableJobWithRelease.Resource.Name
		}
		err := fmt.Errorf("application name is required in metadata.name (resource.Name=%q, template output preview: %s)", resourceName, buf.String()[:min(500, len(buf.String()))])
		span.RecordError(err)
		span.SetStatus(codes.Error, "missing application name")
		message := "ArgoCD Application template must include metadata.name. Check that your template sets a valid application name."
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusInvalidJobAgent, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
		return err
	}

	// Clean the application name to make it valid for Kubernetes
	app.ObjectMeta.Name = getK8sCompatibleName(app.ObjectMeta.Name)

	// Clean all label values to make them valid for Kubernetes
	if app.ObjectMeta.Labels != nil {
		for key, value := range app.ObjectMeta.Labels {
			app.ObjectMeta.Labels[key] = getK8sCompatibleName(value)
		}
	}

	span.SetAttributes(
		attribute.String("argocd.app_name", app.ObjectMeta.Name),
		attribute.String("argocd.app_namespace", app.ObjectMeta.Namespace),
	)

	upsert := true

	err = retry.Do(
		func() error {
			_, createErr := appClient.Create(ctx, &applicationpkg.ApplicationCreateRequest{
				Application: &app,
				Upsert:      &upsert,
			})
			if createErr != nil {
				if isRetryableError(createErr) {
					log.Warn("ArgoCD application creation failed with retryable error, will retry",
						"job_id", job.Id,
						"app_name", app.ObjectMeta.Name,
						"error", createErr)
					return createErr // Return error to trigger retry
				}
				// Non-retryable error - stop retrying
				return retry.Unrecoverable(createErr)
			}
			return nil
		},
		retry.Attempts(5),
		retry.Delay(1*time.Second),
		retry.MaxDelay(10*time.Second),
		retry.DelayType(retry.BackOffDelay),
		retry.OnRetry(func(n uint, err error) {
			log.Warn("Retrying ArgoCD application creation",
				"attempt", n+1,
				"job_id", job.Id,
				"app_name", app.ObjectMeta.Name,
				"error", err)
			span.AddEvent("Retrying ArgoCD application creation")
		}),
		retry.Context(ctx),
	)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to create ArgoCD application")
		message := fmt.Sprintf("Failed to create ArgoCD application '%s': %s", app.ObjectMeta.Name, err.Error())
		if sendErr := d.sendJobFailureEvent(job, oapi.JobStatusFailure, message); sendErr != nil {
			log.Error("Failed to send job failure event", "error", sendErr, "job_id", job.Id)
		}
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
	if d.kafkaProducerFactory != nil {
		return d.kafkaProducerFactory()
	}
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, &confluentkafka.ConfigMap{
		"bootstrap.servers":        config.Global.KafkaBrokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})
}

// sendJobFailureEvent sends a job update event with a failure status and message
func (d *ArgoCDDispatcher) sendJobFailureEvent(job *oapi.Job, status oapi.JobStatus, message string) error {
	_, span := argoCDTracer.Start(context.Background(), "sendJobFailureEvent")
	defer span.End()

	span.SetAttributes(
		attribute.String("job.id", job.Id),
		attribute.String("job.status", string(status)),
		attribute.String("job.message", message),
	)

	workspaceId := d.store.ID()

	now := time.Now().UTC()
	eventPayload := oapi.JobUpdateEvent{
		Id: &job.Id,
		Job: oapi.Job{
			Id:          job.Id,
			Status:      status,
			Message:     &message,
			UpdatedAt:   now,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateMessage,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
			oapi.JobUpdateEventFieldsToUpdateUpdatedAt,
		},
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

	span.SetStatus(codes.Ok, "failure event published")
	return nil
}

func (d *ArgoCDDispatcher) sendJobUpdateEvent(job *oapi.Job, cfg oapi.FullArgoCDJobAgentConfig, app v1alpha1.Application) error {
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

	newJobMetadata := make(map[string]string)
	maps.Copy(newJobMetadata, job.Metadata)
	newJobMetadata[string("ctrlplane/links")] = string(linksJSON)

	now := time.Now().UTC()
	eventPayload := oapi.JobUpdateEvent{
		Id: &job.Id,
		Job: oapi.Job{
			Id:          job.Id,
			Metadata:    newJobMetadata,
			Status:      oapi.JobStatusSuccessful,
			UpdatedAt:   now,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateMetadata,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
			oapi.JobUpdateEventFieldsToUpdateUpdatedAt,
		},
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
	cfg oapi.FullArgoCDJobAgentConfig,
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
	appURL := fmt.Sprintf("%s/api/v1/applications/%s", baseURL, appName)

	method := oapi.GET
	timeout := "5s"
	headers := map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", cfg.ApiKey),
	}

	provider := oapi.MetricProvider{}
	_ = provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     appURL,
		Method:  &method,
		Timeout: &timeout,
		Headers: &headers,
		Type:    oapi.Http,
	})

	successThreshold := 1
	failureCondition := "result.statusCode != 200 || result.json.status.health.status == 'Degraded' || result.json.status.health.status == 'Missing'"
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             fmt.Sprintf("%s-argocd-application-health", appName),
			IntervalSeconds:  60,
			Count:            10,
			SuccessThreshold: &successThreshold,
			SuccessCondition: "result.statusCode == 200 && result.json.status.sync.status == 'Synced' && result.json.status.health.status == 'Healthy'",
			FailureCondition: &failureCondition,
			Provider:         provider,
		},
	}

	if err := d.verification.StartVerification(ctx, &jobWithRelease.Job, metrics); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to start verification")
		return err
	}

	span.SetStatus(codes.Ok, "verification started")
	return nil
}
