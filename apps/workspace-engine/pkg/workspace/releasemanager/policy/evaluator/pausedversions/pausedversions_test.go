package pausedversions_test

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/pausedversions"
	"workspace-engine/pkg/workspace/store"
)

func TestPausedVersionsEvaluator_WithNewInterface(t *testing.T) {
	cs := statechange.NewChangeSet[any]()
	st := store.New(cs)

	// Create test data
	pausedVersion := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusPaused,
	}
	activeVersion := &oapi.DeploymentVersion{
		Id:     "v2.0.0",
		Status: oapi.DeploymentVersionStatusReady,
	}
	target := &oapi.ReleaseTarget{
		ResourceId:    "server-1",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	eval := pausedversions.New(st)
	ctx := context.Background()

	t.Run("active version is allowed", func(t *testing.T) {
		scope := evaluator.EvaluatorScope{
			Version:       activeVersion,
			ReleaseTarget: target,
		}

		result := eval.Evaluate(ctx, scope)
		if !result.Allowed {
			t.Errorf("expected allowed=true, got allowed=false")
		}
	})

	t.Run("paused version without release is denied", func(t *testing.T) {
		scope := evaluator.EvaluatorScope{
			Version:       pausedVersion,
			ReleaseTarget: target,
		}

		result := eval.Evaluate(ctx, scope)
		if result.Allowed {
			t.Errorf("expected allowed=false, got allowed=true")
		}
	})

	t.Run("paused version with existing release is allowed", func(t *testing.T) {
		// Add a release for the paused version and target
		release := &oapi.Release{
			Version:       *pausedVersion,
			ReleaseTarget: *target,
		}
		_ = st.Releases.Upsert(ctx, release)

		// Create a fresh evaluator for this test since the previous one is cached
		freshEval := pausedversions.New(st)

		scope := evaluator.EvaluatorScope{
			Version:       pausedVersion,
			ReleaseTarget: target,
		}

		result := freshEval.Evaluate(ctx, scope)
		if !result.Allowed {
			t.Errorf("expected allowed=true (has active release), got allowed=false")
		}
	})
}

func TestPausedVersionsEvaluator_MissingFields(t *testing.T) {
	cs := statechange.NewChangeSet[any]()
	st := store.New(cs)
	ctx := context.Background()

	eval := pausedversions.New(st)

	t.Run("missing version", func(t *testing.T) {
		scope := evaluator.EvaluatorScope{
			ReleaseTarget: &oapi.ReleaseTarget{
				ResourceId:    "server-1",
				EnvironmentId: "prod",
				DeploymentId:  "api",
			},
			// Version is nil
		}

		result := eval.Evaluate(ctx, scope)
		if result.Allowed {
			t.Errorf("expected allowed=false when version is missing")
		}
		if result.Message == "" {
			t.Errorf("expected error message about missing fields")
		}
	})

	t.Run("missing release target", func(t *testing.T) {
		scope := evaluator.EvaluatorScope{
			Version: &oapi.DeploymentVersion{
				Id:     "v1.0.0",
				Status: oapi.DeploymentVersionStatusPaused,
			},
			// ReleaseTarget is nil
		}

		result := eval.Evaluate(ctx, scope)
		if result.Allowed {
			t.Errorf("expected allowed=false when release target is missing")
		}
		if result.Message == "" {
			t.Errorf("expected error message about missing fields")
		}
	})
}

func TestPausedVersionsEvaluator_WithMemoization(t *testing.T) {
	cs := statechange.NewChangeSet[any]()
	st := store.New(cs)
	ctx := context.Background()

	pausedVersion := &oapi.DeploymentVersion{
		Id:     "v1.0.0",
		Status: oapi.DeploymentVersionStatusPaused,
	}
	target1 := &oapi.ReleaseTarget{
		ResourceId:    "server-1",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}
	target2 := &oapi.ReleaseTarget{
		ResourceId:    "server-2",
		EnvironmentId: "prod",
		DeploymentId:  "api",
	}

	eval := pausedversions.New(st)

	// Wrap with memoization - this evaluator cares about Version + ReleaseTarget
	memoized := evaluator.NewMemoized(
		eval,
		evaluator.ScopeVersion|evaluator.ScopeReleaseTarget,
	)

	// Evaluate with target1 - will execute
	scope1 := evaluator.EvaluatorScope{
		Version:       pausedVersion,
		ReleaseTarget: target1,
	}
	result1 := memoized.Evaluate(ctx, scope1)

	// Evaluate with target1 again - should hit cache
	result2 := memoized.Evaluate(ctx, scope1)
	if result1 != result2 {
		t.Errorf("expected same result instance (cached)")
	}

	// Evaluate with target2 - should NOT hit cache (different target)
	scope2 := evaluator.EvaluatorScope{
		Version:       pausedVersion,
		ReleaseTarget: target2,
	}
	result3 := memoized.Evaluate(ctx, scope2)
	if result1 == result3 {
		t.Errorf("expected different result instance (different target)")
	}

	// Verify results are correct
	if result1.Allowed || result2.Allowed || result3.Allowed {
		t.Errorf("all results should be denied (paused version with no releases)")
	}
}

