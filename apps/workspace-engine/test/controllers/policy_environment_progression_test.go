package controllers_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"
)

// setupEnvProgression is a helper that sets up a two-environment scenario
// where "staging" is the dependency and "production" is the target.
// Returns (deploymentID, stagingEnvID, prodEnvID, resourceID, stagingRTKey).
func setupEnvProgression(
	t *testing.T,
	versionID string,
	opts ...PipelineOption,
) (*TestPipeline, string) {
	t.Helper()

	deploymentID := uuid.New()
	stagingEnvID := uuid.New()
	prodEnvID := uuid.New()
	resourceID := uuid.New()
	systemID := uuid.New().String()

	defaultOpts := []PipelineOption{
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(prodEnvID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionID(versionID),
			VersionCreatedAt(time.Now().Add(-1*time.Hour)),
		),
	}
	defaultOpts = append(defaultOpts, opts...)

	p := NewTestPipeline(t, defaultOpts...)

	// Set up environments. Both share the same system.
	p.ReleaseGetter.Environments = map[string]*oapi.Environment{
		stagingEnvID.String(): {
			Id:          stagingEnvID.String(),
			Name:        "staging",
			WorkspaceId: p.WorkspaceID().String(),
		},
		prodEnvID.String(): {
			Id:          prodEnvID.String(),
			Name:        "production",
			WorkspaceId: p.WorkspaceID().String(),
		},
	}
	p.ReleaseGetter.SystemIDsByEnvironment = map[string][]string{
		stagingEnvID.String(): {systemID},
		prodEnvID.String():    {systemID},
	}

	stagingRT := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID.String(),
		EnvironmentId: stagingEnvID.String(),
		ResourceId:    resourceID.String(),
	}
	stagingRTKey := deploymentID.String() + ":" + stagingEnvID.String() + ":" + resourceID.String()

	p.ReleaseGetter.ReleaseTargetsByEnvironment = map[string][]*oapi.ReleaseTarget{
		stagingEnvID.String(): {stagingRT},
	}

	return p, stagingRTKey
}

// ---------------------------------------------------------------------------
// Dependency environment has 100% success -> allowed
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_FullSuccess_Allowed(t *testing.T) {
	versionID := uuid.New().String()
	releaseID := uuid.New().String()

	p, stagingRTKey := setupEnvProgression(t, versionID,
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(100),
				),
			),
		),
	)

	completedAt := time.Now().Add(-30 * time.Minute)
	jobID := uuid.New().String()
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		stagingRTKey: {
			jobID: {
				Id:          jobID,
				ReleaseId:   releaseID,
				Status:      oapi.JobStatusSuccessful,
				CreatedAt:   time.Now().Add(-45 * time.Minute),
				CompletedAt: &completedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		releaseID: {
			Version: oapi.DeploymentVersion{Id: versionID},
		},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Dependency environment has 0% success -> blocked
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_ZeroSuccess_Blocked(t *testing.T) {
	versionID := uuid.New().String()
	releaseID := uuid.New().String()

	p, stagingRTKey := setupEnvProgression(t, versionID,
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(50),
				),
			),
		),
	)

	completedAt := time.Now().Add(-30 * time.Minute)
	jobID := uuid.New().String()
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		stagingRTKey: {
			jobID: {
				Id:          jobID,
				ReleaseId:   releaseID,
				Status:      oapi.JobStatusFailure,
				CreatedAt:   time.Now().Add(-45 * time.Minute),
				CompletedAt: &completedAt,
			},
		},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		releaseID: {
			Version: oapi.DeploymentVersion{Id: versionID},
		},
	}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// No dependency environments found -> blocked
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_NoDependencyEnvs_Blocked(t *testing.T) {
	versionID := uuid.New().String()

	p, _ := setupEnvProgression(t, versionID,
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "nonexistent"`,
				),
			),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// No release targets in dependency environment -> allowed (vacuously)
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_NoReleaseTargets_Allowed(t *testing.T) {
	versionID := uuid.New().String()
	deploymentID := uuid.New()
	stagingEnvID := uuid.New()
	prodEnvID := uuid.New()
	resourceID := uuid.New()
	systemID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(prodEnvID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(100),
				),
			),
		),
	)

	p.ReleaseGetter.Environments = map[string]*oapi.Environment{
		stagingEnvID.String(): {
			Id:          stagingEnvID.String(),
			Name:        "staging",
			WorkspaceId: p.WorkspaceID().String(),
		},
		prodEnvID.String(): {
			Id:          prodEnvID.String(),
			Name:        "production",
			WorkspaceId: p.WorkspaceID().String(),
		},
	}
	p.ReleaseGetter.SystemIDsByEnvironment = map[string][]string{
		stagingEnvID.String(): {systemID},
		prodEnvID.String():    {systemID},
	}
	// Empty: no release targets in staging.
	p.ReleaseGetter.ReleaseTargetsByEnvironment = map[string][]*oapi.ReleaseTarget{
		stagingEnvID.String(): {},
	}

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Disabled policy doesn't block
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_DisabledPolicy_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(100),
				),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Non-matching selector doesn't block
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_NonMatchingSelector_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector(`environment.name == "production"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "dev"`,
					EnvProgressionMinSuccessPercentage(100),
				),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Policy skip bypasses environment progression
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_PolicySkip_Bypasses(t *testing.T) {
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
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(100),
				),
			),
		),
		WithPolicySkip(ruleID, versionID, PolicySkipReason("emergency progression")),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Environments not sharing a system -> ignored
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_DifferentSystems_Blocked(t *testing.T) {
	versionID := uuid.New().String()
	deploymentID := uuid.New()
	stagingEnvID := uuid.New()
	prodEnvID := uuid.New()
	resourceID := uuid.New()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(prodEnvID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(100),
				),
			),
		),
	)

	p.ReleaseGetter.Environments = map[string]*oapi.Environment{
		stagingEnvID.String(): {
			Id:          stagingEnvID.String(),
			Name:        "staging",
			WorkspaceId: p.WorkspaceID().String(),
		},
		prodEnvID.String(): {
			Id:          prodEnvID.String(),
			Name:        "production",
			WorkspaceId: p.WorkspaceID().String(),
		},
	}
	// Different system IDs -> they don't share a system, so staging won't be a dependency.
	p.ReleaseGetter.SystemIDsByEnvironment = map[string][]string{
		stagingEnvID.String(): {"system-a"},
		prodEnvID.String():    {"system-b"},
	}

	p.Run()

	// No matching dependency environments -> blocked.
	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// No jobs in dependency environment -> blocked
// ---------------------------------------------------------------------------

func TestEnvironmentProgression_NoJobs_Blocked(t *testing.T) {
	versionID := uuid.New().String()

	p, stagingRTKey := setupEnvProgression(t, versionID,
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithEnvironmentProgressionRule(
					`environment.name == "staging"`,
					EnvProgressionMinSuccessPercentage(50),
				),
			),
		),
	)

	// No jobs at all.
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		stagingRTKey: {},
	}

	p.Run()

	p.AssertNoRelease(t)
}
