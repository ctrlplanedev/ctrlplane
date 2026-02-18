package deployableversions

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &DeployableVersionStatusEvaluator{}

type DeployableVersionStatusEvaluator struct {
	store *store.Store
}

func NewEvaluator(store *store.Store) evaluator.Evaluator {
	if store == nil {
		return nil
	}
	return evaluator.WithMemoization(&DeployableVersionStatusEvaluator{
		store: store,
	})
}

// ScopeFields declares that this evaluator cares about Version and ReleaseTarget.
// ReleaseTarget is needed to check if paused versions have existing releases.
func (e *DeployableVersionStatusEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
}

// RuleType returns the rule type identifier for bypass matching.
func (e *DeployableVersionStatusEvaluator) RuleType() string {
	return evaluator.RuleTypeDeployableVersions
}

func (e *DeployableVersionStatusEvaluator) Complexity() int {
	return 1
}

func (e *DeployableVersionStatusEvaluator) RuleId() string {
	return "versionStatus"
}

// Evaluate checks if a version is in a deployable status.
// The memoization wrapper ensures Version and ReleaseTarget are present.
func (e *DeployableVersionStatusEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	version := scope.Version
	releaseTarget := scope.ReleaseTarget()

	if version.Status == oapi.DeploymentVersionStatusReady {
		return results.NewAllowedResult("Version is ready").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status)
	}

	if version.Status == oapi.DeploymentVersionStatusPaused {
		// Paused versions are "grandfathered in" - they can continue on targets
		// where they're already deployed, but cannot deploy to new targets.
		// Check if this paused version has an existing release for this target.
		releases := e.store.Releases.Items()
		for _, release := range releases {
			if release == nil {
				continue
			}

			if release.Version.Id != version.Id {
				continue
			}

			if release.ReleaseTarget.Key() != releaseTarget.Key() {
				continue
			}

			// Found an existing release - allow it to continue
			return results.NewAllowedResult("Version is paused but has an active release for this target").
				WithDetail("version_id", version.Id).
				WithDetail("version_status", version.Status).
				WithDetail("release_target", releaseTarget.Key())
		}

		// No existing release - deny deployment to new targets
		return results.NewDeniedResult("Version is paused and has no active release for this target").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status).
			WithDetail("release_target", releaseTarget.Key())
	}

	return results.NewDeniedResult("Version is not ready").
		WithDetail("version_id", version.Id).
		WithDetail("version_status", version.Status)
}
