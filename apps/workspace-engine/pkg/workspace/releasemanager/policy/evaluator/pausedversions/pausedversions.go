package pausedversions

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.VersionAndTargetScopedEvaluator = &PausedVersionsEvaluator{}

type PausedVersionsEvaluator struct {
	store *store.Store
}

func NewPausedVersionsEvaluator(store *store.Store) *PausedVersionsEvaluator {
	return &PausedVersionsEvaluator{
		store: store,
	}
}

func (e *PausedVersionsEvaluator) Evaluate(
	ctx context.Context,
	version *oapi.DeploymentVersion,
	releaseTarget *oapi.ReleaseTarget,
) (*oapi.RuleEvaluation, error) {
	if version.Status != oapi.DeploymentVersionStatusPaused {
		return results.NewAllowedResult("Version is not paused").
			WithDetail("version_id", version.Id).
			WithDetail("version_status", version.Status), nil
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
			WithDetail("release_target", releaseTarget.Key()), nil
	}

	return results.NewDeniedResult("Version is paused and has no active release for this target.").
		WithDetail("version_id", version.Id).
		WithDetail("version_status", version.Status).
		WithDetail("release_target", releaseTarget.Key()), nil
}