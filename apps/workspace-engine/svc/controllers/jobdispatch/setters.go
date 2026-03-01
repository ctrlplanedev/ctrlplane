package jobdispatch

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/github"
	"workspace-engine/svc/controllers/jobdispatch/jobagents/testrunner"
)

type Setter interface {
	testrunner.Setter
	github.Setter

	// CreateJob persists a new job and its release_job link row.
	CreateJob(ctx context.Context, job *oapi.Job) error
}
