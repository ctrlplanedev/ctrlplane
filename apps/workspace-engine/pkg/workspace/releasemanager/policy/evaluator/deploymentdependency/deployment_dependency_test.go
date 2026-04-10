package deploymentdependency

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
)

type mockGetters struct {
	deployments      map[string]*oapi.Deployment
	releaseTargets   map[string][]*oapi.ReleaseTarget
	deployedVersions map[string]*oapi.DeploymentVersion
}

func (m *mockGetters) GetDeployment(_ context.Context, id string) (*oapi.Deployment, error) {
	if d, ok := m.deployments[id]; ok {
		return d, nil
	}
	return nil, fmt.Errorf("not found")
}

func (m *mockGetters) GetAllDeployments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Deployment, error) {
	return m.deployments, nil
}

func (m *mockGetters) GetReleaseTargetsForResource(
	_ context.Context,
	resourceID string,
) []*oapi.ReleaseTarget {
	return m.releaseTargets[resourceID]
}

func (m *mockGetters) GetCurrentlyDeployedVersion(
	_ context.Context,
	rt *oapi.ReleaseTarget,
) *oapi.DeploymentVersion {
	if m.deployedVersions == nil || rt == nil {
		return nil
	}
	return m.deployedVersions[rt.Key()]
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
	return &oapi.Deployment{Id: uuid.New().String(), Name: "dep-" + uuid.New().String()}
}

func makeReleaseTarget(resourceID, envID, deploymentID string) *oapi.ReleaseTarget {
	return &oapi.ReleaseTarget{
		ResourceId:    resourceID,
		EnvironmentId: envID,
		DeploymentId:  deploymentID,
	}
}

func makeVersion(deploymentID string) *oapi.DeploymentVersion {
	return &oapi.DeploymentVersion{
		Id:           uuid.New().String(),
		Tag:          "v1.0.0",
		Name:         "version-1",
		DeploymentId: deploymentID,
		Status:       oapi.DeploymentVersionStatusReady,
		Metadata:     map[string]string{},
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
		deployedVersions: map[string]*oapi.DeploymentVersion{},
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
		deployedVersions: map[string]*oapi.DeploymentVersion{
			rt1.Key(): makeVersion(deployment1.Id),
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
		deployedVersions: map[string]*oapi.DeploymentVersion{},
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

func TestDeploymentDependencyEvaluator_VersionSelectorFilters(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	version := makeVersion(deployment1.Id)
	version.Tag = "v1.0.0"

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		deployedVersions: map[string]*oapi.DeploymentVersion{
			rt1.Key(): version,
		},
	}

	// Version matches
	cel := fmt.Sprintf("deployment.id == '%s' && version.tag == 'v1.0.0'", deployment1.Id)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.True(t, result.Allowed, "expected allowed when version matches")

	// Version does not match
	cel = fmt.Sprintf("deployment.id == '%s' && version.tag == 'v2.0.0'", deployment1.Id)
	rule = generateDependencyRule(cel)
	eval = NewEvaluator(mock, rule)
	result = eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.False(t, result.Allowed, "expected denied when version does not match")
}

func TestDeploymentDependencyEvaluator_VersionMetadataSelector(t *testing.T) {
	ctx := context.Background()

	deployment1 := makeDeployment()
	deployment2 := makeDeployment()
	resourceID := uuid.New().String()
	env1ID := uuid.New().String()
	env2ID := uuid.New().String()

	rt1 := makeReleaseTarget(resourceID, env1ID, deployment1.Id)
	rt2 := makeReleaseTarget(resourceID, env2ID, deployment2.Id)

	version := makeVersion(deployment1.Id)
	version.Metadata = map[string]string{"channel": "stable"}

	mock := &mockGetters{
		deployments: map[string]*oapi.Deployment{
			deployment1.Id: deployment1,
			deployment2.Id: deployment2,
		},
		releaseTargets: map[string][]*oapi.ReleaseTarget{
			resourceID: {rt1, rt2},
		},
		deployedVersions: map[string]*oapi.DeploymentVersion{
			rt1.Key(): version,
		},
	}

	cel := fmt.Sprintf(
		"deployment.id == '%s' && version.metadata.channel == 'stable'",
		deployment1.Id,
	)
	rule := generateDependencyRule(cel)
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt2.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt2.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt2.DeploymentId},
	})
	assert.True(t, result.Allowed, "expected allowed when version metadata matches")
}

func TestDeploymentDependencyEvaluator_NoDeployedVersionFails(t *testing.T) {
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
		deployedVersions: map[string]*oapi.DeploymentVersion{},
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
		"expected denied when no upstream release targets have deployed versions",
	)
}

func TestDeploymentDependencyEvaluator_PassesWhenAtLeastOneUpstreamMatches(t *testing.T) {
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
		deployedVersions: map[string]*oapi.DeploymentVersion{
			rt1.Key(): makeVersion(deployment1.Id),
			// rt2 has no deployed version
		},
	}

	cel := fmt.Sprintf("deployment.id == '%s'", deployment1.Id)
	rule := generateDependencyRule(cel)

	eval := NewEvaluator(mock, rule)

	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: rt3.EnvironmentId},
		Resource:    &oapi.Resource{Id: rt3.ResourceId},
		Deployment:  &oapi.Deployment{Id: rt3.DeploymentId},
	})
	assert.True(
		t,
		result.Allowed,
		"expected allowed when at least one upstream matches",
	)
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
		deployedVersions: map[string]*oapi.DeploymentVersion{},
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
		"expected denied when upstream release target doesn't exist for resource",
	)
}

func TestDeploymentDependencyEvaluator_NoReleaseTargetsForResource(t *testing.T) {
	ctx := context.Background()

	resourceID := uuid.New().String()
	envID := uuid.New().String()
	deploymentID := uuid.New().String()

	mock := &mockGetters{
		deployments:      map[string]*oapi.Deployment{},
		releaseTargets:   map[string][]*oapi.ReleaseTarget{},
		deployedVersions: map[string]*oapi.DeploymentVersion{},
	}

	rule := generateDependencyRule("deployment.name == 'something'")
	eval := NewEvaluator(mock, rule)
	result := eval.Evaluate(ctx, evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: envID},
		Resource:    &oapi.Resource{Id: resourceID},
		Deployment:  &oapi.Deployment{Id: deploymentID},
	})
	assert.False(t, result.Allowed, "expected denied when no release targets exist")
}
