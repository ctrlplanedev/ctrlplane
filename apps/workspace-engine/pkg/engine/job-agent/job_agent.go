package jobagent

import (
	"context"
	"workspace-engine/pkg/model/job"
)

type JobAgentType string

const (
	JobAgentTypeMock JobAgentType = "mock" // for testing

	JobAgentTypeGithub JobAgentType = "github_app"
)

type JobAgent interface {
	GetID() string
	GetType() JobAgentType
	GetConfig() map[string]any
	DispatchJob(ctx context.Context, job *job.Job) error
}
