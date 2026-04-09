package terraformcloud

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/jobagents/types"
	"workspace-engine/pkg/oapi"
)

const planTimeout = 5 * time.Minute

var _ types.Plannable = (*TFCPlanner)(nil)

// WorkspaceSetup handles workspace provisioning for a plan.
type WorkspaceSetup interface {
	Setup(ctx context.Context, dispatchCtx *oapi.DispatchContext) (workspaceID string, err error)
}

// SpeculativeRunner creates and reads speculative (plan-only) runs.
type SpeculativeRunner interface {
	CreateSpeculativeRun(ctx context.Context, cfg *tfeConfig, workspaceID string) (runID string, err error)
	ReadRunStatus(ctx context.Context, cfg *tfeConfig, runID string) (*RunStatus, error)
	ReadPlanJSON(ctx context.Context, cfg *tfeConfig, planID string) ([]byte, error)
}

// RunStatus is the information read back from a TFC run.
type RunStatus struct {
	Status               string
	PlanID               string
	ResourceAdditions    int
	ResourceChanges      int
	ResourceDestructions int
	IsFinished           bool
	IsErrored            bool
}

type TFCPlanner struct {
	workspace WorkspaceSetup
	runner    SpeculativeRunner
}

func NewTFCPlanner(workspace WorkspaceSetup, runner SpeculativeRunner) *TFCPlanner {
	return &TFCPlanner{workspace: workspace, runner: runner}
}

func (p *TFCPlanner) Type() string {
	return "tfe"
}

type tfePlanState struct {
	RunID       string     `json:"runId"`
	PollCount   int        `json:"pollCount"`
	FirstPolled *time.Time `json:"firstPolled,omitempty"`
}

func (p *TFCPlanner) Plan(
	ctx context.Context,
	dispatchCtx *oapi.DispatchContext,
	state json.RawMessage,
) (*types.PlanResult, error) {
	cfg, err := parseJobAgentConfig(dispatchCtx.JobAgentConfig)
	if err != nil {
		return nil, err
	}

	var s tfePlanState
	if state != nil {
		if err := json.Unmarshal(state, &s); err != nil {
			return nil, fmt.Errorf("unmarshal plan state: %w", err)
		}
	}

	if s.RunID == "" {
		workspaceID, err := p.workspace.Setup(ctx, dispatchCtx)
		if err != nil {
			return nil, fmt.Errorf("setup workspace: %w", err)
		}
		return p.createRun(ctx, cfg, workspaceID)
	}

	return p.pollRun(ctx, cfg, s)
}

func (p *TFCPlanner) createRun(
	ctx context.Context,
	cfg *tfeConfig,
	workspaceID string,
) (*types.PlanResult, error) {
	runID, err := p.runner.CreateSpeculativeRun(ctx, cfg, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("create speculative run: %w", err)
	}

	now := time.Now()
	s := tfePlanState{
		RunID:       runID,
		PollCount:   0,
		FirstPolled: &now,
	}

	stateJSON, err := json.Marshal(s)
	if err != nil {
		return nil, fmt.Errorf("marshal plan state: %w", err)
	}

	return &types.PlanResult{
		State:   stateJSON,
		Message: fmt.Sprintf("Speculative run %s created, waiting for plan", runID),
	}, nil
}

func (p *TFCPlanner) pollRun(
	ctx context.Context,
	cfg *tfeConfig,
	s tfePlanState,
) (*types.PlanResult, error) {
	status, err := p.runner.ReadRunStatus(ctx, cfg, s.RunID)
	if err != nil {
		return nil, fmt.Errorf("read run %s: %w", s.RunID, err)
	}

	s.PollCount++

	if status.IsFinished {
		return p.completePlan(ctx, cfg, status)
	}

	if status.IsErrored {
		now := time.Now()
		return &types.PlanResult{
			CompletedAt: &now,
			Message:     fmt.Sprintf("Run %s ended with status: %s", s.RunID, status.Status),
		}, nil
	}

	if s.FirstPolled != nil && time.Since(*s.FirstPolled) > planTimeout {
		now := time.Now()
		return &types.PlanResult{
			CompletedAt: &now,
			Message: fmt.Sprintf(
				"Run %s timed out after %d polls (%s elapsed), last status: %s",
				s.RunID, s.PollCount, time.Since(*s.FirstPolled).Round(time.Second), status.Status,
			),
		}, nil
	}

	stateJSON, err := json.Marshal(s)
	if err != nil {
		return nil, fmt.Errorf("marshal plan state: %w", err)
	}

	return &types.PlanResult{
		State: stateJSON,
		Message: fmt.Sprintf(
			"Waiting for plan (poll %d, status: %s)",
			s.PollCount, status.Status,
		),
	}, nil
}

func (p *TFCPlanner) completePlan(
	ctx context.Context,
	cfg *tfeConfig,
	status *RunStatus,
) (*types.PlanResult, error) {
	planJSON, err := p.runner.ReadPlanJSON(ctx, cfg, status.PlanID)
	if err != nil {
		return nil, fmt.Errorf("read plan JSON: %w", err)
	}

	hasChanges := status.ResourceAdditions+status.ResourceChanges+status.ResourceDestructions > 0
	hash := sha256.Sum256(planJSON)

	now := time.Now()
	return &types.PlanResult{
		CompletedAt: &now,
		HasChanges:  hasChanges,
		ContentHash: hex.EncodeToString(hash[:]),
		Current:     "",
		Proposed:    string(planJSON),
		Message: fmt.Sprintf(
			"+%d ~%d -%d resources",
			status.ResourceAdditions, status.ResourceChanges, status.ResourceDestructions,
		),
	}, nil
}
