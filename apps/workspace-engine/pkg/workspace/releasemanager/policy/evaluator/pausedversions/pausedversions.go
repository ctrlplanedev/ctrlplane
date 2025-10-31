package pausedversions

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &PausedVersionsEvaluator{}

type PausedVersionsEvaluator struct {
	store *store.Store
}

func New(store *store.Store) evaluator.Evaluator {
	return evaluator.WithMemoization(&PausedVersionsEvaluator{store: store})
}

// ScopeFields declares that this evaluator cares about Version and ReleaseTarget.
func (e *PausedVersionsEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
}

// Evaluate checks if a paused version is allowed to deploy to a target.
// The memoization wrapper ensures Version and ReleaseTarget are present.
func (e *PausedVersionsEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	version := scope.Version
	releaseTarget := scope.ReleaseTarget

	if version.Status != oapi.DeploymentVersionStatusPaused {
		return results.NewAllowedResult("Version is not paused").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status)
	}

	// Check if any releases of the releaseTarget are linked to the version
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

		return results.NewAllowedResult("Version is paused but has an active release for this target.").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status).
			WithDetail("release_target", releaseTarget.Key())
	}

	return results.NewDeniedResult("Version is paused and has no active release for this target.").
		WithDetail("version_id", version.Id).
		WithDetail("version_status", version.Status).
		WithDetail("release_target", releaseTarget.Key())
}
