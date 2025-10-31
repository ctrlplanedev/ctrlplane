package deployment

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/releasetargetconcurrency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/skipdeployed"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
)

var jobEligibilityTracer = otel.Tracer("workspace/releasemanager/deployment/jobeligibility")

// JobEligibilityChecker determines whether a job should be created for a release.
// This handles release-level job creation rules like:
//   - Duplicate prevention (has this release already been attempted?)
//   - Retry logic (how many times can a failed release be retried?)
//
// Note: Version status checks are NOT here - they belong in the Planner during version selection.
// This is only about job creation decisions for a specific release.
type JobEligibilityChecker struct {
	store *store.Store

	// Release-level evaluators that determine job creation eligibility
	releaseEvaluators []evaluator.JobEvaluator
}

// NewJobEligibilityChecker creates a new job eligibility checker with default system rules.
func NewJobEligibilityChecker(store *store.Store) *JobEligibilityChecker {
	return &JobEligibilityChecker{
		store: store,
		releaseEvaluators: []evaluator.JobEvaluator{
			skipdeployed.NewSkipDeployedEvaluator(store),
			releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(store),
			// Future: Add retry limit evaluator here
			// retrylimit.NewRetryLimitEvaluator(store, maxRetries: 4),
		},
	}
}

// ShouldCreateJob determines if a job should be created for the given release.
// Returns:
//   - true: Job should be created
//   - false: Job should not be created (already attempted, retry limit exceeded, etc.)
//   - error: Evaluation failed
func (c *JobEligibilityChecker) ShouldCreateJob(
	ctx context.Context,
	release *oapi.Release,
) (bool, *oapi.DeployDecision, error) {
	ctx, span := jobEligibilityTracer.Start(ctx, "ShouldCreateJob")
	defer span.End()

	decision := &oapi.DeployDecision{
		PolicyResults: make([]oapi.PolicyEvaluation, 0),
	}

	// Evaluate release-scoped rules (e.g., skip deployed, retry limits)
	if len(c.releaseEvaluators) > 0 {
		policyResult := results.NewPolicyEvaluation()
		for _, eval := range c.releaseEvaluators {
			ruleResult := eval.Evaluate(ctx, release)
			policyResult.AddRuleResult(*ruleResult)
		}
		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	canCreate := decision.CanDeploy()

	return canCreate, decision, nil
}
