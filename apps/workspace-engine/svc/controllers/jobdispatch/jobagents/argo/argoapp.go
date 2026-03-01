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

	"github.com/argoproj/argo-cd/v2/pkg/apis/application/v1alpha1"
	"github.com/goccy/go-yaml"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace-engine/jobagents/argo")

// Setter persists job status updates.
type Setter interface {
	UpdateJob(ctx context.Context, jobID string, status oapi.JobStatus, message string, metadata map[string]string) error
}

// ApplicationUpserter upserts an ArgoCD Application resource.
type ApplicationUpserter interface {
	UpsertApplication(ctx context.Context, serverAddr, apiKey string, app *v1alpha1.Application) error
}

var (
	_ types.Dispatchable = &ArgoApplication{}
	_ types.Verifiable   = &ArgoApplication{}
)

type ArgoApplication struct {
	setter   Setter
	upserter ApplicationUpserter
}

func New(upserter ApplicationUpserter, setter Setter) *ArgoApplication {
	return &ArgoApplication{upserter: upserter, setter: setter}
}

func (a *ArgoApplication) Type() string {
	return "argo-cd"
}

// Verifications returns the ArgoCD application health check spec built from
// the agent config. The provider URL uses the serverUrl from config; the
// specific application path is resolved at measurement time via the
// provider context.
func (a *ArgoApplication) Verifications(config oapi.JobAgentConfig) ([]oapi.VerificationMetricSpec, error) {
	serverAddr, ok := config["serverUrl"].(string)
	if !ok || serverAddr == "" {
		return nil, nil
	}
	apiKey, ok := config["apiKey"].(string)
	if !ok || apiKey == "" {
		return nil, nil
	}

	baseURL := serverAddr
	if !strings.HasPrefix(baseURL, "https://") {
		baseURL = "https://" + baseURL
	}
	appURL := fmt.Sprintf("%s/api/v1/applications", baseURL)

	method := oapi.GET
	timeout := "5s"
	headers := map[string]string{
		"Authorization": fmt.Sprintf("Bearer %s", apiKey),
	}
	var provider oapi.MetricProvider
	if err := provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     appURL,
		Method:  &method,
		Timeout: &timeout,
		Headers: &headers,
		Type:    oapi.Http,
	}); err != nil {
		return nil, fmt.Errorf("build argocd health check provider: %w", err)
	}

	successThreshold := 1
	failureCondition := "result.statusCode != 200 || result.json.status.health.status == 'Degraded' || result.json.status.health.status == 'Missing'"
	spec := oapi.VerificationMetricSpec{
		Name:             "argocd-application-health",
		IntervalSeconds:  60,
		Count:            10,
		SuccessThreshold: &successThreshold,
		SuccessCondition: "result.statusCode == 200 && result.json.status.sync.status == 'Synced' && result.json.status.health.status == 'Healthy'",
		FailureCondition: &failureCondition,
		Provider:         provider,
	}
	return []oapi.VerificationMetricSpec{spec}, nil
}

func (a *ArgoApplication) Dispatch(ctx context.Context, job *oapi.Job) error {
	dispatchCtx := job.DispatchContext
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
func ParseJobAgentConfig(config oapi.JobAgentConfig) (serverAddr, apiKey, template string, err error) {
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
