package controllers_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"
)

// ---------------------------------------------------------------------------
// Approval + version selector: both must pass
// ---------------------------------------------------------------------------

func TestCombinedPolicy_ApprovalAndVersionSelector_BothPass(t *testing.T) {
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		WithApprovalRecord(oapi.ApprovalStatusApproved, versionID, ""),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Approval + version selector: approval blocks
// ---------------------------------------------------------------------------

func TestCombinedPolicy_ApprovalAndVersionSelector_ApprovalBlocks(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		// No approval record -> approval blocks.
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Approval + version selector: version selector blocks
// ---------------------------------------------------------------------------

func TestCombinedPolicy_ApprovalAndVersionSelector_SelectorBlocks(t *testing.T) {
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionMetadata(map[string]string{"release": "canary"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		WithApprovalRecord(oapi.ApprovalStatusApproved, versionID, ""),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Deployment window + version cooldown: both must pass
// ---------------------------------------------------------------------------

func TestCombinedPolicy_DeploymentWindowAndCooldown_BothPass(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentWindowRule(
					"FREQ=MINUTELY;INTERVAL=1",
					1440,
					AllowWindow(),
				),
			),
			WithPolicyRule(
				WithVersionCooldownRule(3600),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true
	// No previous jobs/releases -> first deployment for cooldown, window is open.

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Deployment window blocks even when cooldown passes
// ---------------------------------------------------------------------------

func TestCombinedPolicy_DeploymentWindowBlocks_CooldownPasses(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentWindowRule(
					"FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3",
					30,
					AllowWindow(),
				),
			),
			WithPolicyRule(
				WithVersionCooldownRule(60),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Multiple policies with different selectors: only matching policies apply
// ---------------------------------------------------------------------------

func TestCombinedPolicy_DifferentSelectors_OnlyMatchingApplies(t *testing.T) {
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		// This policy targets production only -> should NOT apply.
		WithPolicy(
			PolicySelector(`environment.name == "production"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(5),
			),
		),
		// This policy targets staging -> should apply.
		WithPolicy(
			PolicySelector(`environment.name == "staging"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule("true"),
			),
		),
	)

	p.Run()

	// Approval rule doesn't apply (production only), version selector passes.
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Two policies, both must be satisfied
// ---------------------------------------------------------------------------

func TestCombinedPolicy_TwoPolicies_BothMustPass(t *testing.T) {
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			PolicyName("approval-policy"),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			PolicyName("version-policy"),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		WithApprovalRecord(oapi.ApprovalStatusApproved, versionID, ""),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// One of two policies fails -> blocked
// ---------------------------------------------------------------------------

func TestCombinedPolicy_TwoPolicies_OneFails_Blocked(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			PolicyName("approval-policy"),
			WithPolicyRule(
				WithApprovalRule(1),
			),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			PolicyName("version-policy"),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		// No approval record -> approval policy blocks.
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Policy skip bypasses one rule but others still evaluated
// ---------------------------------------------------------------------------

func TestCombinedPolicy_SkipBypassesOneRule_OtherStillEvaluated(t *testing.T) {
	approvalRuleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(approvalRuleID),
				WithApprovalRule(1),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		// Skip the approval rule but version selector still applies.
		WithPolicySkip(approvalRuleID, versionID, PolicySkipReason("emergency")),
	)

	p.Run()

	// Approval is skipped, version selector passes -> release created.
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Policy skip bypasses one rule, other rule blocks
// ---------------------------------------------------------------------------

func TestCombinedPolicy_SkipBypassesOneRule_OtherBlocks(t *testing.T) {
	approvalRuleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionMetadata(map[string]string{"release": "canary"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(approvalRuleID),
				WithApprovalRule(1),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		// Skip the approval but version selector blocks ("canary" != "stable").
		WithPolicySkip(approvalRuleID, versionID, PolicySkipReason("emergency")),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Deployment dependency + version selector combined
// ---------------------------------------------------------------------------

func TestCombinedPolicy_DependencyAndVersionSelector(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstreamRTKey := upstreamDeploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {Id: upstreamDeploymentID.String(), Name: "upstream-app"},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{
				DeploymentId:  upstreamDeploymentID.String(),
				EnvironmentId: environmentID.String(),
				ResourceId:    resourceID.String(),
			},
			{
				DeploymentId:  deploymentID.String(),
				EnvironmentId: environmentID.String(),
				ResourceId:    resourceID.String(),
			},
		},
	}
	completedAt := time.Now().Add(-10 * time.Minute)
	p.ReleaseGetter.LatestCompletedJobs = map[string]*oapi.Job{
		upstreamRTKey: {
			Id:          uuid.New().String(),
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &completedAt,
		},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Deployment dependency blocks when combined with passing version selector
// ---------------------------------------------------------------------------

func TestCombinedPolicy_DependencyBlocks_VersionSelectorPasses(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "nonexistent"`),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Mixed: enabled + disabled policies
// ---------------------------------------------------------------------------

func TestCombinedPolicy_MixedEnabledDisabled(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		// Disabled policy with blocking approval.
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			PolicyName("disabled-approval"),
			WithPolicyRule(
				WithApprovalRule(99),
			),
		),
		// Enabled policy with passing version selector.
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			PolicyName("enabled-selector"),
			WithPolicyRule(
				WithVersionSelectorRule("true"),
			),
		),
	)

	p.Run()

	// Disabled approval doesn't apply, enabled selector passes.
	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Deployment window + approval + version selector: all pass
// ---------------------------------------------------------------------------

func TestCombinedPolicy_ThreePolicyTypes_AllPass(t *testing.T) {
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionMetadata(map[string]string{"release": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithApprovalRule(1),
			),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
			WithPolicyRule(
				WithDeploymentWindowRule(
					"FREQ=MINUTELY;INTERVAL=1",
					1440,
					AllowWindow(),
				),
			),
		),
		WithApprovalRecord(oapi.ApprovalStatusApproved, versionID, ""),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Fallback to second version when first is blocked by one policy
// ---------------------------------------------------------------------------

func TestCombinedPolicy_FallbackToSecondVersion(t *testing.T) {
	v1ID := uuid.New().String()
	v2ID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionID(v1ID),
			VersionMetadata(map[string]string{"release": "canary"}),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(v2ID),
			VersionMetadata(map[string]string{"release": "stable"}),
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

	// v2.0.0 is canary (blocked), v1.0.0 is stable (passes).
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// No policies at all -> release created (everything eligible)
// ---------------------------------------------------------------------------

func TestCombinedPolicy_NoPolicies_ReleaseCreated(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}
