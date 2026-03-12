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

type mockGetters struct {
	environments   map[string]*oapi.Environment
	deployments    map[string]*oapi.Deployment
	releases       map[string]*oapi.Release
	resources      map[string]*oapi.Resource
	releaseTargets []*oapi.ReleaseTarget
	jobs           map[string]map[string]*oapi.Job // releaseTargetKey -> jobID -> job
	verifications  map[string]oapi.JobVerificationStatus
}

func newMockGetters() *mockGetters {
	return &mockGetters{
		environments:   make(map[string]*oapi.Environment),
		deployments:    make(map[string]*oapi.Deployment),
		releases:       make(map[string]*oapi.Release),
		resources:      make(map[string]*oapi.Resource),
		releaseTargets: nil,
		jobs:           make(map[string]map[string]*oapi.Job),
		verifications:  make(map[string]oapi.JobVerificationStatus),
	}
}

func (m *mockGetters) GetEnvironment(_ context.Context, id string) (*oapi.Environment, error) {
	return m.environments[id], nil
}

func (m *mockGetters) GetAllEnvironments(_ context.Context, _ string) (map[string]*oapi.Environment, error) {
	return m.environments, nil
}

func (m *mockGetters) GetDeployment(_ context.Context, id string) (*oapi.Deployment, error) {
	return m.deployments[id], nil
}

func (m *mockGetters) GetAllDeployments(_ context.Context, _ string) (map[string]*oapi.Deployment, error) {
	return m.deployments, nil
}

func (m *mockGetters) GetRelease(_ context.Context, id string) (*oapi.Release, error) {
	return m.releases[id], nil
}

func (m *mockGetters) GetResource(_ context.Context, id string) (*oapi.Resource, error) {
	return m.resources[id], nil
}

func (m *mockGetters) GetJobsForReleaseTarget(_ context.Context, rt *oapi.ReleaseTarget) map[string]*oapi.Job {
	if rt == nil {
		return nil
	}
	return m.jobs[rt.Key()]
}

func (m *mockGetters) GetJobVerificationStatus(jobID string) oapi.JobVerificationStatus {
	return m.verifications[jobID]
}

func (m *mockGetters) GetAllReleaseTargets(_ context.Context, _ string) ([]*oapi.ReleaseTarget, error) {
	return m.releaseTargets, nil
}

func (m *mockGetters) addRelease(release *oapi.Release) {
	m.releases[release.Id.String()] = release
}

func (m *mockGetters) addJob(rt *oapi.ReleaseTarget, job *oapi.Job) {
	key := rt.Key()
	if m.jobs[key] == nil {
		m.jobs[key] = make(map[string]*oapi.Job)
	}
	m.jobs[key][job.Id] = job
}

func TestNewEvaluator(t *testing.T) {
	mock := newMockGetters()

	t.Run("returns nil when policyRule is nil", func(t *testing.T) {
		eval := NewEvaluator(mock, nil)
		assert.Nil(t, eval)
	})

	t.Run("returns nil when versionCooldown is nil", func(t *testing.T) {
		rule := &oapi.PolicyRule{
			Id: "test-rule",
		}
		eval := NewEvaluator(mock, rule)
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
		eval := NewEvaluator(mock, rule)
		assert.NotNil(t, eval)
	})
}

func TestVersionCooldownEvaluator_ScopeFields(t *testing.T) {
	mock := newMockGetters()
	rule := &oapi.PolicyRule{
		Id: "test-rule",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: 3600,
		},
	}

	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)

	// The evaluator needs Version and ReleaseTarget
	expectedFields := evaluator.ScopeVersion | evaluator.ScopeReleaseTarget
	assert.Equal(t, expectedFields, eval.ScopeFields())
}

func TestVersionCooldownEvaluator_RuleType(t *testing.T) {
	mock := newMockGetters()
	rule := &oapi.PolicyRule{
		Id: "test-rule",
		VersionCooldown: &oapi.VersionCooldownRule{
			IntervalSeconds: 3600,
		},
	}

	eval := NewEvaluator(mock, rule)
	require.NotNil(t, eval)
	assert.Equal(t, evaluator.RuleTypeVersionCooldown, eval.RuleType())
}

func TestVersionCooldownEvaluator_Evaluate(t *testing.T) {
	t.Run("allows first deployment when no previous release exists", func(t *testing.T) {
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		version := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    time.Now(),
		}

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(mock, rule)
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
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		version := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    time.Now(),
		}

		release := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *version,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release)

		completedAt := time.Now()
		job := &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release.Id.String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
			CreatedAt:   time.Now(),
		}
		mock.addJob(releaseTarget, job)

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(mock, rule)
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

	t.Run(
		"denies version when not enough time has elapsed since current version",
		func(t *testing.T) {
			ctx := context.Background()
			mock := newMockGetters()

			deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
			environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
			resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
			mock.deployments[deployment.Id] = deployment
			mock.environments[environment.Id] = environment
			mock.resources[resource.Id] = resource

			releaseTarget := &oapi.ReleaseTarget{
				DeploymentId:  deployment.Id,
				EnvironmentId: environment.Id,
				ResourceId:    resource.Id,
			}

			// v1.0 created 30 minutes ago, deployed
			baseTime := time.Now().Add(-30 * time.Minute)
			v1 := &oapi.DeploymentVersion{
				Id:           uuid.New().String(),
				DeploymentId: deployment.Id,
				Tag:          "v1.0.0",
				Name:         "Version v1.0.0",
				CreatedAt:    baseTime,
			}

			release := &oapi.Release{
				ReleaseTarget: *releaseTarget,
				Version:       *v1,
				CreatedAt:     time.Now().Format(time.RFC3339),
			}
			mock.addRelease(release)

			completedAt := time.Now()
			job := &oapi.Job{
				Id:          uuid.New().String(),
				ReleaseId:   release.Id.String(),
				Status:      oapi.JobStatusSuccessful,
				CompletedAt: &completedAt,
				CreatedAt:   time.Now(),
			}
			mock.addJob(releaseTarget, job)

			// v1.1 created 20 minutes after v1.0 (10 minutes ago)
			v1_1 := &oapi.DeploymentVersion{
				Id:           uuid.New().String(),
				DeploymentId: deployment.Id,
				Tag:          "v1.1.0",
				Name:         "Version v1.1.0",
				CreatedAt:    baseTime.Add(20 * time.Minute),
			}

			rule := &oapi.PolicyRule{
				Id: "test-rule",
				VersionCooldown: &oapi.VersionCooldownRule{
					IntervalSeconds: 3600, // 1 hour required
				},
			}

			eval := NewEvaluator(mock, rule)
			require.NotNil(t, eval)

			scope := evaluator.EvaluatorScope{
				Version:     v1_1,
				Environment: &oapi.Environment{Id: releaseTarget.EnvironmentId},
				Resource:    &oapi.Resource{Id: releaseTarget.ResourceId},
				Deployment:  &oapi.Deployment{Id: releaseTarget.DeploymentId},
			}

			result := eval.Evaluate(ctx, scope)
			assert.False(
				t,
				result.Allowed,
				"Version should be denied when not enough time has elapsed",
			)
			assert.Contains(t, result.Message, "Version cooldown")
			assert.Contains(t, result.Message, "remaining")
		},
	)

	t.Run("allows version when enough time has elapsed since current version", func(t *testing.T) {
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		// v1.0 created 2 hours ago, deployed
		baseTime := time.Now().Add(-2 * time.Hour)
		v1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    baseTime,
		}

		release := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *v1,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release)

		completedAt := time.Now()
		job := &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release.Id.String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
			CreatedAt:   time.Now(),
		}
		mock.addJob(releaseTarget, job)

		// v1.1 created 30 minutes after v1.0 (1.5 hours ago)
		// Even though v1.1 was created soon after v1.0, enough time has elapsed since v1.0 was created
		v1_1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.1.0",
			Name:         "Version v1.1.0",
			CreatedAt:    baseTime.Add(30 * time.Minute),
		}

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour required
			},
		}

		eval := NewEvaluator(mock, rule)
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
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		baseTime := time.Now().Add(-2 * time.Hour)

		// v1.0 created at baseTime, deployed
		v1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    baseTime,
		}

		release := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *v1,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release)

		completedAt := time.Now()
		job := &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release.Id.String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
			CreatedAt:   time.Now(),
		}
		mock.addJob(releaseTarget, job)

		// v1.1 created exactly 1 hour after v1.0
		v1_1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.1.0",
			Name:         "Version v1.1.0",
			CreatedAt:    baseTime.Add(1 * time.Hour),
		}

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour required
			},
		}

		eval := NewEvaluator(mock, rule)
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
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		// v1.0 deployed 2 hours ago
		baseTime := time.Now().Add(-2 * time.Hour)
		v1_0 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    baseTime,
		}

		release := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *v1_0,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release)

		completedAt := time.Now()
		job := &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release.Id.String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
			CreatedAt:   time.Now(),
		}
		mock.addJob(releaseTarget, job)

		// Rapid releases (all created within 70 minutes of v1.0)
		v1_1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.1.0",
			Name:         "Version v1.1.0",
			CreatedAt:    baseTime.Add(20 * time.Minute),
		} // +20min
		v1_2 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.2.0",
			Name:         "Version v1.2.0",
			CreatedAt:    baseTime.Add(40 * time.Minute),
		} // +40min
		v1_3 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.3.0",
			Name:         "Version v1.3.0",
			CreatedAt:    baseTime.Add(70 * time.Minute),
		} // +70min

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(mock, rule)
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
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		// v1.0 successfully deployed 3 hours ago
		baseTime := time.Now().Add(-3 * time.Hour)
		v1_0 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    baseTime,
		}

		release1 := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *v1_0,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release1)

		completedAt := time.Now().Add(-2 * time.Hour)
		successJob := &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release1.Id.String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
			CreatedAt:   completedAt,
		}
		mock.addJob(releaseTarget, successJob)

		// v1.1 is in progress (created 30min after v1.0, so 2.5 hours ago)
		v1_1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.1.0",
			Name:         "Version v1.1.0",
			CreatedAt:    baseTime.Add(30 * time.Minute),
		}

		release2 := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *v1_1,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release2)

		inProgressJob := &oapi.Job{
			Id:        uuid.New().String(),
			ReleaseId: release2.Id.String(),
			Status:    oapi.JobStatusInProgress,
			CreatedAt: time.Now(),
		}
		mock.addJob(releaseTarget, inProgressJob)

		// v1.2 created 40min after v1.0 (2h 20min ago, only 10min after v1.1)
		v1_2 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.2.0",
			Name:         "Version v1.2.0",
			CreatedAt:    baseTime.Add(40 * time.Minute),
		}

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 3600, // 1 hour
			},
		}

		eval := NewEvaluator(mock, rule)
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
		assert.True(
			t,
			result.Allowed,
			"Should be allowed when enough time has elapsed since in-progress version",
		)
		assert.Contains(t, result.Message, "in_progress")
	})

	t.Run("zero interval allows all versions", func(t *testing.T) {
		ctx := context.Background()
		mock := newMockGetters()

		deployment := &oapi.Deployment{Id: uuid.New().String(), Name: "test-deployment", Slug: "test-deployment"}
		environment := &oapi.Environment{Id: uuid.New().String(), Name: "staging"}
		resource := &oapi.Resource{Id: uuid.New().String(), Identifier: "test-resource-1", Kind: "service"}
		mock.deployments[deployment.Id] = deployment
		mock.environments[environment.Id] = environment
		mock.resources[resource.Id] = resource

		releaseTarget := &oapi.ReleaseTarget{
			DeploymentId:  deployment.Id,
			EnvironmentId: environment.Id,
			ResourceId:    resource.Id,
		}

		baseTime := time.Now()

		// v1.0 deployed
		v1_0 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.0.0",
			Name:         "Version v1.0.0",
			CreatedAt:    baseTime,
		}

		release := &oapi.Release{
			ReleaseTarget: *releaseTarget,
			Version:       *v1_0,
			CreatedAt:     time.Now().Format(time.RFC3339),
		}
		mock.addRelease(release)

		completedAt := time.Now()
		job := &oapi.Job{
			Id:          uuid.New().String(),
			ReleaseId:   release.Id.String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
			CreatedAt:   time.Now(),
		}
		mock.addJob(releaseTarget, job)

		// v1.1 created immediately after
		v1_1 := &oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: deployment.Id,
			Tag:          "v1.1.0",
			Name:         "Version v1.1.0",
			CreatedAt:    baseTime.Add(1 * time.Second),
		}

		rule := &oapi.PolicyRule{
			Id: "test-rule",
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: 0, // No cooldown
			},
		}

		eval := NewEvaluator(mock, rule)
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
