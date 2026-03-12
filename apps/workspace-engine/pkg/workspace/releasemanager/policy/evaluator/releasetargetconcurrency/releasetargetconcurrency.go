package releasetargetconcurrency

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
)

var _ evaluator.JobEvaluator = &ReleaseTargetConcurrencyEvaluator{}

type Getters interface {
	GetJobsInProcessingStateForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
}

type ReleaseTargetConcurrencyEvaluator struct {
	getters Getters
}

// NewEvaluator creates a concurrency evaluator with the given getters interface.
func NewEvaluator(getters Getters) evaluator.JobEvaluator {
	if getters == nil {
		return nil
	}
	return &ReleaseTargetConcurrencyEvaluator{getters: getters}
}

func (e *ReleaseTargetConcurrencyEvaluator) Evaluate(
	ctx context.Context,
	release *oapi.Release,
) *oapi.RuleEvaluation {
	processingJobs := e.getters.GetJobsInProcessingStateForReleaseTarget(
		ctx,
		&release.ReleaseTarget,
	)

	if len(processingJobs) != 0 {
		res := results.NewDeniedResult("Release target has an active job").
			WithDetail("release_target_key", release.ReleaseTarget.Key())
		for _, job := range processingJobs {
			res = res.WithDetail(fmt.Sprintf("job_%s", job.Id), job.Status)
		}
		return res
	}

	return results.NewAllowedResult("Release target has no active jobs")
}
