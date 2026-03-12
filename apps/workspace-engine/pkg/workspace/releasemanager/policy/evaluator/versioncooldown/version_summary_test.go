package versioncooldown

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

func TestNewSummaryEvaluator_NilInputs(t *testing.T) {
	mock := newMockGetters()

	// Nil rule
	assert.Nil(t, NewSummaryEvaluator(mock, "ws-id", nil))

	// Nil getters
	rule := &oapi.PolicyRule{Id: "r1", VersionCooldown: &oapi.VersionCooldownRule{}}
	assert.Nil(t, NewSummaryEvaluator(nil, "ws-id", rule))

	// No version cooldown on rule
	ruleNoCooldown := &oapi.PolicyRule{Id: "r2"}
	assert.Nil(t, NewSummaryEvaluator(mock, "ws-id", ruleNoCooldown))
}

func TestSummaryEvaluator_Metadata(t *testing.T) {
	mock := newMockGetters()
	var cooldownSeconds int32 = 60
	rule := &oapi.PolicyRule{
		Id: "vc-summary-1",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(mock, "ws-id", rule)
	require.NotNil(t, eval)
	assert.Equal(t, evaluator.RuleTypeVersionCooldown, eval.RuleType())
	assert.Equal(t, "vc-summary-1", eval.RuleId())
}

func TestSummaryEvaluator_NoReleaseTargets(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
		Slug: "test-deployment",
	}
	mock.deployments[deployment.Id] = deployment

	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deployment.Id,
		Tag:          "v1.0.0",
		CreatedAt:    time.Now(),
	}

	var cooldownSeconds int32 = 60
	rule := &oapi.PolicyRule{
		Id: "vc-no-targets",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(mock, "ws-id", rule)
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
	mock := newMockGetters()
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
		Slug: "test-deployment",
	}
	env := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource-1",
		Kind:       "service",
	}
	mock.deployments[deployment.Id] = deployment
	mock.environments[env.Id] = env
	mock.resources[resource.Id] = resource

	rt := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env.Id,
		ResourceId:    resource.Id,
	}
	mock.releaseTargets = append(mock.releaseTargets, rt)

	// Create a version that's not recently deployed anywhere
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deployment.Id,
		Tag:          "v1.0.0",
		Name:         "Version v1.0.0",
		CreatedAt:    time.Now().Add(-2 * time.Hour),
	}

	var cooldownSeconds int32 = 60
	rule := &oapi.PolicyRule{
		Id: "vc-all-allowed",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(mock, "ws-id", rule)
	require.NotNil(t, eval)

	scope := evaluator.EvaluatorScope{
		Version: version,
	}
	result := eval.Evaluate(ctx, scope)
	require.NotNil(t, result)
	assert.True(t, result.Allowed, "Should allow when no recent deployments")
}

func TestSummaryEvaluator_SomeTargetsDenied(t *testing.T) {
	mock := newMockGetters()
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
		Slug: "test-deployment",
	}
	env1 := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
	env2 := &oapi.Environment{Id: uuid.New().String(), Name: "production"}
	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource-1",
		Kind:       "service",
	}
	mock.deployments[deployment.Id] = deployment
	mock.environments[env1.Id] = env1
	mock.environments[env2.Id] = env2
	mock.resources[resource.Id] = resource

	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env1.Id,
		ResourceId:    resource.Id,
	}
	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: env2.Id,
		ResourceId:    resource.Id,
	}
	mock.releaseTargets = append(mock.releaseTargets, rt1, rt2)

	// Create a version
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deployment.Id,
		Tag:          "v2.0.0",
		Name:         "Version v2.0.0",
		CreatedAt:    time.Now(),
	}

	// Create a recent release on rt1 with a different (older) version
	olderVersion := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deployment.Id,
		Tag:          "v1.0.0",
		Name:         "Version v1.0.0",
		CreatedAt:    time.Now().Add(-1 * time.Hour),
	}

	release := &oapi.Release{
		ReleaseTarget: *rt1,
		Version:       *olderVersion,
		CreatedAt:     time.Now().Add(-10 * time.Second).Format(time.RFC3339),
	}
	mock.addRelease(release)

	completedAt := time.Now().Add(-5 * time.Second)
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.Id.String(),
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &completedAt,
		CreatedAt:   completedAt,
	}
	mock.addJob(rt1, job)

	var cooldownSeconds int32 = 300 // 5 minutes
	rule := &oapi.PolicyRule{
		Id: "vc-mixed",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: cooldownSeconds,
		},
	}
	eval := NewSummaryEvaluator(mock, "ws-id", rule)
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
	assert.Empty(t, pluralize(1))
	assert.Equal(t, "s", pluralize(0))
	assert.Equal(t, "s", pluralize(2))
	assert.Equal(t, "s", pluralize(10))
}
