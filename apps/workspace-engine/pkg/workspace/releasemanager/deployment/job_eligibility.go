package deployment

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/releasetargetconcurrency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/retry"
	"workspace-engine/pkg/workspace/releasemanager/policy/resolver"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	oteltrace "go.opentelemetry.io/otel/trace"
)

var jobEligibilityTracer = otel.Tracer("workspace/releasemanager/deployment/jobeligibility")

// JobEligibilityChecker determines whether a job should be created for a release.
// This handles release-level job creation rules like:
//   - Retry logic (how many times can a failed release be retried? - policy-based)
//   - Concurrency limits (how many jobs can run simultaneously for a target?)
//
// Retry logic is now handled by user-defined retry policies. When no retry policy
// is configured, defaults to no retries (only one attempt allowed per release).
//
// Note: Version status checks are NOT here - they belong in the Planner during version selection.
// This is only about job creation decisions for a specific release.
type JobEligibilityChecker struct {
	store *store.Store

	// Static release-level evaluators (always applied)
	staticEvaluators []evaluator.JobEvaluator
}

// NewJobEligibilityChecker creates a new job eligibility checker with static system rules.
func NewJobEligibilityChecker(store *store.Store) *JobEligibilityChecker {
	return &JobEligibilityChecker{
		store: store,
		staticEvaluators: []evaluator.JobEvaluator{
			// Concurrency check remains as static evaluator
			releasetargetconcurrency.NewReleaseTargetConcurrencyEvaluator(store),
			// Retry logic moved to dynamic policy-based evaluators
		},
	}
}

// ShouldCreateJob determines if a job should be created for the given release.
// Returns an EligibilityResult that indicates whether the job should be created immediately,
// denied, or pending (waiting for conditions like backoff to elapse).
//
// For pending results, the NextEvaluationTime field indicates when to re-evaluate.
func (c *JobEligibilityChecker) ShouldCreateJob(
	ctx context.Context,
	release *oapi.Release,
	recorder *trace.ReconcileTarget,
) (*EligibilityResult, error) {
	ctx, span := jobEligibilityTracer.Start(ctx, "ShouldCreateJob",
		oteltrace.WithAttributes(
			attribute.String("release.id", release.ID()),
			attribute.String("release.version.id", release.Version.Id),
			attribute.String("release.version.tag", release.Version.Tag),
			attribute.String("release.target.key", release.ReleaseTarget.Key()),
			attribute.String("release.target.resource.id", release.ReleaseTarget.ResourceId),
			attribute.String("release.target.environment.id", release.ReleaseTarget.EnvironmentId),
			attribute.String("release.target.deployment.id", release.ReleaseTarget.DeploymentId),
		))
	defer span.End()

	// Start eligibility phase trace if recorder is available
	var eligibility *trace.EligibilityPhase
	if recorder != nil {
		eligibility = recorder.StartEligibility()
		defer eligibility.End()
	}

	decision := &oapi.DeployDecision{
		PolicyResults: make([]oapi.PolicyEvaluation, 0),
	}

	// Get applicable policies for this release and build dynamic retry evaluators
	retryEvaluators := c.buildRetryEvaluators(ctx, release, span)

	// Combine static evaluators with dynamic retry evaluators
	allEvaluators := append(c.staticEvaluators, retryEvaluators...)
	span.SetAttributes(attribute.Int("eligibility_evaluators.count", len(allEvaluators)))

	if len(allEvaluators) > 0 {
		span.AddEvent("Evaluating eligibility rules")
		policyResult := results.NewPolicyEvaluation()

		for i, eval := range allEvaluators {
			ruleResult := eval.Evaluate(ctx, release)
			policyResult.AddRuleResult(*ruleResult)

			// Record check in trace
			if eligibility != nil {
				checkResult := trace.CheckResultPass
				if !ruleResult.Allowed {
					checkResult = trace.CheckResultFail
				}
				check := eligibility.StartCheck(ruleResult.Message)
				check.SetResult(checkResult, ruleResult.Message).End()
			}

			// Log individual evaluator results
			if !ruleResult.Allowed {
				span.AddEvent("Eligibility rule blocked job creation",
					oteltrace.WithAttributes(
						attribute.Int("evaluator_index", i),
						attribute.String("message", ruleResult.Message),
					))
			}
		}
		decision.PolicyResults = append(decision.PolicyResults, *policyResult)
	}

	canCreate := decision.CanDeploy()

	// Build eligibility result with reason and next evaluation time
	result := &EligibilityResult{
		Reason:  "eligible",
		Details: make(map[string]interface{}),
	}

	// Check for pending results (e.g., backoff waiting)
	var earliestNextTime *time.Time
	hasPending := false
	hasBlocked := false

	if len(decision.PolicyResults) > 0 {
		for _, policyResult := range decision.PolicyResults {
			for _, ruleResult := range policyResult.RuleResults {
				// Track if any rule requires action (pending state)
				if ruleResult.ActionRequired {
					hasPending = true
					result.Reason = ruleResult.Message

					// Track the earliest NextEvaluationTime from all pending rules
					if ruleResult.NextEvaluationTime != nil {
						if earliestNextTime == nil || ruleResult.NextEvaluationTime.Before(*earliestNextTime) {
							earliestNextTime = ruleResult.NextEvaluationTime
						}
					}
				}

				// Track if any rule blocks deployment
				if !ruleResult.Allowed && !ruleResult.ActionRequired {
					hasBlocked = true
					result.Reason = ruleResult.Message
					break
				}
			}
		}
	}

	// Determine final decision
	if hasPending {
		result.Decision = EligibilityPending
		result.NextEvaluationTime = earliestNextTime
	} else if hasBlocked || !canCreate {
		result.Decision = EligibilityDenied
	} else {
		result.Decision = EligibilityAllowed
	}

	// Record eligibility decision
	if eligibility != nil {
		if result.IsAllowed() {
			eligibility.MakeDecision("Job eligible for creation", trace.DecisionApproved)
		} else {
			// Both pending and denied are recorded as rejected for tracing purposes
			// The reason field distinguishes between the two
			eligibility.MakeDecision(result.Reason, trace.DecisionRejected)
		}
	}

	span.SetAttributes(
		attribute.Bool("can_create", canCreate),
		attribute.String("decision", string(result.Decision)),
		attribute.String("decision_reason", result.Reason),
	)

	if result.NextEvaluationTime != nil {
		span.SetAttributes(attribute.String("next_evaluation_time", result.NextEvaluationTime.Format(time.RFC3339)))
	}

	switch {
	case result.IsAllowed():
		span.AddEvent("Job creation allowed")
	case result.IsPending():
		span.AddEvent("Job creation pending",
			oteltrace.WithAttributes(attribute.String("reason", result.Reason)))
	default:
		span.AddEvent("Job creation blocked",
			oteltrace.WithAttributes(attribute.String("reason", result.Reason)))
	}

	return result, nil
}

// buildRetryEvaluators creates retry evaluators based on applicable policies for the release.
// If no retry policies are found, creates a default retry evaluator (maxRetries=0) which
// allows only one attempt per release (no retries).
func (c *JobEligibilityChecker) buildRetryEvaluators(
	ctx context.Context,
	release *oapi.Release,
	span oteltrace.Span,
) []evaluator.JobEvaluator {
	retryEvaluators := make([]evaluator.JobEvaluator, 0)

	// Use policy resolver to get retry rules for this release target
	retryRules, err := resolver.GetRules(
		ctx,
		c.store,
		&release.ReleaseTarget,
		resolver.RetryRuleExtractor,
		span,
	)
	if err != nil {
		span.AddEvent("Failed to get retry rules",
			oteltrace.WithAttributes(attribute.String("error", err.Error())))
		// On error, use default retry evaluator
		retryEvaluators = append(retryEvaluators, retry.NewEvaluator(c.store, nil))
		return retryEvaluators
	}

	// Create evaluators from extracted retry rules
	for _, ruleWithPolicy := range retryRules {
		eval := retry.NewEvaluator(c.store, ruleWithPolicy.Rule)
		if eval != nil {
			retryEvaluators = append(retryEvaluators, eval)
			span.AddEvent("Added retry evaluator from policy",
				oteltrace.WithAttributes(
					attribute.String("policy.id", ruleWithPolicy.PolicyId),
					attribute.String("policy.name", ruleWithPolicy.PolicyName),
					attribute.String("rule.id", ruleWithPolicy.RuleId),
					attribute.Int("max_retries", int(ruleWithPolicy.Rule.MaxRetries)),
				))
		}
	}

	// If no retry rules found, use default (maxRetries=0, no retries allowed)
	if len(retryRules) == 0 {
		span.AddEvent("No retry policy found, using default (maxRetries=0)")
		retryEvaluators = append(retryEvaluators, retry.NewEvaluator(c.store, nil))
	}

	return retryEvaluators
}
