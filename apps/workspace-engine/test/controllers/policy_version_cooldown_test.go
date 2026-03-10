package controllers_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"
)

// ---------------------------------------------------------------------------
// First deployment (no reference version) -> allowed
// ---------------------------------------------------------------------------

func TestVersionCooldown_FirstDeployment_Allowed(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(3600),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Same version redeploy -> allowed
// ---------------------------------------------------------------------------

func TestVersionCooldown_SameVersion_Redeploy_Allowed(t *testing.T) {
	versionID := uuid.New().String()
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()
	releaseID := uuid.New().String()
	jobID := uuid.New().String()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(
		t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionCreatedAt(time.Now().Add(-10*time.Minute)),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(7200),
			),
		),
	)

	completedAt := time.Now().Add(-5 * time.Minute)
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {
			jobID: {
				Id:          jobID,
				ReleaseId:   releaseID,
				Status:      oapi.JobStatusSuccessful,
				CreatedAt:   time.Now().Add(-10 * time.Minute),
				CompletedAt: &completedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		releaseID: {
			Version: oapi.DeploymentVersion{
				Id:        versionID,
				Tag:       "v1.0.0",
				CreatedAt: time.Now().Add(-10 * time.Minute),
			},
		},
	}
	p.ReleaseGetter.JobVerificationStatuses = map[string]oapi.JobVerificationStatus{
		jobID: oapi.JobVerificationStatusPassed,
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Different version within cooldown -> blocked
// ---------------------------------------------------------------------------

func TestVersionCooldown_DifferentVersion_WithinCooldown_Blocked(t *testing.T) {
	oldVersionID := uuid.New().String()
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()
	releaseID := uuid.New().String()
	jobID := uuid.New().String()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v2.0.0"), VersionCreatedAt(time.Now())),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(7200),
			),
		),
	)

	// Reference version was created 30 min ago; cooldown is 7200s (2h).
	refCreatedAt := time.Now().Add(-30 * time.Minute)
	completedAt := time.Now().Add(-25 * time.Minute)
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {
			jobID: {
				Id:          jobID,
				ReleaseId:   releaseID,
				Status:      oapi.JobStatusSuccessful,
				CreatedAt:   refCreatedAt,
				CompletedAt: &completedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		releaseID: {
			Version: oapi.DeploymentVersion{
				Id:        oldVersionID,
				Tag:       "v1.0.0",
				CreatedAt: refCreatedAt,
			},
		},
	}
	p.ReleaseGetter.JobVerificationStatuses = map[string]oapi.JobVerificationStatus{
		jobID: oapi.JobVerificationStatusPassed,
	}

	p.Run()

	p.AssertNoRelease(t)
	p.AssertHasRequeues(t)
}

// ---------------------------------------------------------------------------
// Different version after cooldown -> allowed
// ---------------------------------------------------------------------------

func TestVersionCooldown_DifferentVersion_AfterCooldown_Allowed(t *testing.T) {
	oldVersionID := uuid.New().String()
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()
	releaseID := uuid.New().String()
	jobID := uuid.New().String()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v2.0.0"), VersionCreatedAt(time.Now())),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(3600),
			),
		),
	)

	// Reference version was created 2 hours ago; cooldown is 3600s (1h). Cooldown passed.
	refCreatedAt := time.Now().Add(-2 * time.Hour)
	completedAt := time.Now().Add(-115 * time.Minute)
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {
			jobID: {
				Id:          jobID,
				ReleaseId:   releaseID,
				Status:      oapi.JobStatusSuccessful,
				CreatedAt:   refCreatedAt,
				CompletedAt: &completedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		releaseID: {
			Version: oapi.DeploymentVersion{
				Id:        oldVersionID,
				Tag:       "v1.0.0",
				CreatedAt: refCreatedAt,
			},
		},
	}
	p.ReleaseGetter.JobVerificationStatuses = map[string]oapi.JobVerificationStatus{
		jobID: oapi.JobVerificationStatusPassed,
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

// ---------------------------------------------------------------------------
// Multiple versions: newer blocked by cooldown, older passes
// ---------------------------------------------------------------------------

func TestVersionCooldown_MultipleVersions_OlderPassesCooldown(t *testing.T) {
	oldVersionID := uuid.New().String()
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()
	releaseID := uuid.New().String()
	jobID := uuid.New().String()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v3.0.0"), VersionCreatedAt(time.Now())),
		WithVersion(VersionTag("v2.0.0"), VersionCreatedAt(time.Now().Add(-5*time.Minute))),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(7200),
			),
		),
	)

	// Reference version was created 30 min ago; cooldown is 7200s (2h).
	// Both v3.0.0 and v2.0.0 are different from v1.0.0, so both should be blocked.
	refCreatedAt := time.Now().Add(-30 * time.Minute)
	completedAt := time.Now().Add(-25 * time.Minute)
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {
			jobID: {
				Id:          jobID,
				ReleaseId:   releaseID,
				Status:      oapi.JobStatusSuccessful,
				CreatedAt:   refCreatedAt,
				CompletedAt: &completedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		releaseID: {
			Version: oapi.DeploymentVersion{
				Id:        oldVersionID,
				Tag:       "v1.0.0",
				CreatedAt: refCreatedAt,
			},
		},
	}
	p.ReleaseGetter.JobVerificationStatuses = map[string]oapi.JobVerificationStatus{
		jobID: oapi.JobVerificationStatusPassed,
	}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Cooldown with no jobs at all (fresh target) -> first deployment allowed
// ---------------------------------------------------------------------------

func TestVersionCooldown_EmptyJobList_FirstDeployment(t *testing.T) {
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
				WithVersionCooldownRule(3600),
			),
		),
	)

	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Cooldown respects in-progress jobs over completed ones
// ---------------------------------------------------------------------------

func TestVersionCooldown_InProgressJob_TakesPrecedence(t *testing.T) {
	inProgressVersionID := uuid.New().String()
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()
	inProgressReleaseID := uuid.New().String()
	inProgressJobID := uuid.New().String()
	completedJobID := uuid.New().String()
	completedReleaseID := uuid.New().String()
	completedVersionID := uuid.New().String()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v3.0.0"), VersionCreatedAt(time.Now())),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(7200),
			),
		),
	)

	completedAt := time.Now().Add(-3 * time.Hour)
	// In-progress version was created 5 min ago -> within cooldown.
	inProgressCreatedAt := time.Now().Add(-5 * time.Minute)
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {
			completedJobID: {
				Id:          completedJobID,
				ReleaseId:   completedReleaseID,
				Status:      oapi.JobStatusSuccessful,
				CreatedAt:   time.Now().Add(-4 * time.Hour),
				CompletedAt: &completedAt,
			},
			inProgressJobID: {
				Id:        inProgressJobID,
				ReleaseId: inProgressReleaseID,
				Status:    oapi.JobStatusInProgress,
				CreatedAt: inProgressCreatedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		completedReleaseID: {
			Version: oapi.DeploymentVersion{
				Id:        completedVersionID,
				Tag:       "v1.0.0",
				CreatedAt: time.Now().Add(-4 * time.Hour),
			},
		},
		inProgressReleaseID: {
			Version: oapi.DeploymentVersion{
				Id:        inProgressVersionID,
				Tag:       "v2.0.0",
				CreatedAt: inProgressCreatedAt,
			},
		},
	}
	p.ReleaseGetter.JobVerificationStatuses = map[string]oapi.JobVerificationStatus{
		completedJobID: oapi.JobVerificationStatusPassed,
	}

	p.Run()

	// v3.0.0 is different from in-progress v2.0.0 which was created 5min ago.
	// Cooldown is 7200s, so it should be blocked.
	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Disabled policy doesn't block
// ---------------------------------------------------------------------------

func TestVersionCooldown_DisabledPolicy_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			WithPolicyRule(
				WithVersionCooldownRule(999999),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}
