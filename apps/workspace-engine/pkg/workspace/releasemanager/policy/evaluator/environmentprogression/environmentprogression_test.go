package environmentprogression

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

// setupTestStore creates a test store with environments, jobs, and releases
func setupTestStore() *store.Store {
	st := store.New("test-workspace")
	ctx := context.Background()

	// Create system
	system := &oapi.System{
		Id:          "system-1",
		Name:        "test-system",
		WorkspaceId: "workspace-1",
	}
	st.Systems.Upsert(ctx, system)

	// Create environments
	devEnv := &oapi.Environment{
		Id:       "env-dev",
		Name:     "dev",
		SystemId: "system-1",
	}
	stagingEnv := &oapi.Environment{
		Id:       "env-staging",
		Name:     "staging",
		SystemId: "system-1",
	}
	prodEnv := &oapi.Environment{
		Id:       "env-prod",
		Name:     "prod",
		SystemId: "system-1",
	}
	st.Environments.Upsert(ctx, devEnv)
	st.Environments.Upsert(ctx, stagingEnv)
	st.Environments.Upsert(ctx, prodEnv)

	// Create deployment
	jobAgentId := "agent-1"
	description := "Test deployment"
	deployment := &oapi.Deployment{
		Id:             "deploy-1",
		Name:           "my-app",
		Slug:           "my-app",
		SystemId:       "system-1",
		JobAgentId:     &jobAgentId,
		Description:    &description,
		JobAgentConfig: map[string]any{},
	}
	st.Deployments.Upsert(ctx, deployment)

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
	st.Resources.Upsert(ctx, resource)

	return st
}

func TestEnvironmentProgressionEvaluator_VersionNotInDependency(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Create a selector that matches staging
	selector := oapi.Selector{}
	err := selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "name",
			"operator": "equals",
			"value":    "staging",
		},
	})
	if err != nil {
		t.Fatalf("failed to create selector: %v", err)
	}

	// Create rule: prod depends on staging
	rule := &oapi.EnvironmentProgressionRule{
		Id:                           "rule-1",
		PolicyId:                     "policy-1",
		DependsOnEnvironmentSelector: selector,
	}

	evaluator := NewEnvironmentProgressionEvaluator(st, rule)

	// Create a version and release target for prod
	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-prod",
		DeploymentId:  "deploy-1",
	}

	// Evaluate - should be pending since version not in staging
	result, err := evaluator.Evaluate(ctx, releaseTarget, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Error("expected not allowed, got allowed")
	}

	if !result.ActionRequired {
		t.Error("expected action required (pending)")
	}

	if result.Message == "" {
		t.Error("expected error message")
	}
}

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

	stagingRelease := &oapi.Release{
		ReleaseTarget: *stagingReleaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
		CreatedAt:     time.Now().Format(time.RFC3339),
	}
	st.Releases.Upsert(ctx, stagingRelease)

	// Create a successful job for the staging release
	completedAt := time.Now().Add(-10 * time.Minute)
	job := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      stagingRelease.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      time.Now().Add(-15 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job)

	// Create a selector that matches staging
	selector := oapi.Selector{}
	err := selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "name",
			"operator": "equals",
			"value":    "staging",
		},
	})
	if err != nil {
		t.Fatalf("failed to create selector: %v", err)
	}

	// Create rule: prod depends on staging
	rule := &oapi.EnvironmentProgressionRule{
		Id:                           "rule-1",
		PolicyId:                     "policy-1",
		DependsOnEnvironmentSelector: selector,
	}

	evaluator := NewEnvironmentProgressionEvaluator(st, rule)

	// Create release target for prod
	prodReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-prod",
		DeploymentId:  "deploy-1",
	}

	// Evaluate - should be allowed since version succeeded in staging
	result, err := evaluator.Evaluate(ctx, prodReleaseTarget, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !result.Allowed {
		t.Errorf("expected allowed, got denied: %s", result.Message)
	}

	if result.ActionRequired {
		t.Error("expected no action required")
	}
}

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
	st.Releases.Upsert(ctx, stagingRelease)

	// Create a successful job that completed very recently (2 minutes ago)
	completedAt := time.Now().Add(-2 * time.Minute)
	job := &oapi.Job{
		Id:             "job-1",
		ReleaseId:      stagingRelease.ID(),
		JobAgentId:     "agent-1",
		Status:         oapi.Successful,
		CreatedAt:      time.Now().Add(-5 * time.Minute),
		UpdatedAt:      completedAt,
		CompletedAt:    &completedAt,
		JobAgentConfig: map[string]interface{}{},
	}
	st.Jobs.Upsert(ctx, job)

	// Create a selector that matches staging
	selector := oapi.Selector{}
	err := selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "name",
			"operator": "equals",
			"value":    "staging",
		},
	})
	if err != nil {
		t.Fatalf("failed to create selector: %v", err)
	}

	// Create rule: prod depends on staging with 30 minute soak time
	soakTime := int32(30)
	rule := &oapi.EnvironmentProgressionRule{
		Id:                           "rule-1",
		PolicyId:                     "policy-1",
		DependsOnEnvironmentSelector: selector,
		MinimumSockTimeMinutes:       &soakTime,
	}

	evaluator := NewEnvironmentProgressionEvaluator(st, rule)

	// Create release target for prod
	prodReleaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-prod",
		DeploymentId:  "deploy-1",
	}

	// Evaluate - should be pending since soak time not met
	result, err := evaluator.Evaluate(ctx, prodReleaseTarget, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Error("expected not allowed (soak time not met)")
	}

	if !result.ActionRequired {
		t.Error("expected action required (waiting for soak time)")
	}

	if result.Message == "" {
		t.Error("expected message about soak time")
	}
}

func TestEnvironmentProgressionEvaluator_NoMatchingEnvironments(t *testing.T) {
	st := setupTestStore()
	ctx := context.Background()

	// Create a selector that matches nothing
	selector := oapi.Selector{}
	err := selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]interface{}{
			"type":     "name",
			"operator": "equals",
			"value":    "non-existent-env",
		},
	})
	if err != nil {
		t.Fatalf("failed to create selector: %v", err)
	}

	// Create rule with selector that matches no environments
	rule := &oapi.EnvironmentProgressionRule{
		Id:                           "rule-1",
		PolicyId:                     "policy-1",
		DependsOnEnvironmentSelector: selector,
	}

	evaluator := NewEnvironmentProgressionEvaluator(st, rule)

	version := &oapi.DeploymentVersion{
		Id:           "version-1",
		Name:         "v1.0.0",
		Tag:          "v1.0.0",
		DeploymentId: "deploy-1",
		Status:       oapi.DeploymentVersionStatusReady,
		CreatedAt:    time.Now(),
	}

	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    "resource-1",
		EnvironmentId: "env-prod",
		DeploymentId:  "deploy-1",
	}

	// Evaluate - should be denied since no matching environments
	result, err := evaluator.Evaluate(ctx, releaseTarget, version)

	// Assert
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Allowed {
		t.Error("expected not allowed (no matching environments)")
	}

	if result.ActionRequired {
		t.Error("expected denied, not action required")
	}
}
