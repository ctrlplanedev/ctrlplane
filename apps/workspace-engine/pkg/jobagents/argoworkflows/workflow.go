package argoworkflows

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strings"

	wfv1 "github.com/argoproj/argo-workflows/v4/pkg/apis/workflow/v1alpha1"
	"github.com/goccy/go-yaml"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
	"workspace-engine/pkg/jobagents/types"
)

var tracer = otel.Tracer("workspace-engine/jobagents/argo-workflow")

var _ types.Dispatchable = (*ArgoWorkflow)(nil)

type WorkFlowJobAgentConfig struct {
	ServerAddr         string
	ApiKey             string
	Template           string
	Name               string
	InsecureSkipVerify bool
}

type Getter interface {
	GetWorkflow(ctx context.Context, name string) (*wfv1.Workflow, error)
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
	SubmitWorkflow(
		ctx context.Context,
		serverAddr, apiKey string,
		insecureSkipVerify bool,
		wf *wfv1.Workflow,
	) (*wfv1.Workflow, error)
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
	if dispatchCtx == nil {
		return fmt.Errorf("job %s has no dispatch context", job.Id)
	}
	jobAgentConfig := dispatchCtx.JobAgentConfig
	wfConfig, err := ParseJobAgentConfig(jobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	wf, err := TemplateApplication(
		dispatchCtx,
		wfConfig.Template,
		wfConfig.Name,
	)
	if err != nil {
		return fmt.Errorf("failed to generate workflow from template: %w", err)
	}

	if wf.Labels == nil {
		wf.Labels = map[string]string{}
	}

	wf.Labels["job-id"] = job.Id
	MakeApplicationK8sCompatible(wf)

	go func() {
		parentSpanCtx := trace.SpanContextFromContext(ctx)
		asyncCtx, span := tracer.Start(context.Background(), "ArgoWorkflow.AsyncDispatch",
			trace.WithLinks(trace.Link{SpanContext: parentSpanCtx}),
		)
		defer span.End()

		created, err := a.submitter.SubmitWorkflow(
			asyncCtx,
			wfConfig.ServerAddr,
			wfConfig.ApiKey,
			wfConfig.InsecureSkipVerify,
			wf,
		)
		if err != nil {
			_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusFailure,
				fmt.Sprintf("failed to submit workflow: %s", err.Error()), nil)
			return
		}

		metadata := BuildArgoLinks(wfConfig.ServerAddr, created)
		_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusInProgress, "", metadata)
	}()

	return nil
}

// ParseJobAgentConfig extracts the required fields from an agent config.
func ParseJobAgentConfig(
	config oapi.JobAgentConfig,
) (*WorkFlowJobAgentConfig, error) {
	wfT := new(WorkFlowJobAgentConfig)
	serverAddr, ok := config["serverUrl"].(string)
	if !ok {
		return wfT, fmt.Errorf("serverUrl is required")
	}
	wfT.ServerAddr = serverAddr
	apiKey, ok := config["apiKey"].(string)
	if !ok {
		return wfT, fmt.Errorf("apiKey is required")
	}
	wfT.ApiKey = apiKey
	template, ok := config["template"].(string)
	if !ok {
		return wfT, fmt.Errorf("template is required")
	}
	wfT.Template = template

	name, ok := config["name"].(string)
	if !ok {
		return wfT, fmt.Errorf("name is required")
	}
	wfT.Name = name
	if serverAddr == "" || template == "" || name == "" {
		return wfT, fmt.Errorf("missing required fields in job agent config")
	}

	if v, ok := config["httpInsecure"].(bool); ok {
		wfT.InsecureSkipVerify = v
	}
	return wfT, nil
}

// TemplateApplication renders the Argo Workflows Workflow YAML template using
// the dispatch context variables.
func TemplateApplication(
	ctx *oapi.DispatchContext,
	tmpl string,
	name string,
) (*wfv1.Workflow, error) {
	t, err := templatefuncs.Parse("argoWorkflowAgentConfig", tmpl)
	if err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, ctx.Map()); err != nil {
		return nil, fmt.Errorf("failed to execute template: %w", err)
	}
	var workflow wfv1.Workflow
	if err := yaml.Unmarshal(buf.Bytes(), &workflow); err != nil {
		return nil, fmt.Errorf("failed to unmarshal workflow: %w", err)
	}
	if workflow.GenerateName != "" {
		workflow.Name = ""
	}
	if workflow.Name != "" {
		workflow.Name = ""
	}
	if workflow.GenerateName == "" {
		workflow.GenerateName = fmt.Sprintf("%s-", name)
		workflow.Name = ""
	}
	return &workflow, nil
}

// MakeApplicationK8sCompatible sanitises the workflow name and label
// values so they conform to Kubernetes naming rules.
func MakeApplicationK8sCompatible(wf *wfv1.Workflow) {
	if wf.Name != "" {
		wf.Name = GetK8sCompatibleName(wf.Name, false)
	}
	if wf.GenerateName != "" {
		wf.GenerateName = GetK8sCompatibleName(wf.GenerateName, true)
	}
	if wf.Labels != nil {
		for key, value := range wf.Labels {
			wf.Labels[key] = GetK8sCompatibleName(value, false)
		}
	}
}

func GetK8sCompatibleName(name string, generated bool) string {
	cleaned := strings.ToLower(name)
	k8sInvalidCharsRegex := regexp.MustCompile(`[^a-z0-9-]`)
	cleaned = k8sInvalidCharsRegex.ReplaceAllString(cleaned, "-")
	if len(cleaned) > 63 {
		cleaned = cleaned[:63]
	}
	if !generated {
		cleaned = strings.Trim(cleaned, "-")
	} else {
		cleaned = strings.TrimLeft(cleaned, "-")
	}
	return cleaned
}

// BuildArgoLinks builds the metadata map with an Argo Workflows URL.
func BuildArgoLinks(serverAddr string, wf *wfv1.Workflow) map[string]string {
	appURL := fmt.Sprintf("%s/workflows/%s/%s", serverAddr, wf.Namespace, wf.Name)
	if !strings.HasPrefix(appURL, "https://") {
		appURL = "https://" + appURL
	}
	return map[string]string{
		"ctrlplane/links": fmt.Sprintf(`{"Argo Workflow":"%s"}`, appURL),
	}
}
