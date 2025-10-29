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
)

var tracer = otel.Tracer("workspace/releasemanager/policy/evaluator/environmentprogression")

var _ evaluator.EnvironmentAndVersionScopedEvaluator = &EnvironmentProgressionEvaluator{}

type EnvironmentProgressionEvaluator struct {
	store *store.Store
	rule  *oapi.EnvironmentProgressionRule
}

func NewEnvironmentProgressionEvaluator(
	store *store.Store,
	rule *oapi.EnvironmentProgressionRule,
) *EnvironmentProgressionEvaluator {
	return &EnvironmentProgressionEvaluator{
		store: store,
		rule:  rule,
	}
}

func (e *EnvironmentProgressionEvaluator) Evaluate(
	ctx context.Context,
	environment *oapi.Environment,
	version *oapi.DeploymentVersion,
) (*oapi.RuleEvaluation, error) {
	// Find dependency environments using the selector
	dependencyEnvs, err := e.findDependencyEnvironments(ctx, environment)
	if err != nil {
		return nil, fmt.Errorf("failed to find dependency environments: %w", err)
	}

	if len(dependencyEnvs) == 0 {
		return results.
			NewDeniedResult("No dependency environments found matching selector").
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", version.DeploymentId), nil
	}

	// Check if version succeeded in dependency environments
	result, err := e.checkDependencyEnvironments(
		ctx,
		version,
		dependencyEnvs,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to check dependency environments: %w", err)
	}

	if !result.Allowed {
		r := results.
			NewPendingResult(results.ActionTypeWait, result.Message).
			WithDetail("dependency_environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", version.DeploymentId)
		for key, detail := range result.Details {
			r.WithDetail(key, detail)
		}
		return r, nil
	}

	r := results.
		NewAllowedResult("Version succeeded in dependency environment(s)").
		WithDetail("dependency_environment_count", len(dependencyEnvs)).
		WithDetail("version_id", version.Id)

	for key, detail := range result.Details {
		r.WithDetail(key, detail)
	}
	return r, nil
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
) (*oapi.RuleEvaluation, error) {
	ctx, span := tracer.Start(ctx, "EnvironmentProgressionEvaluator.checkDependencyEnvironments")
	defer span.End()

	allowedResults := make(map[string]*oapi.RuleEvaluation)
	failedResults := make(map[string]*oapi.RuleEvaluation)

	for _, depEnv := range dependencyEnvs {
		result, err := e.evaluateJobSuccessCriteria(
			ctx,
			version,
			depEnv,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to evaluate job success criteria: %w", err)
		}

		if result.Allowed {
			allowedResults[depEnv.Id] = result
		} else {
			failedResults[depEnv.Id] = result
		}
	}

	if len(failedResults) > 0 {
		failureResult := results.NewDeniedResult("Version not successful in dependency environment(s)").
			WithDetail("environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id).
			WithDetail("failed_environments", len(failedResults))

		for envId, failedResult := range failedResults {
			failureResult.WithDetail(fmt.Sprintf("environment_%s", envId), failedResult.Details)
		}

		return failureResult, nil
	}

	successResult := results.
		NewAllowedResult("Version succeeded in dependency environment(s)").
		WithDetail("environment_count", len(dependencyEnvs))

	for envId, allowedResult := range allowedResults {
		successResult.WithDetail(fmt.Sprintf("environment_%s", envId), allowedResult.Details)
	}

	return successResult, nil
}

// evaluateJobSuccessCriteria evaluates if jobs meet the success criteria
func (e *EnvironmentProgressionEvaluator) evaluateJobSuccessCriteria(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	environment *oapi.Environment,
) (*oapi.RuleEvaluation, error) {
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

	tracker := NewReleaseTargetJobTracker(ctx, e.store, environment, version, successStatuses)

	if len(tracker.Jobs()) == 0 {
		return results.NewDeniedResult("No jobs found"), nil
	}

	if len(tracker.ReleaseTargets) == 0 {
		return results.NewDeniedResult("No release targets found"), nil
	}

	// Check minimum success percentage if specified
	if e.rule.MinimumSuccessPercentage != nil {
		sucessPercentage := tracker.GetSuccessPercentage()
		if sucessPercentage < *e.rule.MinimumSuccessPercentage {
			message := fmt.Sprintf("Success rate %.1f%% below required %.1f%%", sucessPercentage, *e.rule.MinimumSuccessPercentage)
			return results.NewDeniedResult(message).
				WithDetail("success_percentage", sucessPercentage).
				WithDetail("minimum_success_percentage", *e.rule.MinimumSuccessPercentage), nil
		}
	}

	// Check minimum soak time if specified
	if e.rule.MinimumSockTimeMinutes != nil && *e.rule.MinimumSockTimeMinutes > 0 {
		soakDuration := time.Duration(*e.rule.MinimumSockTimeMinutes) * time.Minute
		soakTimeRemaining := tracker.GetSoakTimeRemaining(soakDuration)
		if soakTimeRemaining > 0 {
			message := fmt.Sprintf("Soak time required: %d minutes. Time remaining: %s", *e.rule.MinimumSockTimeMinutes, soakTimeRemaining.Round(time.Minute))
			return results.NewPendingResult(results.ActionTypeWait, message).
				WithDetail("soak_time_remaining_minutes", int(soakTimeRemaining.Minutes())), nil
		}
	}

	// Check maximum age if specified
	if e.rule.MaximumAgeHours != nil && *e.rule.MaximumAgeHours > 0 {
		maxAge := time.Duration(*e.rule.MaximumAgeHours) * time.Hour

		latestSuccessTime := tracker.GetMostRecentSuccess()
		if latestSuccessTime.IsZero() {
			return results.NewDeniedResult("No successful jobs").
				WithDetail("maximum_age_hours", *e.rule.MaximumAgeHours), nil
		}

		if !tracker.IsWithinMaxAge(maxAge) {
			message := fmt.Sprintf(
				"Deployment too old: %s (max: %d hours)", latestSuccessTime.Sub(latestSuccessTime).Round(time.Hour),
				*e.rule.MaximumAgeHours,
			)
			return results.NewDeniedResult(message).
				WithDetail("latest_success_time", latestSuccessTime.Format(time.RFC3339)).
				WithDetail("maximum_age_hours", *e.rule.MaximumAgeHours), nil
		}
	}

	return results.NewAllowedResult("Job success criteria met"), nil
}
