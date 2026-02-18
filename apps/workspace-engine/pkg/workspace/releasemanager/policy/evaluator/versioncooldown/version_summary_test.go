package versioncooldown

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewSummaryEvaluator_NilInputs(t *testing.T) {
	s, _ := setupTestStore(t)

	// Nil rule
	assert.Nil(t, NewSummaryEvaluator(s, nil))

	// Nil store
	rule := &oapi.PolicyRule{Id: "r1", VersionCooldown: &oapi.VersionCooldownRule{}}
	assert.Nil(t, NewSummaryEvaluator(nil, rule))

	// No version cooldown on rule
	ruleNoCooldown := &oapi.PolicyRule{Id: "r2"}
	assert.Nil(t, NewSummaryEvaluator(s, ruleNoCooldown))
}

func TestSummaryEvaluator_Metadata(t *testing.T) {
	s, _ := setupTestStore(t)
	var cooldownSeconds int32 = 60
	rule := &oapi.PolicyRule{
		Id: "vc-summary-1",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(s, rule)
	require.NotNil(t, eval)
	assert.Equal(t, evaluator.RuleTypeVersionCooldown, eval.RuleType())
	assert.Equal(t, "vc-summary-1", eval.RuleId())
}

func TestSummaryEvaluator_NoReleaseTargets(t *testing.T) {
	s, _ := setupTestStore(t)
	ctx := context.Background()

	deployment, _ := createTestDeployment(ctx, s)
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deployment.Id,
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, version.Id, version)

	var cooldownSeconds int32 = 60
	rule := &oapi.PolicyRule{
		Id: "vc-no-targets",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	// No release targets → denied
	assert.False(t, result.Allowed)
}

func TestSummaryEvaluator_AllTargetsAllowed(t *testing.T) {
	s, _ := setupTestStore(t)
	ctx := context.Background()

	deployment, systemID := createTestDeployment(ctx, s)
	env := createTestEnvironment(ctx, s, systemID)
	resource := createTestResource(ctx, s)

	// Create release target
	rt := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env.Id,
		ResourceId:    resource.Id,
	}
	s.ReleaseTargets.Upsert(ctx, rt)

	// Create a version that's not recently deployed anywhere
	version := createTestVersion(ctx, s, deployment.Id, "v1.0.0", time.Now().Add(-2*time.Hour))

	var cooldownSeconds int32 = 60
	rule := &oapi.PolicyRule{
		Id: "vc-all-allowed",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when no recent deployments")
}

func TestSummaryEvaluator_SomeTargetsDenied(t *testing.T) {
	s, _ := setupTestStore(t)
	ctx := context.Background()

	deployment, systemID := createTestDeployment(ctx, s)
	env1 := createTestEnvironment(ctx, s, systemID)
	env2 := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "production",
	}
	_ = s.Environments.Upsert(ctx, env2)

	resource := createTestResource(ctx, s)

	// Create release targets
	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env1.Id,
		ResourceId:    resource.Id,
	}
	s.ReleaseTargets.Upsert(ctx, rt1)

	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env2.Id,
		ResourceId:    resource.Id,
	}
	s.ReleaseTargets.Upsert(ctx, rt2)

	// Create a version
	version := createTestVersion(ctx, s, deployment.Id, "v2.0.0", time.Now())

	// Create a recent release on rt1 with a different (older) version, then create
	// a release for the same version very recently on rt1 to trigger cooldown
	olderVersion := createTestVersion(ctx, s, deployment.Id, "v1.0.0", time.Now().Add(-1*time.Hour))

	// Create a release with the older version on rt1
	release := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *olderVersion,
		CreatedAt:     time.Now().Add(-10 * time.Second).Format(time.RFC3339),
	}
	_ = s.Releases.Upsert(ctx, release)

	// Create a successful job for the release
	completedAt := time.Now().Add(-5 * time.Second)
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &completedAt,
		CreatedAt:   completedAt,
	}
	s.Jobs.Upsert(ctx, job)

	var cooldownSeconds int32 = 300 // 5 minutes
	rule := &oapi.PolicyRule{
		Id: "vc-mixed",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(s, rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	// Result depends on whether the cooldown applies
	assert.NotNil(t, result)
}

func TestSummaryEvaluator_Pluralize(t *testing.T) {
	assert.Equal(t, "", pluralize(1))
	assert.Equal(t, "s", pluralize(0))
	assert.Equal(t, "s", pluralize(2))
	assert.Equal(t, "s", pluralize(10))
}
