package environmentprogression

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestStore creates a test store with environments, jobs, and releases
func setupTestStore() *store.Store {
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)
	ctx := context.Background()

	// Create system
	system := &oapi.System{
		Id:          "system-1",
		Name:        "test-system",
		WorkspaceId: "workspace-1",
	}
	_ = st.Systems.Upsert(ctx, system)

	// Create resource selector that matches all resources
	resourceSelector := &oapi.Selector{}
	_ = resourceSelector.FromCelSelector(oapi.CelSelector{
		Cel: "true",
	})

	// Create environments
	devEnv := &oapi.Environment{
		Id:               "env-dev",
		Name:             "dev",
		SystemId:         "system-1",
		ResourceSelector: resourceSelector,
	}
	stagingEnv := &oapi.Environment{
		Id:               "env-staging",
		Name:             "staging",
		SystemId:         "system-1",
		ResourceSelector: resourceSelector,
	}
	prodEnv := &oapi.Environment{
		Id:               "env-prod",
		Name:             "prod",
		SystemId:         "system-1",
		ResourceSelector: resourceSelector,
	}
	_ = st.Environments.Upsert(ctx, devEnv)
	_ = st.Environments.Upsert(ctx, stagingEnv)
	_ = st.Environments.Upsert(ctx, prodEnv)

	// Create deployment
	jobAgentId := "agent-1"
	description := "Test deployment"
	deployment := &oapi.Deployment{
		Id:               "deploy-1",
		Name:             "my-app",
		Slug:             "my-app",
		SystemId:         "system-1",
		JobAgentId:       &jobAgentId,
		Description:      &description,
		JobAgentConfig:   map[string]any{},
		ResourceSelector: resourceSelector,
	}
	_ = st.Deployments.Upsert(ctx, deployment)

	// Create resource
	resource := &oapi.Resource{
		Id:          "resource-1",
		Identifier:  "test-resource",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	_, _ = st.Resources.Upsert(ctx, resource)

	// Create a release target per environment
	devReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-dev",
		DeploymentId:  "deploy-1",
	}
	stagingReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	prodReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-prod",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, devReleaseTarget)
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget)
	_ = st.ReleaseTargets.Upsert(ctx, prodReleaseTarget)
	return st
}

// TestEnvironmentProgressionEvaluator_VersionNotInDependency tests that when a version has not been deployed
// to any dependency environment (matching the selector), the evaluator returns a pending/action-required result.
// This ensures that versions must succeed in dependency environments before they can be deployed to the target environment.
func TestEnvironmentProgressionEvaluator_VersionNotInDependency(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Create a CEL selector that matches staging
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err, "failed to create selector")

	// Create rule: prod depends on staging
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
		},
	}

	eval := NewEvaluator(st, rule)
	require.NotNil(t, eval, "evaluator should not be nil")

	// Create a version for prod environment
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}

	// Get the prod environment
	prodEnv, _ := st.Environments.Get("env-prod")

	// Evaluate - should be pending since version not in staging
	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.False(t, result.Allowed, "expected not allowed")
	assert.True(t, result.ActionRequired, "expected action required (pending)")
	assert.NotEmpty(t, result.Message, "expected error message")
}

// TestEnvironmentProgressionEvaluator_VersionSuccessfulInDependency tests that when a version has been
// successfully deployed to a dependency environment (has at least one successful job), the evaluator allows
// progression to the target environment. This verifies the basic success detection logic.
func TestEnvironmentProgressionEvaluator_VersionSuccessfulInDependency(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Create a version
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create a release in staging for this version
	stagingReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget)

	stagingRelease := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, stagingRelease)

	// Create a successful job for the staging release
	completedAt := time.Now().Add(-10 * time.Minute)
	job := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      stagingRelease.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Now().Add(-15 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job)

	// Create a CEL selector that matches staging
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err, "failed to create selector")

	// Create rule: prod depends on staging
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
		},
	}

	eval := NewEvaluator(st, rule)

	// Get the prod environment
	prodEnv, _ := st.Environments.Get("env-prod")

	// Evaluate - should be allowed since version succeeded in staging
	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed, got denied: %s", result.Message)
	assert.False(t, result.ActionRequired, "expected no action required")
}

// TestEnvironmentProgressionEvaluator_SoakTimeNotMet tests that when a version has successful jobs in the
// dependency environment but they completed too recently (within the required soak time period), the evaluator
// returns a pending/action-required result. This ensures versions must "soak" (remain stable) for a minimum
// duration before progressing to the next environment.
func TestEnvironmentProgressionEvaluator_SoakTimeNotMet(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Create a version
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create a release in staging for this version
	stagingReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}

	stagingRelease := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, stagingRelease)

	// Create a successful job that completed very recently (2 minutes ago)
	completedAt := time.Now().Add(-2 * time.Minute)
	job := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      stagingRelease.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Now().Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job)

	// Create a CEL selector that matches staging
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err, "failed to create selector")

	// Create rule: prod depends on staging with 30 minute soak time
	soakTime := int32(30)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSockTimeMinutes:       &soakTime,
		},
	}

	eval := NewEvaluator(st, rule)

	// Get the prod environment
	prodEnv, _ := st.Environments.Get("env-prod")

	// Evaluate - should be pending since soak time not met
	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.False(t, result.Allowed, "expected not allowed (soak time not met)")
	assert.True(t, result.ActionRequired, "expected action required (waiting for soak time)")
	assert.NotEmpty(t, result.Message, "expected message about soak time")
}

// TestEnvironmentProgressionEvaluator_NoMatchingEnvironments tests that when the dependency environment selector
// matches no environments in the system, the evaluator denies progression. This handles the edge case where
// the selector is misconfigured or no matching environments exist.
func TestEnvironmentProgressionEvaluator_NoMatchingEnvironments(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Create a CEL selector that matches nothing
	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'non-existent-env'",
	})
	require.NoError(t, err, "failed to create selector")

	// Create rule with selector that matches no environments
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
		},
	}

	eval := NewEvaluator(st, rule)

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}

	// Get the prod environment
	prodEnv, _ := st.Environments.Get("env-prod")

	// Evaluate - should be denied since no matching environments
	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.False(t, result.Allowed, "expected not allowed (no matching environments)")
	assert.False(t, result.ActionRequired, "expected denied, not action required")
}

// TestEnvironmentProgressionEvaluator_SatisfiedAt_PassRateOnly tests that the satisfiedAt timestamp is correctly
// calculated when only a minimum pass rate (success percentage) requirement is specified. The satisfiedAt should
// reflect the exact moment when the minimum pass rate was achieved (i.e., when the Nth successful job completed,
// where N is the minimum number of successes required). This test uses 3 release targets with a 50% requirement,
// so satisfiedAt should be set to when the 2nd job completed (at 10:10), as that's when 66% (2/3) first met the 50% threshold.
func TestEnvironmentProgressionEvaluator_SatisfiedAt_PassRateOnly(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create release targets for staging
	stagingReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget1)

	stagingReleaseTarget2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget2)

	stagingReleaseTarget3 := &oapi.ReleaseTarget{
		ResourceId:    "resource-3",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget3)

	// Create releases
	release1 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release2 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget2,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release3 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget3,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, release1)
	_ = st.Releases.Upsert(ctx, release2)
	_ = st.Releases.Upsert(ctx, release3)

	// Create resources for release targets
	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Identifier:  "test-resource-2",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	resource3 := &oapi.Resource{
		Id:          "resource-3",
		Identifier:  "test-resource-3",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	_, _ = st.Resources.Upsert(ctx, resource2)
	_, _ = st.Resources.Upsert(ctx, resource3)
	// ReleaseTargets are computed automatically from resources and deployments
	// Call Items() to ensure ReleaseTargets are computed and available
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err, "failed to get release targets")

	// Create successful jobs with specific timestamps
	// Job 1 completes first (pass rate 33%)
	completedAt1 := time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC)
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	// Job 2 completes second (pass rate 66% - meets 50% requirement)
	completedAt2 := time.Date(2024, 1, 1, 10, 10, 0, 0, time.UTC) // This should be the satisfiedAt
	job2 := &oapi.Job{
		Id:             "job-2",
		ReleaseId:      release2.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 5, 0, 0, time.UTC),
		UpdatedAt:      completedAt2,
		CompletedAt:    &completedAt2,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job2)

	// Job 3 completes third (pass rate 100%)
	completedAt3 := time.Date(2024, 1, 1, 10, 15, 0, 0, time.UTC)
	job3 := &oapi.Job{
		Id:             "job-3",
		ReleaseId:      release3.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 10, 0, 0, time.UTC),
		UpdatedAt:      completedAt3,
		CompletedAt:    &completedAt3,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job3)

	// Create selector and rule with 50% pass rate requirement (no soak time)
	selector := oapi.Selector{}
	err = selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(50.0)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSuccessPercentage:     &minSuccessPercentage,
		},
	}

	eval := NewEvaluator(st, rule)
	prodEnv, _ := st.Environments.Get("env-prod")

	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, completedAt2, *result.SatisfiedAt, "satisfiedAt should be the timestamp of the 2nd successful job (when 50% requirement was met)")
}

// TestEnvironmentProgressionEvaluator_SatisfiedAt_SoakTimeOnly tests that the satisfiedAt timestamp is correctly
// calculated when only a minimum soak time requirement is specified. The satisfiedAt should reflect when the
// soak time requirement was satisfied, which is calculated as: mostRecentSuccess + soakDuration. For example,
// if the most recent successful job completed 40 minutes ago and the soak time is 30 minutes, then satisfiedAt
// should be 10 minutes ago (40 - 30).
func TestEnvironmentProgressionEvaluator_SatisfiedAt_SoakTimeOnly(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	versionCreatedAt := time.Now().Add(-2 * time.Hour)
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	stagingReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget)

	stagingRelease := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, stagingRelease)

	// Create a successful job that completed 40 minutes ago
	// With 30 minute soak time requirement, it should be satisfied
	soakMinutes := int32(30)
	mostRecentSuccess := time.Now().Add(-40 * time.Minute)                                 // 40 minutes ago
	expectedSatisfiedAt := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute) // mostRecentSuccess + soakDuration

	completedAt := mostRecentSuccess
	job := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      stagingRelease.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      mostRecentSuccess.Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job)

	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSockTimeMinutes:       &soakMinutes,
		},
	}

	eval := NewEvaluator(st, rule)
	prodEnv, _ := st.Environments.Get("env-prod")

	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed (soak time satisfied)")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, expectedSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be mostRecentSuccess + soakDuration")
}

// TestEnvironmentProgressionEvaluator_SatisfiedAt_BothPassRateAndSoakTime tests that when both pass rate and
// soak time requirements are specified, the satisfiedAt timestamp is set to the later of the two satisfaction
// times. This is because both conditions must be met (AND logic), so the overall requirement is satisfied only
// when the last condition is satisfied. In this test, pass rate is satisfied at 10:10, but soak time requires
// the most recent success (10:20) plus 30 minutes, so satisfiedAt should be 10:50 (the later time).
func TestEnvironmentProgressionEvaluator_SatisfiedAt_BothPassRateAndSoakTime(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create 2 release targets
	stagingReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget1)

	stagingReleaseTarget2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget2)

	release1 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release2 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget2,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, release1)
	_ = st.Releases.Upsert(ctx, release2)

	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Identifier:  "test-resource-2",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	_, _ = st.Resources.Upsert(ctx, resource2)
	// ReleaseTargets are computed automatically from resources and deployments

	// Job 1 completes first (pass rate 50% - meets requirement)
	passRateSatisfiedAt := time.Date(2024, 1, 1, 10, 10, 0, 0, time.UTC)
	completedAt1 := passRateSatisfiedAt
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	// Job 2 completes later (pass rate 100%, most recent success)
	mostRecentSuccess := time.Date(2024, 1, 1, 10, 20, 0, 0, time.UTC)
	completedAt2 := mostRecentSuccess
	job2 := &oapi.Job{
		Id:             "job-2",
		ReleaseId:      release2.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Date(2024, 1, 1, 10, 15, 0, 0, time.UTC),
		UpdatedAt:      completedAt2,
		CompletedAt:    &completedAt2,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job2)

	// Soak time requirement: 30 minutes
	// Soak time satisfied at: mostRecentSuccess + 30 minutes = 10:50
	soakMinutes := int32(30)
	soakTimeSatisfiedAt := mostRecentSuccess.Add(time.Duration(soakMinutes) * time.Minute)
	// Pass rate satisfied at: 10:10
	// Soak time satisfied at: 10:50
	// Expected satisfiedAt: 10:50 (the later of the two)

	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(50.0)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSuccessPercentage:     &minSuccessPercentage,
			MinimumSockTimeMinutes:       &soakMinutes,
		},
	}

	eval := NewEvaluator(st, rule)
	prodEnv, _ := st.Environments.Get("env-prod")

	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed (both requirements satisfied)")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	assert.Equal(t, soakTimeSatisfiedAt, *result.SatisfiedAt, "satisfiedAt should be the later of pass rate and soak time satisfaction times")
}

// TestEnvironmentProgressionEvaluator_SatisfiedAt_PassRateBeforeSoakTime tests the scenario where the pass rate
// requirement is satisfied chronologically before the soak time requirement (though both must be met). This verifies
// that satisfiedAt correctly identifies the later of the two times even when they are satisfied in different orders.
// In this test, the pass rate is satisfied when the 3rd job completes (20 minutes ago), but the soak time is
// satisfied later (mostRecentSuccess + 15 minutes = 5 minutes ago), so satisfiedAt should be 5 minutes ago.
func TestEnvironmentProgressionEvaluator_SatisfiedAt_PassRateBeforeSoakTime(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	// Create 3 release targets (need 2 for 67% requirement)
	stagingReleaseTarget1 := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget1)

	stagingReleaseTarget2 := &oapi.ReleaseTarget{
		ResourceId:    "resource-2",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget2)

	stagingReleaseTarget3 := &oapi.ReleaseTarget{
		ResourceId:    "resource-3",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget3)

	release1 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget1,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release2 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget2,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	release3 := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget3,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, release1)
	_ = st.Releases.Upsert(ctx, release2)
	_ = st.Releases.Upsert(ctx, release3)

	resource2 := &oapi.Resource{
		Id:          "resource-2",
		Identifier:  "test-resource-2",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	resource3 := &oapi.Resource{
		Id:          "resource-3",
		Identifier:  "test-resource-3",
		Kind:        "service",
		WorkspaceId: "workspace-1",
		Config:      map[string]any{},
		Metadata:    map[string]string{},
		CreatedAt:   time.Now(),
	}
	_, _ = st.Resources.Upsert(ctx, resource2)
	_, _ = st.Resources.Upsert(ctx, resource3)
	// ReleaseTargets are computed automatically from resources and deployments
	// Call Items() to ensure ReleaseTargets are computed and available
	_, err := st.ReleaseTargets.Items()
	require.NoError(t, err, "failed to get release targets")

	// Job 1 completes early (most recent success for soak time)
	// Use relative time so soak time calculation works correctly
	mostRecentSuccess := time.Now().Add(-30 * time.Minute) // 30 minutes ago, satisfies 15-minute soak time
	completedAt1 := mostRecentSuccess
	job1 := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      release1.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Now().Add(-35 * time.Minute),
		UpdatedAt:      completedAt1,
		CompletedAt:    &completedAt1,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job1)

	// Job 2 completes second (pass rate 66.67% - doesn't meet 67% requirement yet)
	completedAt2 := time.Now().Add(-18 * time.Minute) // Completes before job3
	job2 := &oapi.Job{
		Id:             "job-2",
		ReleaseId:      release2.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Now().Add(-20 * time.Minute),
		UpdatedAt:      completedAt2,
		CompletedAt:    &completedAt2,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job2)

	// Job 3 completes third (pass rate 100% - meets 67% requirement)
	// Need 3 successes for 67% requirement (ceil(3 * 0.67) = 3), so pass rate satisfied at: when 3rd job completes
	// Make job3 complete at least 15 minutes ago so soak time requirement is satisfied
	passRateSatisfiedAt := time.Now().Add(-20 * time.Minute) // Completes last, satisfying 67% requirement AND soak time (20 > 15)
	completedAt3 := passRateSatisfiedAt
	job3 := &oapi.Job{
		Id:             "job-3",
		ReleaseId:      release3.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Now().Add(-22 * time.Minute),
		UpdatedAt:      completedAt3,
		CompletedAt:    &completedAt3,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job3)

	// Soak time requirement: 15 minutes
	// mostRecentSuccess = completedAt3 (20 minutes ago)
	// Soak time satisfied at: 20 minutes ago + 15 minutes = 5 minutes ago
	// Pass rate satisfied at: 20 minutes ago (when 3rd job completed, meeting 67% requirement)
	// Soak time satisfied at: 5 minutes ago
	// Expected satisfiedAt: 5 minutes ago (the later of the two - soak time)
	soakMinutes := int32(15)

	selector := oapi.Selector{}
	err = selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	minSuccessPercentage := float32(67.0)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSuccessPercentage:     &minSuccessPercentage,
			MinimumSockTimeMinutes:       &soakMinutes,
		},
	}

	eval := NewEvaluator(st, rule)
	prodEnv, _ := st.Environments.Get("env-prod")

	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed (both requirements satisfied)")
	require.NotNil(t, result.SatisfiedAt, "expected satisfiedAt to be set")
	// Soak time satisfied at: mostRecentSuccess + 15 minutes
	// The actual result should be approximately: (now - 20 min) + 15 min = now - 5 min
	// Use InDelta with a large tolerance to account for timing differences between job creation and evaluation
	expectedSatisfiedAt := time.Now().Add(-5 * time.Minute)
	assert.InDelta(t, expectedSatisfiedAt.Unix(), result.SatisfiedAt.Unix(), 150, "satisfiedAt should be approximately 5 minutes ago (within 2.5 minutes)")
}

// TestEnvironmentProgressionEvaluator_SatisfiedAt_NotSatisfied tests that when the environment progression
// requirements are not met (e.g., soak time requirement not satisfied), the satisfiedAt field is nil. This
// ensures that satisfiedAt is only set when the requirement has actually been satisfied, not when it's still
// pending or denied.
func TestEnvironmentProgressionEvaluator_SatisfiedAt_NotSatisfied(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	stagingReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-staging",
		DeploymentId:  "deploy-1",
	}
	_ = st.ReleaseTargets.Upsert(ctx, stagingReleaseTarget)

	stagingRelease := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	_ = st.Releases.Upsert(ctx, stagingRelease)

	// Create a successful job that completed very recently (soak time not met)
	completedAt := time.Now().Add(-2 * time.Minute)
	job := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      stagingRelease.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.JobStatusSuccessful,
		CreatedAt:      time.Now().Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job)

	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	soakMinutes := int32(30)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSockTimeMinutes:       &soakMinutes,
		},
	}

	eval := NewEvaluator(st, rule)
	prodEnv, _ := st.Environments.Get("env-prod")

	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.False(t, result.Allowed, "expected not allowed (soak time not satisfied)")
	assert.Nil(t, result.SatisfiedAt, "satisfiedAt should be nil when requirements are not satisfied")
}

// TestEnvironmentProgressionEvaluator_NoReleaseTargets_Allowed tests that when there are no release targets, the evaluator allows the environment progression.
func TestEnvironmentProgressionEvaluator_NoReleaseTargets_Allowed(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	st.ReleaseTargets.Remove("resource-1-env-staging-deploy-1")

	versionCreatedAt := time.Date(2024, 1, 1, 10, 0, 0, 0, time.UTC)
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    versionCreatedAt,
	}
	st.DeploymentVersions.Upsert(ctx, version.Id, version)

	selector := oapi.Selector{}
	err := selector.FromCelSelector(oapi.CelSelector{
		Cel: "environment.name == 'staging'",
	})
	require.NoError(t, err)

	soakMinutes := int32(30)
	rule := &oapi.PolicyRule{
		Id: "rule-1",
		EnvironmentProgression: &oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: selector,
			MinimumSockTimeMinutes:       &soakMinutes,
		},
	}

	eval := NewEvaluator(st, rule)
	prodEnv, _ := st.Environments.Get("env-prod")

	scope := evaluator.EvaluatorScope{
		Environment: prodEnv,
		Version:     version,
	}
	result := eval.Evaluate(ctx, scope)

	// Assert
	assert.True(t, result.Allowed, "expected allowed (no release targets)")
}
