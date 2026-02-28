package controllers_test

import (
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// ---------------------------------------------------------------------------
// Basic skip: bypass an approval rule
// ---------------------------------------------------------------------------

func TestPolicySkip_BypassesApprovalRule(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
		WithPolicySkip(ruleID, versionID, PolicySkipReason("emergency hotfix")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Without skip the same setup blocks
// ---------------------------------------------------------------------------

func TestPolicySkip_WithoutSkip_PolicyBlocks(t *testing.T) {
	ruleID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Expired skip does not bypass
// ---------------------------------------------------------------------------

func TestPolicySkip_Expired_DoesNotBypass(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
		WithPolicySkip(ruleID, versionID,
			PolicySkipReason("expired skip"),
			PolicySkipCreatedAt(time.Now().Add(-2*time.Hour)),
			PolicySkipExpiresAt(time.Now().Add(-1*time.Hour)),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Non-expired skip (future expiry) still bypasses
// ---------------------------------------------------------------------------

func TestPolicySkip_FutureExpiry_StillBypasses(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
		WithPolicySkip(ruleID, versionID,
			PolicySkipReason("time-limited skip"),
			PolicySkipExpiresAt(time.Now().Add(24*time.Hour)),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Skip targets wrong rule — does not bypass
// ---------------------------------------------------------------------------

func TestPolicySkip_WrongRuleID_DoesNotBypass(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
		WithPolicySkip(uuid.New().String(), versionID,
			PolicySkipReason("skip for a different rule"),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Skip one rule but second rule still blocks
// ---------------------------------------------------------------------------

func TestPolicySkip_SkipsOneRule_SecondRuleStillBlocks(t *testing.T) {
	approvalRuleID := uuid.New().String()
	versionSelectorRuleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID), VersionMetadata(map[string]string{"release": "canary"})),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(approvalRuleID),
				WithApprovalRule(1),
			),
			WithPolicyRule(
				PolicyRuleID(versionSelectorRuleID),
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		// Skip the approval rule, but the version selector rule still blocks.
		WithPolicySkip(approvalRuleID, versionID, PolicySkipReason("bypass approval")),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Skip both rules — release created
// ---------------------------------------------------------------------------

func TestPolicySkip_SkipsBothRules_ReleaseCreated(t *testing.T) {
	approvalRuleID := uuid.New().String()
	versionSelectorRuleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID), VersionMetadata(map[string]string{"release": "canary"})),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(approvalRuleID),
				WithApprovalRule(1),
			),
			WithPolicyRule(
				PolicyRuleID(versionSelectorRuleID),
				WithVersionSelectorRule(`version.metadata["release"] == "stable"`),
			),
		),
		WithPolicySkip(approvalRuleID, versionID, PolicySkipReason("bypass approval")),
		WithPolicySkip(versionSelectorRuleID, versionID, PolicySkipReason("bypass version selector")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Skip for first version only — second version selected
// ---------------------------------------------------------------------------

func TestPolicySkip_PerVersion_FirstBlockedSecondSkipped(t *testing.T) {
	ruleID := uuid.New().String()
	v1ID := uuid.New().String()
	v2ID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v2.0.0"), VersionID(v2ID)),
		WithVersion(VersionTag("v1.0.0"), VersionID(v1ID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
	)

	// Only v1 has a skip; v2 (evaluated first) is still blocked.
	p.ReleaseGetter.PolicySkipsFn = func(versionID, _, _ string) []*oapi.PolicySkip {
		if versionID == v1ID {
			return []*oapi.PolicySkip{{
				Id:        uuid.New().String(),
				RuleId:    ruleID,
				VersionId: v1ID,
				Reason:    "hotfix for v1",
				CreatedAt: time.Now(),
				CreatedBy: "admin",
			}}
		}
		return nil
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Skip with version selector — skip lets blocked version through
// ---------------------------------------------------------------------------

func TestPolicySkip_BypassesVersionSelector(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0-rc1"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithVersionSelectorRule(`version.tag == "v1.0.0"`),
			),
		),
		// Tag is v1.0.0-rc1 which doesn't match the selector, but skip overrides.
		WithPolicySkip(ruleID, versionID, PolicySkipReason("allow RC for hotfix")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0-rc1")
}

// ---------------------------------------------------------------------------
// Dynamic: add skip after initial blocked run
// ---------------------------------------------------------------------------

func TestPolicySkip_Dynamic_AddSkipAfterBlock(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
	)

	// Round 1: no skip, policy blocks.
	p.Run()
	p.AssertNoRelease(t)

	// Round 2: add skip, re-run.
	p.ReleaseGetter.PolicySkips = []*oapi.PolicySkip{{
		Id:        uuid.New().String(),
		RuleId:    ruleID,
		VersionId: versionID,
		Reason:    "emergency override",
		CreatedAt: time.Now(),
		CreatedBy: "admin",
	}}

	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Dynamic: remove skip after allowed run
// ---------------------------------------------------------------------------

func TestPolicySkip_Dynamic_RemoveSkipReblocks(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
	)

	// Round 1: with skip, release created.
	p.ReleaseGetter.PolicySkips = []*oapi.PolicySkip{{
		Id:        uuid.New().String(),
		RuleId:    ruleID,
		VersionId: versionID,
		Reason:    "temporary override",
		CreatedAt: time.Now(),
		CreatedBy: "admin",
	}}

	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseCount(t, 1)

	// Round 2: remove skip, re-run — no additional release.
	p.ReleaseGetter.PolicySkips = nil
	releaseCountBefore := len(p.Releases())

	p.EnqueueSelectorEval()
	p.Run()

	assert.Equal(t, releaseCountBefore, len(p.Releases()),
		"after removing skip, no new release should be created")
}

// ---------------------------------------------------------------------------
// Multiple versions: skip unblocks only the targeted version
// ---------------------------------------------------------------------------

func TestPolicySkip_MultipleVersions_OnlyTargetedVersionUnblocked(t *testing.T) {
	ruleID := uuid.New().String()
	v1ID := uuid.New().String()
	v2ID := uuid.New().String()
	v3ID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v3.0.0"), VersionID(v3ID)),
		WithVersion(VersionTag("v2.0.0"), VersionID(v2ID)),
		WithVersion(VersionTag("v1.0.0"), VersionID(v1ID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
	)

	// Skip only v2 — v3 (evaluated first) is still blocked, v2 passes.
	p.ReleaseGetter.PolicySkipsFn = func(versionID, _, _ string) []*oapi.PolicySkip {
		if versionID == v2ID {
			return []*oapi.PolicySkip{{
				Id:        uuid.New().String(),
				RuleId:    ruleID,
				VersionId: v2ID,
				Reason:    "allow v2 only",
				CreatedAt: time.Now(),
				CreatedBy: "admin",
			}}
		}
		return nil
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

// ---------------------------------------------------------------------------
// Two-phase: verify block, then add skip and verify release
// ---------------------------------------------------------------------------

func TestPolicySkip_BlockThenSkipCreatesRelease(t *testing.T) {
	ruleID := uuid.New().String()
	versionID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				PolicyRuleID(ruleID),
				WithApprovalRule(1),
			),
		),
	)

	// Phase 1: no skip configured — policy blocks release creation.
	p.Run()
	p.AssertNoRelease(t)

	// Phase 2: add a policy skip targeting the rule and re-evaluate.
	p.Scenario.PolicySkips = append(p.Scenario.PolicySkips, &oapi.PolicySkip{
		Id:        uuid.New().String(),
		RuleId:    ruleID,
		VersionId: versionID,
		Reason:    "hotfix override",
		CreatedAt: time.Now(),
		CreatedBy: "admin",
	})
	p.ReleaseGetter.PolicySkips = p.Scenario.PolicySkips

	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseCount(t, 1)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}
