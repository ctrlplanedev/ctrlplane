package argo

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strings"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/argoproj/argo-cd/v3/pkg/apis/application/v1alpha1"
	"github.com/goccy/go-yaml"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace-engine/jobagents/argo")

type Getter interface {
	GetApplication(ctx context.Context, name string) (*v1alpha1.Application, error)
}

// Setter persists job status updates.
type Setter interface {
	UpdateJob(
		ctx context.Context,
		jobID string,
		status oapi.JobStatus,
		message string,
		metadata map[string]string,
	) error
}

// ApplicationUpserter upserts an ArgoCD Application resource.
type ApplicationUpserter interface {
	UpsertApplication(
		ctx context.Context,
		serverAddr, apiKey string,
		app *v1alpha1.Application,
	) error
}

// ApplicationDeleter deletes an ArgoCD Application resource.
type ApplicationDeleter interface {
	DeleteApplication(ctx context.Context, serverAddr, apiKey, name string) error
}

// ManifestGetter retrieves rendered manifests for an ArgoCD application.
type ManifestGetter interface {
	GetManifests(ctx context.Context, serverAddr, apiKey, appName string) ([]string, error)
}

var (
	_ types.Dispatchable = &ArgoApplication{}
	_ types.Verifiable   = &ArgoApplication{}
)

type ArgoApplication struct {
	setter   Setter
	upserter ApplicationUpserter
}

func New(
	upserter ApplicationUpserter,
	deleter ApplicationDeleter,
	setter Setter,
	manifestGetter ManifestGetter,
) *ArgoApplication {
	return &ArgoApplication{
		setter:   setter,
		upserter: upserter,
	}
}

func (a *ArgoApplication) Type() string {
	return "argo-cd"
}

func (a *ArgoApplication) Dispatch(ctx context.Context, job *oapi.Job) error {
	ctx, span := tracer.Start(ctx, "ArgoApplication.Dispatch")
	defer span.End()

	span.SetAttributes(attribute.String("job.id", job.Id))
	span.SetAttributes(attribute.String("job.status", string(job.Status)))
	span.SetAttributes(attribute.String("job.dispatch_context", fmt.Sprintf("%+v", job.DispatchContext)))
	span.SetAttributes(attribute.String("job.dispatch_context_raw", fmt.Sprintf("%+v", job.DispatchContext.Map())))

	dispatchCtx := job.DispatchContext
	if dispatchCtx == nil {
		return fmt.Errorf("job %s has no dispatch context", job.Id)
	}
	jobAgentConfig := dispatchCtx.JobAgentConfig
	serverAddr, apiKey, template, err := ParseJobAgentConfig(jobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	app, err := TemplateApplication(dispatchCtx, template)
	if err != nil {
		return fmt.Errorf("failed to generate application from template: %w", err)
	}

	MakeApplicationK8sCompatible(app)

	go func() {
		parentSpanCtx := trace.SpanContextFromContext(ctx)
		asyncCtx, span := tracer.Start(context.Background(), "ArgoApplication.AsyncDispatch",
			trace.WithLinks(trace.Link{SpanContext: parentSpanCtx}),
		)
		defer span.End()

		if err := a.upserter.UpsertApplication(asyncCtx, serverAddr, apiKey, app); err != nil {
			_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusFailure,
				fmt.Sprintf("failed to upsert application: %s", err.Error()), nil)
			return
		}

		metadata := BuildArgoLinks(serverAddr, app)
		_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusSuccessful, "", metadata)
	}()

	return nil
}

// ParseJobAgentConfig extracts the required ArgoCD fields from an agent config.
func ParseJobAgentConfig(
	config oapi.JobAgentConfig,
) (serverAddr, apiKey, template string, err error) {
	serverAddr, ok := config["serverUrl"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("serverUrl is required")
	}
	apiKey, ok = config["apiKey"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("apiKey is required")
	}
	template, ok = config["template"].(string)
	if !ok {
		return "", "", "", fmt.Errorf("template is required")
	}
	if serverAddr == "" || apiKey == "" || template == "" {
		return "", "", "", fmt.Errorf("missing required fields in job agent config")
	}
	return serverAddr, apiKey, template, nil
}

// TemplateApplication renders the ArgoCD Application YAML template using
// the dispatch context variables.
func TemplateApplication(ctx *oapi.DispatchContext, tmpl string) (*v1alpha1.Application, error) {
	t, err := templatefuncs.Parse("argoCDAgentConfig", tmpl)
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

// MakeApplicationK8sCompatible sanitises the application name and label
// values so they conform to Kubernetes naming rules.
func MakeApplicationK8sCompatible(app *v1alpha1.Application) {
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

// BuildArgoLinks builds the metadata map with an ArgoCD application URL.
func BuildArgoLinks(serverAddr string, app *v1alpha1.Application) map[string]string {
	appURL := fmt.Sprintf("%s/applications/%s/%s", serverAddr, app.Namespace, app.Name)
	if !strings.HasPrefix(appURL, "https://") {
		appURL = "https://" + appURL
	}
	return map[string]string{
		"ctrlplane/links": fmt.Sprintf(`{"ArgoCD Application":"%s"}`, appURL),
	}
}
