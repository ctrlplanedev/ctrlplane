package environmentprogression

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/environmentprogression")

var _ evaluator.Evaluator = &EnvironmentProgressionEvaluator{}

type EnvironmentProgressionEvaluator struct {
	store *store.Store
	rule  *oapi.EnvironmentProgressionRule
}

func NewEnvironmentProgressionEvaluator(
	store *store.Store,
	rule *oapi.PolicyRule,
) evaluator.Evaluator {
	if rule.EnvironmentProgression == nil {
		return nil
	}
	return evaluator.WithMemoization(&EnvironmentProgressionEvaluator{
		store: store,
		rule:  rule.EnvironmentProgression,
	})
}

// ScopeFields declares that this evaluator cares about Environment and Version.
func (e *EnvironmentProgressionEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeEnvironment | evaluator.ScopeVersion
}

// Evaluate checks if a version can progress to an environment based on its success in dependency environments.
// The memoization wrapper ensures Environment and Version are present.
func (e *EnvironmentProgressionEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	environment := scope.Environment
	version := scope.Version
	ctx, span := tracer.Start(ctx, "EnvironmentProgressionEvaluator.Evaluate")
	defer span.End()

	span.SetAttributes(attribute.String("environment.id", environment.Id))
	span.SetAttributes(attribute.String("version.id", version.Id))
	span.SetAttributes(attribute.String("rule", fmt.Sprintf("%+v", e.rule)))

	// Find dependency environments using the selector
	dependencyEnvs, err := e.findDependencyEnvironments(ctx, environment)
	if err != nil {
		span.SetStatus(codes.Error, "failed to find dependency environments")
		span.RecordError(err)
		return results.
			NewDeniedResult(fmt.Sprintf("Failed to find dependency environments: %v", err)).
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", version.DeploymentId)
	}

	span.SetAttributes(attribute.Int("dependency_environment_count", len(dependencyEnvs)))

	if len(dependencyEnvs) == 0 {
		return results.
			NewDeniedResult("No dependency environments found matching selector").
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", version.DeploymentId)
	}

	// Check if version succeeded in dependency environments
	result := e.checkDependencyEnvironments(
		ctx,
		version,
		dependencyEnvs,
	)

	if !result.Allowed {
		span.SetAttributes(attribute.Bool("result.allowed", false))
		r := results.
			NewPendingResult(results.ActionTypeWait, result.Message).
			WithDetail("dependency_environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", version.DeploymentId)
		for key, detail := range result.Details {
			r.WithDetail(key, detail)
		}
		return r
	}

	span.SetAttributes(attribute.Bool("result.allowed", true))

	r := results.
		NewAllowedResult("Version succeeded in dependency environment(s)").
		WithDetail("dependency_environment_count", len(dependencyEnvs)).
		WithDetail("version_id", version.Id)

	// Copy satisfiedAt from the dependency check result
	if result.SatisfiedAt != nil {
		r = r.WithSatisfiedAt(*result.SatisfiedAt)
	}

	for key, detail := range result.Details {
		r = r.WithDetail(key, detail)
	}
	return r
}

// findDependencyEnvironments finds all environments matching the selector
func (e *EnvironmentProgressionEvaluator) findDependencyEnvironments(
	ctx context.Context,
	environment *oapi.Environment,
) ([]*oapi.Environment, error) {
	var matchedEnvs []*oapi.Environment

	// Iterate through all environments
	envItems := e.store.Environments.Items()
	for _, env := range envItems {
		// By default, only check environments in the same system
		// This prevents accidental cross-system dependencies
		if env.SystemId != environment.SystemId {
			continue
		}

		// Don't depend on the same environment
		if env.Id == environment.Id {
			continue
		}

		// Apply the selector
		matched, err := selector.Match(ctx, &e.rule.DependsOnEnvironmentSelector, *env)
		if err != nil {
			return nil, fmt.Errorf("failed to match environment selector: %w", err)
		}

		if matched {
			matchedEnvs = append(matchedEnvs, env)
		}
	}

	return matchedEnvs, nil
}

// checkDependencyEnvironments checks if version succeeded in the dependency environments
func (e *EnvironmentProgressionEvaluator) checkDependencyEnvironments(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	dependencyEnvs []*oapi.Environment,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "EnvironmentProgressionEvaluator.checkDependencyEnvironments")
	defer span.End()

	allowedResults := make(map[string]*oapi.RuleEvaluation)
	failedResults := make(map[string]*oapi.RuleEvaluation)

	// Define success statuses (default to just "successful")
	successStatuses := map[oapi.JobStatus]bool{
		oapi.Successful: true,
	}
	if e.rule.SuccessStatuses != nil {
		successStatuses = make(map[oapi.JobStatus]bool)
		for _, status := range *e.rule.SuccessStatuses {
			successStatuses[status] = true
		}
	}

	// Set up pass rate evaluator
	var minSuccessPercentage float32 = 0.0 // Default: require at least one successful job (> 0%)
	if e.rule.MinimumSuccessPercentage != nil {
		minSuccessPercentage = *e.rule.MinimumSuccessPercentage
	}
	passRateEvaluator := NewPassRateEvaluator(e.store, minSuccessPercentage, successStatuses)

	// Set up soak time evaluator
	var soakTimeEvaluator evaluator.Evaluator
	if e.rule.MinimumSockTimeMinutes != nil && *e.rule.MinimumSockTimeMinutes > 0 {
		soakTimeEvaluator = NewSoakTimeEvaluator(e.store, *e.rule.MinimumSockTimeMinutes, successStatuses)
	}

	for _, depEnv := range dependencyEnvs {
		result := e.evaluateJobSuccessCriteria(
			ctx,
			version,
			depEnv,
			passRateEvaluator,
			soakTimeEvaluator,
		)

		if result.Allowed {
			allowedResults[depEnv.Id] = result
		} else {
			failedResults[depEnv.Id] = result
		}
	}

	// OR logic: If at least one dependency environment succeeded, allow progression
	if len(allowedResults) > 0 {
		successResult := results.
			NewAllowedResult("Version succeeded in dependency environment(s)").
			WithDetail("environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id).
			WithDetail("successful_environments", len(allowedResults))

		for envId, allowedResult := range allowedResults {
			successResult = successResult.WithDetail(fmt.Sprintf("environment_%s", envId), allowedResult.Details)
			// Use the earliest satisfiedAt time from any successful environment
			if allowedResult.SatisfiedAt != nil {
				if successResult.SatisfiedAt == nil || allowedResult.SatisfiedAt.Before(*successResult.SatisfiedAt) {
					successResult = successResult.WithSatisfiedAt(*allowedResult.SatisfiedAt)
				}
			}
		}

		return successResult
	}

	// All dependency environments failed
	if len(failedResults) > 0 {
		failureResult := results.NewDeniedResult("Version not successful in any dependency environment").
			WithDetail("environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id).
			WithDetail("failed_environments", len(failedResults))

		for envId, failedResult := range failedResults {
			failureResult.WithDetail(fmt.Sprintf("environment_%s", envId), failedResult.Details)
		}

		return failureResult
	}

	// Should never reach here
	return results.NewDeniedResult("No dependency environments found")
}

// evaluateJobSuccessCriteria evaluates if jobs meet the success criteria by combining
// pass rate and soak time evaluators.
func (e *EnvironmentProgressionEvaluator) evaluateJobSuccessCriteria(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	environment *oapi.Environment,
	passRateEvaluator evaluator.Evaluator,
	soakTimeEvaluator evaluator.Evaluator,
) *oapi.RuleEvaluation {
	ctx, span := tracer.Start(ctx, "EnvironmentProgressionEvaluator.evaluateJobSuccessCriteria")
	defer span.End()

	scope := evaluator.EvaluatorScope{
		Environment: environment,
		Version:     version,
	}

	// Check if there are jobs and release targets
	tracker := NewReleaseTargetJobTracker(ctx, e.store, environment, version, nil)
	span.SetAttributes(attribute.Int("job_count", len(tracker.Jobs())))
	span.SetAttributes(attribute.Int("release_target_count", len(tracker.ReleaseTargets)))

	if len(tracker.Jobs()) == 0 {
		return results.NewDeniedResult("No jobs found")
	}

	if len(tracker.ReleaseTargets) == 0 {
		return results.NewDeniedResult("No release targets found")
	}

	passRateResult := passRateEvaluator.Evaluate(ctx, scope)
	span.SetAttributes(attribute.Bool("pass_rate.allowed", passRateResult.Allowed))
	if !passRateResult.Allowed {
		return passRateResult
	}


	// Evaluate soak time requirement
	var soakTimeResult *oapi.RuleEvaluation
	if soakTimeEvaluator != nil {
		soakTimeResult = soakTimeEvaluator.Evaluate(ctx, scope)
		span.SetAttributes(attribute.Bool("soak_time.allowed", soakTimeResult.Allowed))
		if !soakTimeResult.Allowed {
			return soakTimeResult
		}
	}

	// Both requirements met (or only one was required)
	// Combine results and determine the satisfiedAt time
	var satisfiedAt *time.Time
	if passRateResult != nil && passRateResult.SatisfiedAt != nil {
		satisfiedAt = passRateResult.SatisfiedAt
	}
	if soakTimeResult != nil && soakTimeResult.SatisfiedAt != nil {
		if satisfiedAt == nil || soakTimeResult.SatisfiedAt.After(*satisfiedAt) {
			// Use the later of the two times (both must be satisfied)
			satisfiedAt = soakTimeResult.SatisfiedAt
		}
	}

	result := results.NewAllowedResult("Job success criteria met")
	if satisfiedAt != nil {
		result = result.WithSatisfiedAt(*satisfiedAt)
	}

	// Merge details from both evaluators
	if passRateResult != nil {
		for key, value := range passRateResult.Details {
			result = result.WithDetail(key, value)
		}
	}
	if soakTimeResult != nil {
		for key, value := range soakTimeResult.Details {
			result = result.WithDetail(key, value)
		}
	}

	return result
}
