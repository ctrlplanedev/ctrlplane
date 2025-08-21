package jobagent

import (
	"context"
	"errors"
	"sync"
	"workspace-engine/pkg/model"
)

var _ model.Repository[JobAgent] = (*JobAgentRepository)(nil)

type JobAgentRepository struct {
	jobAgents map[string]*JobAgent
	mu        sync.RWMutex
}

func NewJobAgentRepository() *JobAgentRepository {
	return &JobAgentRepository{jobAgents: make(map[string]*JobAgent)}
}

func (r *JobAgentRepository) GetAll(ctx context.Context) []*JobAgent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	agents := make([]*JobAgent, 0, len(r.jobAgents))
	for _, agent := range r.jobAgents {
		agentCopy := *agent
		agents = append(agents, &agentCopy)
	}

	return agents
}

func (r *JobAgentRepository) Get(ctx context.Context, agentID string) *JobAgent {
	r.mu.RLock()
	defer r.mu.RUnlock()

	agent := r.jobAgents[agentID]
	if agent == nil {
		return nil
	}

	return agent
}

func (r *JobAgentRepository) Create(ctx context.Context, agent *JobAgent) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if agent == nil {
		return errors.New("job agent is nil")
	}

	agentCopy := *agent
	id := agentCopy.GetID()
	if _, ok := r.jobAgents[id]; ok {
		return errors.New("job agent already exists")
	}

	agentCopyPtr := &agentCopy
	r.jobAgents[id] = agentCopyPtr

	return nil
}

func (r *JobAgentRepository) Update(ctx context.Context, agent *JobAgent) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if agent == nil {
		return errors.New("job agent is nil")
	}

	agentCopy := *agent
	id := agentCopy.GetID()
	if _, ok := r.jobAgents[id]; !ok {
		return errors.New("job agent does not exist")
	}

	agentCopyPtr := &agentCopy
	r.jobAgents[id] = agentCopyPtr

	return nil
}

func (r *JobAgentRepository) Delete(ctx context.Context, agentID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.jobAgents[agentID]; !ok {
		return errors.New("job agent does not exist")
	}

	delete(r.jobAgents, agentID)

	return nil
}

func (r *JobAgentRepository) Exists(ctx context.Context, agentID string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	_, ok := r.jobAgents[agentID]
	return ok
}
