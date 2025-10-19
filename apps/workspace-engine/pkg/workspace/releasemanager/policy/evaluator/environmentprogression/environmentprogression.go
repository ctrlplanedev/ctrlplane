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
)

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
	satisfied, reason, err := e.checkDependencyEnvironments(
		ctx,
		version,
		releaseTarget,
		dependencyEnvs,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to check dependency environments: %w", err)
	}

	if !satisfied {
		return results.
			NewPendingResult(results.ActionTypeWait, reason).
			WithDetail("dependency_environment_count", len(dependencyEnvs)).
			WithDetail("version_id", version.Id).
			WithDetail("deployment_id", releaseTarget.DeploymentId).
			WithDetail("resource_id", releaseTarget.ResourceId), nil
	}

	return results.
		NewAllowedResult("Version succeeded in dependency environment(s)").
		WithDetail("dependency_environment_count", len(dependencyEnvs)).
		WithDetail("version_id", version.Id), nil
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
	releaseTarget *oapi.ReleaseTarget,
	dependencyEnvs []*oapi.Environment,
) (bool, string, error) {
	var satisfiedCount int
	var failureReasons []string

	for _, depEnv := range dependencyEnvs {
		satisfied, reason, err := e.checkSingleEnvironment(
			ctx,
			depEnv,
			version,
			releaseTarget,
		)
		if err != nil {
			return false, "", err
		}

		if satisfied {
			satisfiedCount++
		} else {
			failureReasons = append(failureReasons, fmt.Sprintf("%s: %s", depEnv.Name, reason))
		}
	}

	// By default, we require any dependency environment to succeed (OR logic)
	// This is useful for regional deployments where you need it in ANY staging region
	if satisfiedCount > 0 {
		return true, "", nil
	}

	// All dependency environments failed
	if len(failureReasons) == 0 {
		return false, "Version has not been deployed to any dependency environment", nil
	}

	return false, fmt.Sprintf(
		"Version not successful in dependency environment(s): %v",
		failureReasons,
	), nil
}

// checkSingleEnvironment checks if the version succeeded in a single environment
func (e *EnvironmentProgressionEvaluator) checkSingleEnvironment(
	ctx context.Context,
	depEnv *oapi.Environment,
	version *oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) (bool, string, error) {
	// Construct the release target for the dependency environment
	depReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    releaseTarget.ResourceId,
		EnvironmentId: depEnv.Id,
		DeploymentId:  releaseTarget.DeploymentId,
	}

	// Get jobs for this release target
	jobs := e.store.Jobs.GetJobsForReleaseTarget(depReleaseTarget)
	if len(jobs) == 0 {
		return false, "No jobs found", nil
	}

	// Filter jobs for this specific version
	var versionJobs []*oapi.Job
	for _, job := range jobs {
		// Check if this job is for our version by checking the release
		// Jobs are linked to releases which are linked to versions
		release, exists := e.store.Releases.Get(job.ReleaseId)
		if !exists {
			continue
		}

		if release.Version.Id == version.Id {
			versionJobs = append(versionJobs, job)
		}
	}

	if len(versionJobs) == 0 {
		return false, "Version not deployed yet", nil
	}

	// Check success criteria based on rule configuration
	return e.evaluateJobSuccessCriteria(versionJobs, depEnv)
}

// evaluateJobSuccessCriteria evaluates if jobs meet the success criteria
func (e *EnvironmentProgressionEvaluator) evaluateJobSuccessCriteria(
	jobs []*oapi.Job,
	depEnv *oapi.Environment,
) (bool, string, error) {
	if len(jobs) == 0 {
		return false, "No jobs found", nil
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
			return false, fmt.Sprintf(
				"Success rate %.1f%% below required %.1f%%",
				successPercentage,
				*e.rule.MinimumSuccessPercentage,
			), nil
		}
	} else {
		// Default: require at least one successful job
		if successfulJobs == 0 {
			return false, "No successful jobs", nil
		}
	}

	// Check minimum soak time if specified
	if e.rule.MinimumSockTimeMinutes != nil && *e.rule.MinimumSockTimeMinutes > 0 && latestSuccessTime != nil {
		soakDuration := time.Duration(*e.rule.MinimumSockTimeMinutes) * time.Minute
		timeSinceSuccess := time.Since(*latestSuccessTime)

		if timeSinceSuccess < soakDuration {
			remaining := soakDuration - timeSinceSuccess
			return false, fmt.Sprintf(
				"Soak time required: %d minutes. Time remaining: %s",
				*e.rule.MinimumSockTimeMinutes,
				remaining.Round(time.Minute),
			), nil
		}
	}

	// Check maximum age if specified
	if e.rule.MaximumAgeHours != nil && *e.rule.MaximumAgeHours > 0 && latestSuccessTime != nil {
		maxAge := time.Duration(*e.rule.MaximumAgeHours) * time.Hour
		timeSinceSuccess := time.Since(*latestSuccessTime)

		if timeSinceSuccess > maxAge {
			return false, fmt.Sprintf(
				"Deployment too old: %s (max: %d hours)",
				timeSinceSuccess.Round(time.Hour),
				*e.rule.MaximumAgeHours,
			), nil
		}
	}

	return true, "", nil
}
