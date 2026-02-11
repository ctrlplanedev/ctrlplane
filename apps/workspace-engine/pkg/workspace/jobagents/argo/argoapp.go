package argo

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"maps"
	"regexp"
	"strings"
	"time"
	"workspace-engine/pkg/config"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	confluentkafka "github.com/confluentinc/confluent-kafka-go/v2/kafka"

	argocdclient "github.com/argoproj/argo-cd/v2/pkg/apiclient"
	argocdapplication "github.com/argoproj/argo-cd/v2/pkg/apiclient/application"
	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/avast/retry-go"
	"github.com/charmbracelet/log"
	"github.com/goccy/go-yaml"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace-engine/jobagents/argo")

var _ types.Dispatchable = &ArgoApplication{}

type ArgoApplication struct {
	store         *store.Store
	verifications *verification.Manager
}

func NewArgoApplication(store *store.Store, verifications *verification.Manager) *ArgoApplication {
	return &ArgoApplication{store: store, verifications: verifications}
}

func (a *ArgoApplication) Type() string {
	return "argo-cd"
}

func (a *ArgoApplication) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: true,
	}
}

func (a *ArgoApplication) Dispatch(ctx context.Context, dispatchCtx types.DispatchContext) error {
	jobAgentConfig := dispatchCtx.JobAgentConfig
	serverAddr, apiKey, template, err := a.parseJobAgentConfig(jobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	app, err := a.getTemplatedApplication(dispatchCtx, template)
	if err != nil {
		return fmt.Errorf("failed to generate application from template: %w", err)
	}

	a.makeApplicationK8sCompatible(app)

	go func() {
		parentSpanCtx := trace.SpanContextFromContext(ctx)
		asyncCtx, span := tracer.Start(context.Background(), "ArgoApplication.AsyncDispatch",
			trace.WithLinks(trace.Link{SpanContext: parentSpanCtx}),
		)
		defer span.End()

		ioCloser, appClient, err := a.getApplicationClient(serverAddr, apiKey)
		if err != nil {
			a.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to create ArgoCD client: %s", err.Error()))
			return
		}
		defer ioCloser.Close()

		if err := a.upsertApplicationWithRetry(asyncCtx, app, appClient); err != nil {
			a.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to upsert application: %s", err.Error()))
			return
		}

		verification := newArgoApplicationVerification(a.verifications, dispatchCtx.Job, app.Name, serverAddr, apiKey)
		if err := verification.StartVerification(asyncCtx, dispatchCtx.Job); err != nil {
			a.sendJobFailureEvent(dispatchCtx, fmt.Sprintf("failed to start verification: %s", err.Error()))
			return
		}

		a.sendJobUpdateEvent(serverAddr, app, dispatchCtx)
	}()

	return nil
}

func (a *ArgoApplication) parseJobAgentConfig(jobAgentConfig oapi.JobAgentConfig) (string, string, string, error) {
	serverAddr, ok := jobAgentConfig["serverUrl"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("serverUrl is required")
	}
	apiKey, ok := jobAgentConfig["apiKey"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("apiKey is required")
	}
	template, ok := jobAgentConfig["template"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("template is required")
	}
	if serverAddr == "" || apiKey == "" || template == "" {
		return "", "", "", fmt.Errorf("missing required fields in job agent config")
	}
	return serverAddr, apiKey, template, nil
}

func (a *ArgoApplication) getApplicationClient(serverAddr, apiKey string) (io.Closer, argocdapplication.ApplicationServiceClient, error) {
	client, err := argocdclient.NewClient(&argocdclient.ClientOptions{
		ServerAddr: serverAddr,
		AuthToken:  apiKey,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create ArgoCD client: %w", err)
	}
	return client.NewApplicationClient()
}

func (a *ArgoApplication) getTemplatedApplication(ctx types.DispatchContext, template string) (*v1alpha1.Application, error) {
	t, err := templatefuncs.Parse("argoCDAgentConfig", template)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, ctx.Map()); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	var app v1alpha1.Application
	if err := yaml.Unmarshal(buf.Bytes(), &app); err != nil {
		return nil, fmt.Errorf("failed to unmarshal application: %w", err)
	}
	return &app, nil
}

func (a *ArgoApplication) makeApplicationK8sCompatible(app *v1alpha1.Application) {
	app.Name = getK8sCompatibleName(app.Name)
	if app.Labels != nil {
		for key, value := range app.Labels {
			app.Labels[key] = getK8sCompatibleName(value)
		}
	}
}

func getK8sCompatibleName(name string) string {
	cleaned := strings.ToLower(name)
	k8sInvalidCharsRegex := regexp.MustCompile(`[^a-z0-9-]`)
	cleaned = k8sInvalidCharsRegex.ReplaceAllString(cleaned, "-")

	if len(cleaned) > 63 {
		cleaned = cleaned[:63]
	}
	cleaned = strings.Trim(cleaned, "-")
	if cleaned == "" {
		return "default"
	}

	return cleaned
}

func (a *ArgoApplication) upsertApplicationWithRetry(ctx context.Context, app *v1alpha1.Application, appClient argocdapplication.ApplicationServiceClient) error {
	upsert := true
	err := retry.Do(
		func() error {
			_, createErr := appClient.Create(ctx, &argocdapplication.ApplicationCreateRequest{
				Application: app,
				Upsert:      &upsert,
			})

			if createErr != nil {
				if isRetryableError(createErr) {
					return createErr
				}

				return retry.Unrecoverable(createErr)
			}
			return nil
		},
		retry.Attempts(5),
		retry.Delay(1*time.Second),
		retry.MaxDelay(10*time.Second),
		retry.DelayType(retry.BackOffDelay),
		retry.OnRetry(func(n uint, err error) {
			log.Warn("Retrying ArgoCD application upsert",
				"attempt", n+1,
				"error", err)
		}),
		retry.Context(ctx),
	)
	return err
}

func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := err.Error()
	// Check for HTTP status codes and gRPC errors that indicate transient failures
	return strings.Contains(errStr, "502") ||
		strings.Contains(errStr, "503") ||
		strings.Contains(errStr, "504") ||
		strings.Contains(errStr, "connection refused") ||
		strings.Contains(errStr, "connection reset") ||
		strings.Contains(errStr, "timeout") ||
		strings.Contains(errStr, "temporarily unavailable") ||
		strings.Contains(errStr, "EOF") ||
		strings.Contains(errStr, "Unavailable")
}

func (a *ArgoApplication) sendJobFailureEvent(context types.DispatchContext, message string) error {
	workspaceId := a.store.ID()

	now := time.Now().UTC()
	eventPayload := oapi.JobUpdateEvent{
		Id: &context.Job.Id,
		Job: oapi.Job{
			Id:          context.Job.Id,
			Status:      oapi.JobStatusFailure,
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
	producer, err := a.getKafkaProducer()
	if err != nil {
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
		return fmt.Errorf("failed to marshal event: %w", err)
	}
	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	return nil
}

func (a *ArgoApplication) sendJobUpdateEvent(serverAddr string, app *v1alpha1.Application, context types.DispatchContext) error {
	workspaceId := a.store.ID()

	appUrl := fmt.Sprintf("%s/applications/%s/%s", serverAddr, app.Namespace, app.Name)
	if !strings.HasPrefix(appUrl, "https://") {
		appUrl = "https://" + appUrl
	}

	links := make(map[string]string)
	links["ArgoCD Application"] = appUrl
	linksJSON, err := json.Marshal(links)
	if err != nil {
		return fmt.Errorf("failed to marshal links: %w", err)
	}

	newJobMetadata := make(map[string]string)
	maps.Copy(newJobMetadata, context.Job.Metadata)
	newJobMetadata[string("ctrlplane/links")] = string(linksJSON)

	now := time.Now().UTC()
	eventPayload := oapi.JobUpdateEvent{
		Id: &context.Job.Id,
		Job: oapi.Job{
			Id:          context.Job.Id,
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
	producer, err := a.getKafkaProducer()
	if err != nil {
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
		return fmt.Errorf("failed to marshal event: %w", err)
	}
	if err := producer.Publish([]byte(workspaceId), eventBytes); err != nil {
		return fmt.Errorf("failed to publish event: %w", err)
	}
	return nil
}

func (a *ArgoApplication) getKafkaProducer() (messaging.Producer, error) {
	return confluent.NewConfluent(config.Global.KafkaBrokers).CreateProducer(config.Global.KafkaTopic, &confluentkafka.ConfigMap{
		"bootstrap.servers":        config.Global.KafkaBrokers,
		"enable.idempotence":       true,
		"compression.type":         "snappy",
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,
	})
}
