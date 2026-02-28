package controllers_test

import (
	"testing"

	. "workspace-engine/test/controllers/harness"
)

// ---------------------------------------------------------------------------
// Approval policy blocks
// ---------------------------------------------------------------------------

func TestPolicy_ApprovalBlocks(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v2.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
	)

	p.RunPipeline()

	p.AssertNoRelease(t)
}

func TestPolicy_NonMatchingSelector_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("false"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(5),
			),
		),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestPolicy_Disabled_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			WithPolicyRule(
				WithApprovalRule(10),
			),
		),
	)

	p.RunPipeline()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestPolicy_AllVersionsBlocked_NoRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithVersion(VersionTag("v2.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
	)

	p.RunPipeline()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Multiple policies
// ---------------------------------------------------------------------------

func TestPolicy_MultiplePolicies_AllMustPass(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicyName("pass-through"),
			PolicySelector("true"),
			PolicyEnabled(true),
		),
		WithPolicy(
			PolicyName("blocker"),
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
	)

	p.RunPipeline()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// CEL policy selector matching
// ---------------------------------------------------------------------------

func TestPolicy_CELSelector_MatchesEnvironment(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector(`environment.name == "production"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
	)

	p.RunPipeline()

	// Policy targets "production" but env is "staging", so it doesn't match
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestPolicy_CELSelector_MatchesDeployment(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(
			DeploymentSelector("true"),
			DeploymentName("critical-app"),
		),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector(`deployment.name == "critical-app"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
	)

	p.RunPipeline()

	// Policy matches: deployment name is "critical-app"
	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Version selector policy — only specific version passes
// ---------------------------------------------------------------------------

func TestPolicy_VersionSelector_OnlySecondVersionPasses(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionMetadata(map[string]string{"release": "canary"}),
		),
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
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseCount(t, 1)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

func TestPolicy_VersionSelector_TagBased(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v3.0.0-rc1")),
		WithVersion(VersionTag("v2.0.0")),
		WithVersion(VersionTag("v1.0.0-beta")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.tag == "v2.0.0"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseCount(t, 1)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

func TestPolicy_VersionSelector_NonePass(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionMetadata(map[string]string{"release": "canary"}),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionMetadata(map[string]string{"release": "canary"}),
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
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}
