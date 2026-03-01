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

	// CreateJobWithVerification persists a new job and its release_job link
	// row. When specs is non-empty it atomically creates the job, a
	// JobVerification record (with metric statuses initialised from the
	// specs), and enqueues one "verification" queue item per metric.
	// When specs is empty it only creates the job.
	CreateJobWithVerification(ctx context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error
}
