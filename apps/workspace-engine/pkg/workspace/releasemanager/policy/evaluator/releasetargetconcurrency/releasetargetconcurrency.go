package releasetargetconcurrency

import (
	"context"
	"fmt"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.JobEvaluator = &ReleaseTargetConcurrencyEvaluator{}

type ReleaseTargetConcurrencyEvaluator struct {
	store *store.Store
}

func NewReleaseTargetConcurrencyEvaluator(store *store.Store) evaluator.JobEvaluator {
	return &ReleaseTargetConcurrencyEvaluator{store: store}
}

func (e *ReleaseTargetConcurrencyEvaluator) Evaluate(ctx context.Context, release *oapi.Release) *oapi.RuleEvaluation {
	processingJobs := e.store.Jobs.GetJobsInProcessingStateForReleaseTarget(&release.ReleaseTarget)

	if len(processingJobs) != 0 {
		res := results.NewDeniedResult("Release target has an active job").WithDetail("release_target_key", release.ReleaseTarget.Key())
		for _, job := range processingJobs {
			res = res.WithDetail(fmt.Sprintf("job_%s", job.Id), job.Status)
		}
		return res
	}

	return results.NewAllowedResult("Release target has no active jobs")
}
