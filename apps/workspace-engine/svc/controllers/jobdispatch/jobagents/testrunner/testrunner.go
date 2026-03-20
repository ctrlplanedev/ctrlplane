package testrunner

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"
)

var _ types.Dispatchable = &TestRunner{}
var _ types.Plannable = &TestRunner{}

type TestRunner struct {
	timeFunc func(d time.Duration) <-chan time.Time
	setter   Setter
}

type Setter interface {
	UpdateJob(
		ctx context.Context,
		jobID string,
		status oapi.JobStatus,
		message string,
		metadata map[string]string,
	) error
}

func New(setter Setter) *TestRunner {
	return &TestRunner{
		timeFunc: time.After,
		setter:   setter,
	}
}

func (t *TestRunner) Type() string {
	return "test-runner"
}

func (t *TestRunner) Dispatch(ctx context.Context, job *oapi.Job) error {
	cfg, err := job.GetTestRunnerJobAgentConfig()
	if err != nil {
		return err
	}

	delay := t.getDelay(cfg)
	finalStatus := t.getFinalStatus(cfg)
	message := ""
	if cfg.Message != nil {
		message = *cfg.Message
	}

	if err := t.setter.UpdateJob(ctx, job.Id, oapi.JobStatusInProgress, "", nil); err != nil {
		return err
	}

	go t.resolveJobAfterDelay(context.WithoutCancel(ctx), job.Id, delay, finalStatus, message)

	return nil
}

func (t *TestRunner) getDelay(cfg *oapi.TestRunnerJobAgentConfig) time.Duration {
	if cfg.DelaySeconds != nil {
		return time.Duration(*cfg.DelaySeconds) * time.Second
	}
	return 5 * time.Second // default delay
}

func (t *TestRunner) getFinalStatus(cfg *oapi.TestRunnerJobAgentConfig) oapi.JobStatus {
	if cfg.Status != nil && *cfg.Status == string(oapi.JobStatusFailure) {
		return oapi.JobStatusFailure
	}
	return oapi.JobStatusSuccessful
}

func (t *TestRunner) resolveJobAfterDelay(
	ctx context.Context,
	jobID string,
	delay time.Duration,
	status oapi.JobStatus,
	message string,
) {
	// Wait for the configured delay
	<-t.timeFunc(delay)

	// Build the message
	resolveMsg := fmt.Sprintf("Resolved by test-runner after %v", delay)
	var finalMessage string
	if message != "" {
		finalMessage = message + "\n" + resolveMsg
	} else {
		finalMessage = resolveMsg
	}

	t.setter.UpdateJob(ctx, jobID, status, finalMessage, nil)
}

func (t *TestRunner) Plan(
	_ context.Context,
	dispatchCtx *oapi.DispatchContext,
	_ json.RawMessage,
) (*types.PlanResult, error) {
	hasChanges, ok := dispatchCtx.JobAgentConfig["hasChanges"].(bool)
	if !ok {
		hasChanges = false
	}
	now := time.Now()
	return &types.PlanResult{
		ContentHash: "test-runner",
		HasChanges:  hasChanges,
		Current:     "",
		Proposed:    "",
		CompletedAt: &now,
	}, nil
}
