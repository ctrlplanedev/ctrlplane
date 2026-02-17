package versioncooldown

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestStore(t *testing.T) (*store.Store, context.Context) {
	t.Helper()
	ctx := context.Background()
	sc := statechange.NewChangeSet[any]()
	s := store.New("test-workspace", sc)
	return s, ctx
}

func createTestDeployment(ctx context.Context, s *store.Store) (*oapi.Deployment, string) {
	systemID := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:   uuid.New().String(),
		Name: "test-deployment",
		Slug: "test-deployment",
	}
	_ = s.Deployments.Upsert(ctx, deployment)
	return deployment, systemID
}

func createTestEnvironment(ctx context.Context, s *store.Store, systemID string) *oapi.Environment {
	env := &oapi.Environment{
		Id:   uuid.New().String(),
		Name: "staging",
	}
	_ = s.Environments.Upsert(ctx, env)
	return env
}

func createTestResource(ctx context.Context, s *store.Store) *oapi.Resource {
	resource := &oapi.Resource{
		Id:         uuid.New().String(),
		Identifier: "test-resource-1",
		Kind:       "service",
	}
	_, _ = s.Resources.Upsert(ctx, resource)
	return resource
}

func createTestVersion(ctx context.Context, s *store.Store, deploymentID string, tag string, createdAt time.Time) *oapi.DeploymentVersion {
	version := &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		DeploymentId: deploymentID,
		Tag:          tag,
		Name:         "Version " + tag,
		CreatedAt:    createdAt,
	}
	s.DeploymentVersions.Upsert(ctx, version.Id, version)
	return version
}

func createTestReleaseTarget(ctx context.Context, s *store.Store, deployment *oapi.Deployment, environment *oapi.Environment, resource *oapi.Resource) *oapi.ReleaseTarget {
	rt := &oapi.ReleaseTarget{
		DeploymentId:  deployment.Id,
		EnvironmentId: environment.Id,
		ResourceId:    resource.Id,
	}
	s.ReleaseTargets.Upsert(ctx, rt)
	return rt
}

func createTestRelease(ctx context.Context, s *store.Store, rt *oapi.ReleaseTarget, version *oapi.DeploymentVersion) *oapi.Release {
	release := &oapi.Release{
		ReleaseTarget: *rt,
		Version:       *version,
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = s.Releases.Upsert(ctx, release)
	return release
}

func createSuccessfulJob(ctx context.Context, s *store.Store, release *oapi.Release) *oapi.Job {
	completedAt := time.Now()
	job := &oapi.Job{
		Id:          uuid.New().String(),
		ReleaseId:   release.ID(),
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &completedAt,
		CreatedAt:   time.Now(),
	}
	s.Jobs.Upsert(ctx, job)
	return job
}

func TestNewEvaluator(t *testing.T) {
	s, _ := setupTestStore(t)

	t.Run("returns nil when policyRule is nil", func(t *testing.T) {
		eval := NewEvaluator(s, nil)
		assert.Nil(t, eval)
	})

	t.Run("returns nil when versionCooldown is nil", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "test-rule",
		}
		eval := NewEvaluator(s, rule)
		assert.Nil(t, eval)
	})

	t.Run("returns nil when store is nil", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600,
			},
		}
		eval := NewEvaluator(nil, rule)
		assert.Nil(t, eval)
	})

	t.Run("returns evaluator when all parameters are valid", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600,
			},
		}
		eval := NewEvaluator(s, rule)
		assert.NotNil(t, eval)
	})
}

func TestVersionCooldownEvaluator_ScopeFields(t *testing.T) {
	s, _ := setupTestStore(t)
	rule := &oapi.PolicyRule{
		Id: "test-rule",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: 3600,
		},
	}

	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)

	// The evaluator needs Version and ReleaseTarget
	expectedFields := evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
	assert.Equal(t, expectedFields, eval.ScopeFields())
}

func TestVersionCooldownEvaluator_RuleType(t *testing.T) {
	s, _ := setupTestStore(t)
	rule := &oapi.PolicyRule{
		Id: "test-rule",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: 3600,
		},
	}

	eval := NewEvaluator(s, rule)
	require.NotNil(t, eval)
	assert.Equal(t, evaluator.RuleTypeVersionCooldown, eval.RuleType())
}

func TestVersionCooldownEvaluator_Evaluate(t *testing.T) {
	t.Run("allows first deployment when no previous release exists", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)
		version := createTestVersion(ctx, s, deployment.Id, "v1.0.0", time.Now())

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "First deployment should be allowed")
		assert.Contains(t, result.Message, "No previous version deployed")
	})

	t.Run("allows redeploy of the same version", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		// Create a version and deploy it
		version := createTestVersion(ctx, s, deployment.Id, "v1.0.0", time.Now())
		release := createTestRelease(ctx, s, releaseTarget, version)
		createSuccessfulJob(ctx, s, release)

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		// Try to deploy the same version again
		scope := evaluator.EvaluatorScope{
			Version:     version,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "Redeploy of same version should be allowed")
		assert.Contains(t, result.Message, "Same version as currently deployed")
	})

	t.Run("denies version when not enough time has elapsed since current version", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		// v1.0 created 30 minutes ago, deployed
		baseTime := time.Now().Add(-30 * time.Minute)
		v1 := createTestVersion(ctx, s, deployment.Id, "v1.0.0", baseTime)
		release := createTestRelease(ctx, s, releaseTarget, v1)
		createSuccessfulJob(ctx, s, release)

		// v1.1 created 20 minutes after v1.0 (10 minutes ago)
		v1_1 := createTestVersion(ctx, s, deployment.Id, "v1.1.0", baseTime.Add(20*time.Minute))

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour required
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		scope := evaluator.EvaluatorScope{
			Version:     v1_1,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		result := eval.Evaluate(ctx, scope)
		assert.False(t, result.Allowed, "Version should be denied when not enough time has elapsed")
		assert.Contains(t, result.Message, "Version cooldown")
		assert.Contains(t, result.Message, "remaining")
	})

	t.Run("allows version when enough time has elapsed since current version", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		// v1.0 created 2 hours ago, deployed
		baseTime := time.Now().Add(-2 * time.Hour)
		v1 := createTestVersion(ctx, s, deployment.Id, "v1.0.0", baseTime)
		release := createTestRelease(ctx, s, releaseTarget, v1)
		createSuccessfulJob(ctx, s, release)

		// v1.1 created 30 minutes after v1.0 (1.5 hours ago)
		// Even though v1.1 was created soon after v1.0, enough time has elapsed since v1.0 was created
		v1_1 := createTestVersion(ctx, s, deployment.Id, "v1.1.0", baseTime.Add(30*time.Minute))

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour required
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		scope := evaluator.EvaluatorScope{
			Version:     v1_1,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "Version should be allowed when enough time has elapsed")
		assert.Contains(t, result.Message, "Version cooldown passed")
		assert.Contains(t, result.Message, "has elapsed")
	})

	t.Run("allows version created exactly at interval boundary", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		baseTime := time.Now().Add(-2 * time.Hour)

		// v1.0 created at baseTime, deployed
		v1 := createTestVersion(ctx, s, deployment.Id, "v1.0.0", baseTime)
		release := createTestRelease(ctx, s, releaseTarget, v1)
		createSuccessfulJob(ctx, s, release)

		// v1.1 created exactly 1 hour after v1.0
		v1_1 := createTestVersion(ctx, s, deployment.Id, "v1.1.0", baseTime.Add(1*time.Hour))

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour required
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		scope := evaluator.EvaluatorScope{
			Version:     v1_1,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "Version created at exact interval should be allowed")
	})

	t.Run("batches rapid releases correctly", func(t *testing.T) {
		// Simulates the main use case: external app releases v1.1, v1.2, v1.3 rapidly
		// All should be allowed once enough time has elapsed since v1.0 was created
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		// v1.0 deployed 2 hours ago
		baseTime := time.Now().Add(-2 * time.Hour)
		v1_0 := createTestVersion(ctx, s, deployment.Id, "v1.0.0", baseTime)
		release := createTestRelease(ctx, s, releaseTarget, v1_0)
		createSuccessfulJob(ctx, s, release)

		// Rapid releases (all created within 70 minutes of v1.0)
		v1_1 := createTestVersion(ctx, s, deployment.Id, "v1.1.0", baseTime.Add(20*time.Minute)) // +20min
		v1_2 := createTestVersion(ctx, s, deployment.Id, "v1.2.0", baseTime.Add(40*time.Minute)) // +40min
		v1_3 := createTestVersion(ctx, s, deployment.Id, "v1.3.0", baseTime.Add(70*time.Minute)) // +70min

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		// All versions should be allowed since 2 hours have passed since v1.0 was created
		// (even though they were created rapidly after v1.0)
		scope := func(v *oapi.DeploymentVersion) evaluator.EvaluatorScope {
			return evaluator.EvaluatorScope{
				Version:     v,
				Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
				Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
				Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
			}
		}
		result := eval.Evaluate(ctx, scope(v1_1))
		assert.True(t, result.Allowed, "v1.1 should be allowed (enough time has elapsed)")

		result = eval.Evaluate(ctx, scope(v1_2))
		assert.True(t, result.Allowed, "v1.2 should be allowed (enough time has elapsed)")

		result = eval.Evaluate(ctx, scope(v1_3))
		assert.True(t, result.Allowed, "v1.3 should be allowed (enough time has elapsed)")
	})

	t.Run("uses in-progress deployment version for cooldown", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		// v1.0 successfully deployed 3 hours ago
		baseTime := time.Now().Add(-3 * time.Hour)
		v1_0 := createTestVersion(ctx, s, deployment.Id, "v1.0.0", baseTime)
		release1 := createTestRelease(ctx, s, releaseTarget, v1_0)
		createSuccessfulJob(ctx, s, release1)

		// v1.1 is in progress (created 30min after v1.0, so 2.5 hours ago)
		v1_1 := createTestVersion(ctx, s, deployment.Id, "v1.1.0", baseTime.Add(30*time.Minute))
		release2 := createTestRelease(ctx, s, releaseTarget, v1_1)
		// Create in-progress job (no completedAt)
		inProgressJob := &oapi.Job{
			Id:        uuid.New().String(),
			ReleaseId: release2.ID(),
			Status:    oapi.JobStatusInProgress,
			CreatedAt: time.Now(),
		}
		s.Jobs.Upsert(ctx, inProgressJob)

		// v1.2 created 40min after v1.0 (2h 20min ago, only 10min after v1.1)
		v1_2 := createTestVersion(ctx, s, deployment.Id, "v1.2.0", baseTime.Add(40*time.Minute))

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		scope := evaluator.EvaluatorScope{
			Version:     v1_2,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		// v1.2 should be allowed because enough time has elapsed since v1.1 (in progress) was created
		// (2.5 hours > 1 hour)
		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "Should be allowed when enough time has elapsed since in-progress version")
		assert.Contains(t, result.Message, "in_progress")
	})

	t.Run("zero interval allows all versions", func(t *testing.T) {
		s, ctx := setupTestStore(t)

		deployment, systemID := createTestDeployment(ctx, s)
		environment := createTestEnvironment(ctx, s, systemID)
		resource := createTestResource(ctx, s)
		releaseTarget := createTestReleaseTarget(ctx, s, deployment, environment, resource)

		baseTime := time.Now()

		// v1.0 deployed
		v1_0 := createTestVersion(ctx, s, deployment.Id, "v1.0.0", baseTime)
		release := createTestRelease(ctx, s, releaseTarget, v1_0)
		createSuccessfulJob(ctx, s, release)

		// v1.1 created immediately after
		v1_1 := createTestVersion(ctx, s, deployment.Id, "v1.1.0", baseTime.Add(1*time.Second))

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 0, // No cooldown
			},
		}

		eval := NewEvaluator(s, rule)
		require.NotNil(t, eval)

		scope := evaluator.EvaluatorScope{
			Version:     v1_1,
			Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
			Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
			Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
		}

		result := eval.Evaluate(ctx, scope)
		assert.True(t, result.Allowed, "Zero interval should allow all versions")
	})
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		duration time.Duration
		expected string
	}{
		{30 * time.Second, "30s"},
		{5 * time.Minute, "5m"},
		{90 * time.Minute, "1h 30m"},
		{2 * time.Hour, "2h"},
		{2*time.Hour + 15*time.Minute, "2h 15m"},
		{24 * time.Hour, "1d"},
		{36 * time.Hour, "1d 12h"},
		{48 * time.Hour, "2d"},
		{72*time.Hour + 6*time.Hour, "3d 6h"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := formatDuration(tt.duration)
			assert.Equal(t, tt.expected, result)
		})
	}
}
