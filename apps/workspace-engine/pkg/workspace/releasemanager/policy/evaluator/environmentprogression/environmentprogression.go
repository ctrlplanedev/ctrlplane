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

var _ evaluator.VersionScopedEvaluator = &EnvironmentProgressionEvaluator{}

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
	releaseTarget *oapi.ReleaseTarget,
	version *oapi.DeploymentVersion,
) (*oapi.RuleEvaluation, error) {
	// Find dependency environments using the selector
	dependencyEnvs, err := e.findDependencyEnvironments(ctx, releaseTarget)
	if err != nil {
		return nil, fmt.Errorf("failed to find dependency environments: %w", err)
	}

	if len(dependencyEnvs) == 0 {
		return results.
			NewDeniedResult("No dependency environments found matching selector").
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", releaseTarget.DeploymentId).
			WithDetail("resource_id", releaseTarget.ResourceId), nil
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
			WithDetail("deployment_id", releaseTarget.DeploymentId).
			WithDetail("resource_id", releaseTarget.ResourceId)
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
	releaseTarget *oapi.ReleaseTarget,
) ([]*oapi.Environment, error) {
	var matchedEnvs []*oapi.Environment

	// Get the current environment to determine system scope
	currentEnv, exists := e.store.Environments.Get(releaseTarget.EnvironmentId)
	if !exists {
		return nil, fmt.Errorf("current environment not found: %s", releaseTarget.EnvironmentId)
	}

	// Iterate through all environments
	envItems := e.store.Environments.Items()
	for _, env := range envItems {
		// By default, only check environments in the same system
		// This prevents accidental cross-system dependencies
		if env.SystemId != currentEnv.SystemId {
			continue
		}

		// Don't depend on the same environment
		if env.Id == releaseTarget.EnvironmentId {
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

	var allowedResults []*oapi.RuleEvaluation
	var failedResults []*oapi.RuleEvaluation

	for _, depEnv := range dependencyEnvs {
		result, err := e.checkSingleEnvironment(
			ctx,
			depEnv,
			version,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to check single environment: %w", err)
		}

		if result.Allowed {
			allowedResults = append(allowedResults, result)
			continue
		}
		failedResults = append(failedResults, result)
	}

	// By default, we require any dependency environment to succeed (OR logic)
	// This is useful for regional deployments where you need it in ANY staging region
	if len(allowedResults) > 0 {
		// Use the first allowed result and add aggregate details
		result := allowedResults[0]
		return result.
			WithDetail("dependency_environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id), nil
	}

	// All dependency environments failed
	if len(failedResults) == 0 {
		return results.NewDeniedResult("Version has not been deployed to any dependency environment").
			WithDetail("dependency_environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id), nil
	}

	// Merge all failed results - collect messages and details from the first pending/denied result
	var failureMessages []string
	var mergedResult *oapi.RuleEvaluation
	
	for _, failedResult := range failedResults {
		envName := ""
		if name, ok := failedResult.Details["environment_name"].(string); ok {
			envName = name
		}
		failureMessages = append(failureMessages, fmt.Sprintf("%s: %s", envName, failedResult.Message))
		
		// Use the first result as the base (preserves things like soak_finish_time)
		if mergedResult == nil {
			mergedResult = failedResult
		}
	}
	
	// Update the message with all failure reasons
	mergedResult.Message = fmt.Sprintf(
		"Version not successful in dependency environment(s): %v",
		failureMessages,
	)
	
	return mergedResult.
		WithDetail("dependency_environment_count", len(dependencyEnvs)).
		WithDetail("version_id", version.Id), nil
}

// checkSingleEnvironment checks if the version succeeded in a single environment
func (e *EnvironmentProgressionEvaluator) checkSingleEnvironment(
	_ context.Context,
	depEnv *oapi.Environment,
	version *oapi.DeploymentVersion,
) (*oapi.RuleEvaluation, error) {

	jobs := make([]*oapi.Job, 0)
	for _, job := range e.store.Jobs.Items() {
		release, exists := e.store.Releases.Get(job.ReleaseId)
		if !exists {
			continue
		}
		if release.Version.Id == version.Id && release.ReleaseTarget.EnvironmentId == depEnv.Id {
			jobs = append(jobs, job)
		}
	}

	if len(jobs) == 0 {
		return results.NewDeniedResult("Version not deployed yet").
			WithDetail("environment_name", depEnv.Name).
			WithDetail("environment_id", depEnv.Id), nil
	}

	// Check success criteria based on rule configuration
	result, err := e.evaluateJobSuccessCriteria(jobs)
	if err != nil {
		return nil, err
	}
	
	// Add environment context to the result
	return result.
		WithDetail("environment_name", depEnv.Name).
		WithDetail("environment_id", depEnv.Id), nil
}

// evaluateJobSuccessCriteria evaluates if jobs meet the success criteria
func (e *EnvironmentProgressionEvaluator) evaluateJobSuccessCriteria(
	jobs []*oapi.Job,
) (*oapi.RuleEvaluation, error) {
	if len(jobs) == 0 {
		return results.NewDeniedResult("No jobs found"), nil
	}

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

	// Count successful jobs and find the latest success time
	var successfulJobs int
	var latestSuccessTime *time.Time

	for _, job := range jobs {
		if successStatuses[job.Status] {
			successfulJobs++
			if job.CompletedAt != nil {
				if latestSuccessTime == nil || job.CompletedAt.After(*latestSuccessTime) {
					latestSuccessTime = job.CompletedAt
				}
			}
		}
	}

	// Check minimum success percentage if specified
	if e.rule.MinimumSuccessPercentage != nil {
		successPercentage := float32(successfulJobs) / float32(len(jobs)) * 100
		if successPercentage < *e.rule.MinimumSuccessPercentage {
			return results.NewDeniedResult(fmt.Sprintf(
				"Success rate %.1f%% below required %.1f%%",
				successPercentage,
				*e.rule.MinimumSuccessPercentage,
			)), nil
		}
	} else {
		// Default: require at least one successful job
		if successfulJobs == 0 {
			return results.NewDeniedResult("No successful jobs"), nil
		}
	}

	// Check minimum soak time if specified
	if e.rule.MinimumSockTimeMinutes != nil && *e.rule.MinimumSockTimeMinutes > 0 && latestSuccessTime != nil {
		soakDuration := time.Duration(*e.rule.MinimumSockTimeMinutes) * time.Minute
		timeSinceSuccess := time.Since(*latestSuccessTime)

		if timeSinceSuccess < soakDuration {
			remaining := soakDuration - timeSinceSuccess
			soakFinishTime := latestSuccessTime.Add(soakDuration)
			
			return results.NewPendingResult(results.ActionTypeWait, fmt.Sprintf(
				"Soak time required: %d minutes. Time remaining: %s",
				*e.rule.MinimumSockTimeMinutes,
				remaining.Round(time.Minute),
			)).
				WithDetail("soak_finish_time", soakFinishTime.Format(time.RFC3339)).
				WithDetail("soak_time_remaining_minutes", int(remaining.Minutes())), nil
		}
	}

	// Check maximum age if specified
	if e.rule.MaximumAgeHours != nil && *e.rule.MaximumAgeHours > 0 && latestSuccessTime != nil {
		maxAge := time.Duration(*e.rule.MaximumAgeHours) * time.Hour
		timeSinceSuccess := time.Since(*latestSuccessTime)

		if timeSinceSuccess > maxAge {
			return results.NewDeniedResult(fmt.Sprintf(
				"Deployment too old: %s (max: %d hours)",
				timeSinceSuccess.Round(time.Hour),
				*e.rule.MaximumAgeHours,
			)), nil
		}
	}

	return results.NewAllowedResult("Job success criteria met"), nil
}
