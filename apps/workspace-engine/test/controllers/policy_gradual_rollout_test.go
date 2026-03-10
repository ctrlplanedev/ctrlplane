package controllers_test

import (
	"testing"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"
)

// ---------------------------------------------------------------------------
// Single resource with gradual rollout: position 0, immediate deployment
// ---------------------------------------------------------------------------

func TestGradualRollout_SingleResource_ImmediateDeployment(t *testing.T) {
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
	)

	// Provide the release target list so the evaluator can compute rollout positions.
	rt := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resourceID.String(),
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{rt}
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{rtKey: {}}

	p.Run()

	// With only 1 resource, position=0, offset=0, should deploy immediately.
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Gradual rollout: disabled policy does not block
// ---------------------------------------------------------------------------

func TestGradualRollout_DisabledPolicy_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Gradual rollout: non-matching selector does not block
// ---------------------------------------------------------------------------

func TestGradualRollout_NonMatchingSelector_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector(`environment.name == "production"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Gradual rollout: combined with version selector
// ---------------------------------------------------------------------------

func TestGradualRollout_CombinedWithVersionSelector(t *testing.T) {
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"release": "deprecated"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
	)

	rt := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resourceID.String(),
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{rt}
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{rtKey: {}}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

// ---------------------------------------------------------------------------
// Gradual rollout with linear-normalized type: single resource
// ---------------------------------------------------------------------------

func TestGradualRollout_LinearNormalized_SingleResource(t *testing.T) {
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinearNormalized),
			),
		),
	)

	rt := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resourceID.String(),
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{rt}
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{rtKey: {}}

	p.Run()

	// Single resource = position 0/1, normalized offset = 0 -> immediate.
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Gradual rollout: no versions -> no release
// ---------------------------------------------------------------------------

func TestGradualRollout_NoVersions_NoRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Gradual rollout with skip: policy skip bypasses the rollout rule
// ---------------------------------------------------------------------------

func TestGradualRollout_PolicySkip_Bypasses(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithGradualRolloutRule(999999, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
		WithPolicySkip(ruleID, versionID, PolicySkipReason("emergency rollout")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}
