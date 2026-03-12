package deploymentdependency

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	deployments    map[string]*oapi.Deployment
	releaseTargets map[string][]*oapi.ReleaseTarget
	latestJobs     map[string]*oapi.Job
}

func (m *mockGetters) GetDeployment(_ context.Context, id string) (*oapi.Deployment, error) {
	if d, ok := m.deployments[id]; ok {
		return d, nil
	}
	return nil, fmt.Errorf("not found")
}

func (m *mockGetters) GetAllDeployments(_ context.Context, _ string) (map[string]*oapi.Deployment, error) {
	return m.deployments, nil
}

func (m *mockGetters) GetReleaseTargetsForResource(_ context.Context, resourceID string) []*oapi.ReleaseTarget {
	return m.releaseTargets[resourceID]
}

func (m *mockGetters) GetLatestCompletedJobForReleaseTarget(rt *oapi.ReleaseTarget) *oapi.Job {
	if m.latestJobs == nil || rt == nil {
		return nil
	}
	return m.latestJobs[rt.Key()]
}

func generateDependencyRule(cel string) *oapi.PolicyRule {
	return &oapi.PolicyRule{
		Id: uuid.New().String(),
		DeploymentDependency: &oapi.DeploymentDependencyRule{
			DependsOn: cel,
		},
	}
}

func makeDeployment() *oapi.Deployment {
	return &oapi.Deployment{Id: uuid.New().String()}
}

func makeReleaseTarget(resourceID, envID, deploymentID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: envID,
		DeploymentId:  deploymentID,
	}
}

func successfulJob() *oapi.Job {
	now := time.Now()
	return &oapi.Job{
		Id:          uuid.New().String(),
		Status:      oapi.JobStatusSuccessful,
		CompletedAt: &now,
	}
}

func failedJob() *oapi.Job {
	now := time.Now()
	return &oapi.Job{
		Id:          uuid.New().String(),
		Status:      oapi.JobStatusFailure,
		CompletedAt: &now,
	}
}

func TestDeploymentDependencyEvaluator_UnsatisfiedDependencyFails(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		latestJobs: map[string]*oapi.Job{},
	}

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.False(t, result.Allowed, "expected denied when dependency is not satisfied")
}

func TestDeploymentDependencyEvaluator_SatisfiedDependencyPasses(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		latestJobs: map[string]*oapi.Job{
			rt1.Key(): successfulJob(),
		},
	}

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})

	assert.True(t, result.Allowed, "expected allowed when dependency is satisfied")
}

func TestDeploymentDependencyEvaluator_MixedSatisfactionsFails(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	deployment3 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()
	env3ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)
	rt3 := makeReleaseTarget(resourceID, env3ID, deployment3.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
			deployment3.Id: deployment3,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2, rt3},
		},
		latestJobs: map[string]*oapi.Job{
			rt1.Key(): successfulJob(),
		},
	}

	cel := fmt.Sprintf("deployment.id != '%s'", deployment3.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(mock, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt3.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt3.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt3.DeploymentId},
	})
	assert.False(
		t,
		result.Allowed,
		"expected denied when some upstream release targets are not successful",
	)
}

func TestDeploymentDependencyEvaluator_FailedJobsFails(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	deployment3 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()
	env3ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)
	rt3 := makeReleaseTarget(resourceID, env3ID, deployment3.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
			deployment3.Id: deployment3,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2, rt3},
		},
		latestJobs: map[string]*oapi.Job{
			rt1.Key(): successfulJob(),
			rt2.Key(): failedJob(),
		},
	}

	cel := fmt.Sprintf("deployment.id != '%s'", deployment3.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(mock, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt3.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt3.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt3.DeploymentId},
	})
	assert.False(
		t,
		result.Allowed,
		"expected denied when some upstream release targets are not successful",
	)
}

func TestDeploymentDependencyEvaluator_FailsIfLatestJobIsNotSuccessful(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		latestJobs: map[string]*oapi.Job{
			rt1.Key(): failedJob(),
		},
	}

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.False(t, result.Allowed, "expected denied when latest job is not successful")
}

func TestDeploymentDependencyEvaluator_PassesIfLatestJobIsProgressingAndOtherJobsAreSuccessful(
	t *testing.T,
) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		latestJobs: map[string]*oapi.Job{
			rt1.Key(): successfulJob(),
		},
	}

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.True(
		t,
		result.Allowed,
		"expected allowed when latest job is progressing and other jobs are successful",
	)
}

func TestDeploymentDependencyEvaluator_NoMatchingDeploymentsFails(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		latestJobs: map[string]*oapi.Job{},
	}

	cel := "deployment.id == 'non-existing-deployment'"
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(mock, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.False(t, result.Allowed, "expected denied when no matching deployments are found")
}

func TestDeploymentDependencyEvaluator_NotEnoughUpstreamReleaseTargetsFails(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env2ID := uuid.New().String()

	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt2},
		},
		latestJobs: map[string]*oapi.Job{},
	}

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(mock, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.False(
		t,
		result.Allowed,
		"expected denied when not enough upstream release targets are found",
	)
}
