package jobagents

import (
	"context"
	"encoding/json"
	"fmt"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"

	"github.com/google/uuid"
)

type Getter interface {
	GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error)
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

type Registry struct {
	dispatchers map[string]types.Dispatchable
	planners    map[string]types.Plannable
	verifiers   map[string]types.Verifiable
	getter      Getter
	setter      Setter
}

func NewRegistry(getter Getter, setter Setter) *Registry {
	r := &Registry{}
	r.dispatchers = make(map[string]types.Dispatchable)
	r.planners = make(map[string]types.Plannable)
	r.verifiers = make(map[string]types.Verifiable)
	r.getter = getter
	r.setter = setter
	return r
}

// Register adds the agent to every capability map it qualifies for.
func (r *Registry) Register(agent interface{ Type() string }) {
	if d, ok := agent.(types.Dispatchable); ok {
		r.dispatchers[d.Type()] = d
	}
	if p, ok := agent.(types.Plannable); ok {
		r.planners[p.Type()] = p
	}
	if v, ok := agent.(types.Verifiable); ok {
		r.verifiers[v.Type()] = v
	}
}

func (r *Registry) Dispatch(ctx context.Context, job *oapi.Job) error {
	jobAgent, err := r.getter.GetJobAgent(ctx, uuid.MustParse(job.JobAgentId))
	if err != nil {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	dispatcher, ok := r.dispatchers[jobAgent.Type]
	if !ok {
		return fmt.Errorf("job agent type %s not found", jobAgent.Type)
	}

	if config.Global.DryRunEnabled {
		return r.setter.UpdateJob(
			ctx,
			job.Id,
			oapi.JobStatusCancelled,
			"Dry run mode enabled, cancelling job",
			nil,
		)
	}

	return dispatcher.Dispatch(ctx, job)
}

// AgentVerifications returns verification specs declared by the agent type.
// If the agent does not implement [types.Verifiable], nil is returned.
func (r *Registry) AgentVerifications(
	agentType string,
	config oapi.JobAgentConfig,
) ([]oapi.VerificationMetricSpec, error) {
	dispatcher, ok := r.dispatchers[agentType]
	if !ok {
		return nil, nil
	}

	v, ok := dispatcher.(types.Verifiable)
	if !ok {
		return nil, nil
	}

	return v.Verifications(config)
}

func (r *Registry) Plan(
	ctx context.Context,
	agentType string,
	dispatchCtx *oapi.DispatchContext,
	state json.RawMessage,
) (*types.PlanResult, error) {
	p, ok := r.planners[agentType]
	if !ok {
		return nil, nil
	}

	return p.Plan(ctx, dispatchCtx, state)
}
