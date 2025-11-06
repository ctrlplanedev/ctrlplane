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
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
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
) (bool, string, error) {
	ctx, span := jobEligibilityTracer.Start(ctx, "ShouldCreateJob",
		trace.WithAttributes(
			attribute.String("release.id", release.ID()),
			attribute.String("release.version.id", release.Version.Id),
			attribute.String("release.version.tag", release.Version.Tag),
			attribute.String("release.target.key", release.ReleaseTarget.Key()),
			attribute.String("release.target.resource.id", release.ReleaseTarget.ResourceId),
			attribute.String("release.target.environment.id", release.ReleaseTarget.EnvironmentId),
			attribute.String("release.target.deployment.id", release.ReleaseTarget.DeploymentId),
		))
	defer span.End()

	decision := &oapi.DeployDecision{
		PolicyResults: make([]oapi.PolicyEvaluation, 0),
	}

	// Evaluate release-scoped rules (e.g., skip deployed, retry limits)
	span.SetAttributes(attribute.Int("eligibility_evaluators.count", len(c.releaseEvaluators)))

	if len(c.releaseEvaluators) > 0 {
		span.AddEvent("Evaluating eligibility rules")
		policyResult := results.NewPolicyEvaluation()

		for i, eval := range c.releaseEvaluators {
			ruleResult := eval.Evaluate(ctx, release)
			policyResult.AddRuleResult(*ruleResult)

			// Log individual evaluator results
			if !ruleResult.Allowed {
				span.AddEvent("Eligibility rule blocked job creation",
					trace.WithAttributes(
						attribute.Int("evaluator_index", i),
						attribute.String("message", ruleResult.Message),
					))
			}
		}
		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	canCreate := decision.CanDeploy()

	// Build a reason string based on the decision
	reason := "eligible"
	if !canCreate && len(decision.PolicyResults) > 0 {
		// Get the first blocked rule's message
		for _, policyResult := range decision.PolicyResults {
			for _, ruleResult := range policyResult.RuleResults {
				if !ruleResult.Allowed {
					reason = ruleResult.Message
					break
				}
			}
			if reason != "eligible" {
				break
			}
		}
	}

	span.SetAttributes(
		attribute.Bool("can_create", canCreate),
		attribute.String("decision_reason", reason),
	)

	if canCreate {
		span.AddEvent("Job creation allowed")
	} else {
		span.AddEvent("Job creation blocked",
			trace.WithAttributes(attribute.String("reason", reason)))
	}

	return canCreate, reason, nil
}
