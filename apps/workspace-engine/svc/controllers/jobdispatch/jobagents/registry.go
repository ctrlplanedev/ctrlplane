package jobagents

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/types"
)

type Getter interface {
	GetJobAgent(id string) (*oapi.JobAgent, bool)
	GetEnvironment(id string) (*oapi.Environment, bool)
	GetResource(id string) (*oapi.Resource, bool)
}

type Registry struct {
	dispatchers map[string]types.Dispatchable
	getter      Getter
}

func NewRegistry(getter Getter) *Registry {
	r := &Registry{}
	r.dispatchers = make(map[string]types.Dispatchable)
	r.getter = getter
	return r
}

// Register adds a dispatcher to the registry.
func (r *Registry) Register(dispatcher types.Dispatchable) {
	r.dispatchers[dispatcher.Type()] = dispatcher
}

func (r *Registry) Dispatch(ctx context.Context, job *oapi.Job) error {
	jobAgent, ok := r.getter.GetJobAgent(job.JobAgentId)
	if !ok {
		return fmt.Errorf("job agent %s not found", job.JobAgentId)
	}

	dispatcher, ok := r.dispatchers[jobAgent.Type]
	if !ok {
		return fmt.Errorf("job agent type %s not found", jobAgent.Type)
	}

	return dispatcher.Dispatch(ctx, job)
}

// AgentVerifications returns verification specs declared by the agent type.
// If the agent does not implement [types.Verifiable], nil is returned.
func (r *Registry) AgentVerifications(agentType string, config oapi.JobAgentConfig) ([]oapi.VerificationMetricSpec, error) {
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
