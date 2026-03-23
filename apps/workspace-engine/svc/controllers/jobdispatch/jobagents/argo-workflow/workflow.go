package argo_workflows

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strings"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/goccy/go-yaml"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace-engine/jobagents/argo")

// Workflow is a minimal representation of an Argo Workflows Workflow resource.
// We define this locally to avoid importing argo-workflows/v4, which conflicts
// with argo-cd/v2's transitive dependencies (docker/docker vs moby/moby rename).
type Workflow struct {
	Kind       string           `yaml:"kind,omitempty"       json:"kind,omitempty"`
	APIVersion string           `yaml:"apiVersion,omitempty" json:"apiVersion,omitempty"`
	Metadata   WorkflowMetadata `yaml:"metadata,omitempty"   json:"metadata,omitempty"`
	Spec       interface{}      `yaml:"spec,omitempty"       json:"spec,omitempty"`
}

type WorkflowMetadata struct {
	Name      string            `yaml:"name,omitempty"      json:"name,omitempty"`
	Namespace string            `yaml:"namespace,omitempty" json:"namespace,omitempty"`
	Labels    map[string]string `yaml:"labels,omitempty"    json:"labels,omitempty"`
}

var _ types.Dispatchable = &ArgoWorkflow{}

type Getter interface {
	GetWorkflow(ctx context.Context, name string) (*Workflow, error)
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

// WorkflowDeleter deletes an Argo Workflows Workflow resource.
type WorkflowDeleter interface {
	DeleteWorkflow(ctx context.Context, serverAddr, apiKey, name string) error
}

// WorkflowSubmitter submits an Argo Workflows Workflow to the server.
type WorkflowSubmitter interface {
	SubmitWorkflow(ctx context.Context, serverAddr, apiKey string, wf *Workflow) error
}

type ArgoWorkflow struct {
	setter    Setter
	submitter WorkflowSubmitter
}

func New(submitter WorkflowSubmitter, setter Setter) *ArgoWorkflow {
	return &ArgoWorkflow{setter: setter, submitter: submitter}
}

func (a *ArgoWorkflow) Type() string {
	return "argo-workflow"
}

func (a *ArgoWorkflow) Dispatch(ctx context.Context, job *oapi.Job) error {
	dispatchCtx := job.DispatchContext
	jobAgentConfig := dispatchCtx.JobAgentConfig
	serverAddr, apiKey, template, err := ParseJobAgentConfig(jobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	wf, err := TemplateApplication(dispatchCtx, template)
	if err != nil {
		return fmt.Errorf("failed to generate workflow from template: %w", err)
	}

	MakeApplicationK8sCompatible(wf)

	go func() {
		parentSpanCtx := trace.SpanContextFromContext(ctx)
		asyncCtx, span := tracer.Start(context.Background(), "ArgoWorkflow.AsyncDispatch",
			trace.WithLinks(trace.Link{SpanContext: parentSpanCtx}),
		)
		defer span.End()

		if err := a.submitter.SubmitWorkflow(asyncCtx, serverAddr, apiKey, wf); err != nil {
			_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusFailure,
				fmt.Sprintf("failed to submit workflow: %s", err.Error()), nil)
			return
		}

		metadata := BuildArgoLinks(serverAddr, wf)
		_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusInProgress, "", metadata)
	}()

	return nil
}

// ParseJobAgentConfig extracts the required fields from an agent config.
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

// TemplateApplication renders the Argo Workflows Workflow YAML template using
// the dispatch context variables.
func TemplateApplication(ctx *oapi.DispatchContext, tmpl string) (*Workflow, error) {
	t, err := templatefuncs.Parse("argoWorkflowAgentConfig", tmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, ctx.Map()); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}

	var workflow Workflow
	if err := yaml.Unmarshal(buf.Bytes(), &workflow); err != nil {
		return nil, fmt.Errorf("failed to unmarshal workflow: %w", err)
	}
	return &workflow, nil
}

// MakeApplicationK8sCompatible sanitises the workflow name and label
// values so they conform to Kubernetes naming rules.
func MakeApplicationK8sCompatible(wf *Workflow) {
	wf.Metadata.Name = getK8sCompatibleName(wf.Metadata.Name)
	if wf.Metadata.Labels != nil {
		for key, value := range wf.Metadata.Labels {
			wf.Metadata.Labels[key] = getK8sCompatibleName(value)
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

// BuildArgoLinks builds the metadata map with an Argo Workflows URL.
func BuildArgoLinks(serverAddr string, wf *Workflow) map[string]string {
	appURL := fmt.Sprintf("%s/workflows/%s/%s", serverAddr, wf.Metadata.Namespace, wf.Metadata.Name)
	if !strings.HasPrefix(appURL, "https://") {
		appURL = "https://" + appURL
	}
	return map[string]string{
		"ctrlplane/links": fmt.Sprintf(`{"Argo Workflow":"%s"}`, appURL),
	}
}
