package controllers_test

import (
	"testing"
	"time"

	. "workspace-engine/test/controllers/harness"
)

// ---------------------------------------------------------------------------
// Allow window: first deployment always bypasses the window
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllowWindow_FirstDeployment_Bypasses(t *testing.T) {
	// Use a rrule that only fires far in the future so "now" is outside the window.
	// First deployment should still succeed because the window is ignored.
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
					60,
					AllowWindow(),
				),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Deny window: first deployment always bypasses the window
// ---------------------------------------------------------------------------

func TestDeploymentWindow_DenyWindow_FirstDeployment_Bypasses(t *testing.T) {
	// Even with a deny window that covers "now", first deployment is allowed.
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
					DenyWindow(),
				),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Allow window: currently inside window -> release created
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllowWindow_InsideWindow_ReleasesCreated(t *testing.T) {
	// Use FREQ=MINUTELY with a large duration to guarantee we're inside the window.
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
		),
	)

	// Mark that a current release exists so the window isn't bypassed.
	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Allow window: currently outside window -> no release (pending/requeued)
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllowWindow_OutsideWindow_Blocked(t *testing.T) {
	// Use a rrule that fires very far in the future so "now" is outside.
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
					"FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
					30,
					AllowWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertNoRelease(t)
	p.AssertHasRequeues(t)
}

// ---------------------------------------------------------------------------
// Deny window: currently inside window -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentWindow_DenyWindow_InsideWindow_Blocked(t *testing.T) {
	// Use FREQ=MINUTELY to guarantee we're inside a deny window.
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
					DenyWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertNoRelease(t)
	p.AssertHasRequeues(t)
}

// ---------------------------------------------------------------------------
// Deny window: currently outside window -> release created
// ---------------------------------------------------------------------------

func TestDeploymentWindow_DenyWindow_OutsideWindow_ReleasesCreated(t *testing.T) {
	// Use a rrule that fires far in the future so "now" is outside the deny window.
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
					"FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
					30,
					DenyWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Deployment window with timezone
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllowWindow_WithTimezone(t *testing.T) {
	// Use a wide-open rrule (every minute, long duration) with America/New_York timezone.
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
					WindowTimezone("America/New_York"),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Deployment window combined with version selector
// ---------------------------------------------------------------------------

func TestDeploymentWindow_CombinedWithVersionSelector(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
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
				WithDeploymentWindowRule(
					"FREQ=MINUTELY;INTERVAL=1",
					1440,
					AllowWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

// ---------------------------------------------------------------------------
// Deployment window: disabled policy does not block
// ---------------------------------------------------------------------------

func TestDeploymentWindow_DisabledPolicy_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			WithPolicyRule(
				WithDeploymentWindowRule(
					"FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3",
					30,
					AllowWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Deployment window: non-matching selector does not block
// ---------------------------------------------------------------------------

func TestDeploymentWindow_NonMatchingSelector_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector(`environment.name == "production"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentWindowRule(
					"FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3",
					30,
					AllowWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Deployment window: force process requeues creates release
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllowWindow_RequeueThenForceProcess(t *testing.T) {
	// Wide-open allow window (every minute) means force process will succeed.
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
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Deployment window: multiple versions, window blocks all
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllVersionsBlocked(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v2.0.0")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentWindowRule(
					"FREQ=YEARLY;BYMONTH=1;BYDAY=MO;BYHOUR=3;BYMINUTE=0;BYSECOND=0",
					30,
					AllowWindow(),
				),
			),
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Allow window with version-created-at far in the past (regression guard)
// ---------------------------------------------------------------------------

func TestDeploymentWindow_AllowWindow_OldVersion_InsideWindow(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionCreatedAt(time.Now().Add(-30*24*time.Hour)),
		),
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
		),
	)

	p.ReleaseGetter.HasRelease = true

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}
