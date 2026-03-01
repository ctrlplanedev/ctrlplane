package github

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace-engine/jobagents/github")

// WorkflowDispatcher dispatches a GitHub Actions workflow.
type WorkflowDispatcher interface {
	DispatchWorkflow(ctx context.Context, cfg oapi.GithubJobAgentConfig, ref string, inputs map[string]any) error
}

// Setter persists job status updates.
type Setter interface {
	UpdateJob(ctx context.Context, jobID string, status oapi.JobStatus, message string, metadata map[string]string) error
}

type GithubAction struct {
	workflows WorkflowDispatcher
	setter    Setter
}

func New(workflows WorkflowDispatcher, setter Setter) *GithubAction {
	return &GithubAction{workflows: workflows, setter: setter}
}

func (a *GithubAction) Type() string {
	return "github-app"
}

func (a *GithubAction) Dispatch(ctx context.Context, job *oapi.Job) error {
	dispatchCtx := job.DispatchContext
	cfg, err := ParseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return fmt.Errorf("failed to parse job agent config: %w", err)
	}

	ref := "main"
	if cfg.Ref != nil {
		ref = *cfg.Ref
	}

	go func() {
		parentSpanCtx := trace.SpanContextFromContext(ctx)
		asyncCtx, span := tracer.Start(context.Background(), "GithubAction.AsyncDispatch",
			trace.WithLinks(trace.Link{SpanContext: parentSpanCtx}),
		)
		defer span.End()

		if err := a.workflows.DispatchWorkflow(asyncCtx, cfg, ref, map[string]any{"job_id": job.Id}); err != nil {
			message := fmt.Sprintf("failed to dispatch workflow: %s", err.Error())
			_ = a.setter.UpdateJob(asyncCtx, job.Id, oapi.JobStatusInvalidIntegration, message, nil)
		}
	}()

	return nil
}
