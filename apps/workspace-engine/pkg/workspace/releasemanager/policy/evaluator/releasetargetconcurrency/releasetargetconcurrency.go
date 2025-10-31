package releasetargetconcurrency

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.TargetScopedEvaluator = &ReleaseTargetConcurrencyEvaluator{}

type ReleaseTargetConcurrencyEvaluator struct {
	store *store.Store
}

func NewReleaseTargetConcurrencyEvaluator(store *store.Store) *ReleaseTargetConcurrencyEvaluator {
	return &ReleaseTargetConcurrencyEvaluator{store: store}
}

func (e *ReleaseTargetConcurrencyEvaluator) Evaluate(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.RuleEvaluation, error) {
	processingJobs := e.store.Jobs.GetJobsInProcessingStateForReleaseTarget(releaseTarget)
	if len(processingJobs) > 0 {
		return results.NewDeniedResult("Release target is already processing jobs").
			WithDetail("release_target_key", releaseTarget.Key()).
			WithDetail("jobs", processingJobs), nil
	}

	return results.NewAllowedResult("Release target is not processing jobs"), nil
}
