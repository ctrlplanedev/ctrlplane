package controllers_test

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"
)

// ===========================================================================
// Version creation → job dispatch
// ===========================================================================

func TestVersion_CreatingVersionDispatchesJobsToAllReleaseTargets(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithResource(ResourceName("server-2"), ResourceKind("Node")),
		WithResource(ResourceName("server-3"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("deployer", JobAgentID(agentID)),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertJobCreated(t)
	p.AssertJobCount(t, 3)
	for i := range 3 {
		p.AssertJobAgentID(t, i, agentID)
		p.AssertJobStatus(t, i, oapi.JobStatusPending)
	}
}

func TestVersion_NewVersionDispatchesJobsForEachAgent(t *testing.T) {
	agent1 := uuid.New().String()
	agent2 := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("argo-cd", JobAgentID(agent1)),
		WithJobAgent("github-app", JobAgentID(agent2)),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertJobCount(t, 2)
	p.AssertJobAgentID(t, 0, agent1)
	p.AssertJobAgentID(t, 1, agent2)
}

func TestVersion_ReleaseLinkedToCorrectVersion(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v3.0.0")),
		WithVersion(VersionTag("v2.0.0")),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v3.0.0")
	p.AssertJobCreated(t)

	release := p.Releases()[0]
	p.AssertJobReleaseID(t, 0, release.Id.String())
}

// ===========================================================================
// Pausing a version stops gradual rollout / blocks new targets
// ===========================================================================

func TestVersion_PausedVersionSkippedForNewTargets(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusPaused),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestVersion_PausedVersionBlocksGradualRollout(t *testing.T) {
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resource1ID := uuid.New()
	resource2ID := uuid.New()

	rt1Key := deploymentID.String() + ":" + environmentID.String() + ":" + resource1ID.String()
	rt2Key := deploymentID.String() + ":" + environmentID.String() + ":" + resource2ID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("server-1"), ResourceKind("Node"), ResourceID(resource1ID)),
		WithResource(ResourceName("server-2"), ResourceKind("Node"), ResourceID(resource2ID)),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusPaused),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
			WithPolicyRule(
				WithGradualRolloutRule(3600, oapi.GradualRolloutRuleRolloutTypeLinear),
			),
		),
	)

	rt1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resource1ID.String(),
	}
	rt2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resource2ID.String(),
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{rt1, rt2}
	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rt1Key: {},
		rt2Key: {},
	}

	p.Run()

	// Paused v2.0.0 is filtered out by version selector, so v1.0.0 is used
	// for the gradual rollout instead
	for _, rel := range p.Releases() {
		assert.Equal(t, "v1.0.0", rel.Version.Tag)
	}
}

func TestVersion_AllPausedNoReadyVersions_NoRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusPaused),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusPaused),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ===========================================================================
// Rejecting a version reverts to the last valid version
// ===========================================================================

func TestVersion_RejectedVersionFallsBackToLastValid(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusRejected),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
	p.AssertJobCreated(t)
}

func TestVersion_RejectedVersionRevertsAllResources(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithResource(ResourceName("server-2"), ResourceKind("Node")),
		WithResource(ResourceName("server-3"), ResourceKind("Node")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusRejected),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertJobCount(t, 3)
	for _, rel := range p.Releases() {
		assert.Equal(t, "v1.0.0", rel.Version.Tag,
			"all resources should revert to v1.0.0 after v2.0.0 is rejected")
	}
}

func TestVersion_AllRejected_NoRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusRejected),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusRejected),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
	p.AssertNoJob(t)
}

// ===========================================================================
// Version lifecycle: adding new versions triggers re-evaluation
// ===========================================================================

func TestVersion_NewVersionTriggersReEvaluationAndNewJobs(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("deployer", JobAgentID(agentID)),
	)

	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertJobCount(t, 1)

	// Simulate a new version being created
	p.ReleaseGetter.Versions = append([]*oapi.DeploymentVersion{
		{
			Id:             uuid.New().String(),
			Tag:            "v2.0.0",
			Name:           "v2",
			DeploymentId:   p.DeploymentID().String(),
			Status:         oapi.DeploymentVersionStatusReady,
			Config:         map[string]any{},
			JobAgentConfig: map[string]any{},
			Metadata:       map[string]string{},
		},
	}, p.ReleaseGetter.Versions...)

	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCount(t, 2)
	p.AssertReleaseVersion(t, 1, "v2.0.0")
	p.AssertJobCount(t, 2)
}

func TestVersion_RejectingActiveVersionCausesRollbackOnReEval(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
		WithJobAgent("deployer"),
	)

	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")

	// Simulate rejecting v2.0.0 — mark it as rejected
	p.ReleaseGetter.Versions[0].Status = oapi.DeploymentVersionStatusRejected

	p.EnqueueSelectorEval()
	p.Run()

	p.AssertReleaseCount(t, 2)
	p.AssertReleaseVersion(t, 1, "v1.0.0")
}

// ===========================================================================
// Version ordering and selection
// ===========================================================================

func TestVersion_NewestReadyVersionIsPreferred(t *testing.T) {
	now := time.Now()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now.Add(-1*time.Hour)),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now.Add(-2*time.Hour)),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v3.0.0")
}

func TestVersion_SkipsNonReadyToFindNewestReady(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v4.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusFailed),
		),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusRejected),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

// ===========================================================================
// Version metadata filtering
// ===========================================================================

func TestVersion_MetadataFilterSelectsCorrectVersion(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v3.0.0-rc1"),
			VersionMetadata(map[string]string{"channel": "beta"}),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionMetadata(map[string]string{"channel": "stable"}),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"channel": "stable"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["channel"] == "stable"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v2.0.0")
}

func TestVersion_MetadataFilterBlocksAllVersions(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionMetadata(map[string]string{"channel": "beta"}),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"channel": "beta"}),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.metadata["channel"] == "stable"`),
			),
		),
	)

	p.Run()

	p.AssertNoRelease(t)
}

// ===========================================================================
// Version with cooldown
// ===========================================================================

func TestVersion_CooldownPreventsRapidVersionChanges(t *testing.T) {
	deploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	rtKey := deploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionCooldownRule(3600),
			),
		),
		WithJobAgent("deployer"),
	)

	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")

	// Wire up the first run's job into the getter so the cooldown evaluator
	// can see a prior deployment. The mock getters are independent structs —
	// jobs created by the setter don't automatically appear in the getter.
	release := p.Releases()[0]
	completedAt := time.Now()
	job := p.Jobs()[0]
	job.Status = oapi.JobStatusSuccessful
	job.CompletedAt = &completedAt

	p.ReleaseGetter.JobsByReleaseTarget = map[string]map[string]*oapi.Job{
		rtKey: {job.Id: job},
	}
	p.ReleaseGetter.Releases = map[string]*oapi.Release{
		release.Id.String(): release,
	}
	p.ReleaseGetter.JobVerificationStatuses = map[string]oapi.JobVerificationStatus{
		job.Id: oapi.JobVerificationStatusPassed,
	}

	// Add a newer version and re-evaluate
	p.ReleaseGetter.Versions = append([]*oapi.DeploymentVersion{
		{
			Id:             uuid.New().String(),
			Tag:            "v2.0.0",
			Name:           "v2",
			DeploymentId:   p.DeploymentID().String(),
			Status:         oapi.DeploymentVersionStatusReady,
			Config:         map[string]any{},
			JobAgentConfig: map[string]any{},
			Metadata:       map[string]string{},
		},
	}, p.ReleaseGetter.Versions...)

	p.EnqueueSelectorEval()
	p.Run()

	// Cooldown should cause a requeue rather than immediate deployment
	p.AssertHasRequeues(t)
}

// ===========================================================================
// Version with approval gate
// ===========================================================================

func TestVersion_RequiresApprovalBeforeDispatch(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(WithApprovalRule(1)),
		),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertNoRelease(t)
	p.AssertNoJob(t)
}

func TestVersion_ApprovedVersionDispatchesJobs(t *testing.T) {
	versionID := uuid.New().String()
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0"), VersionID(versionID)),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(WithApprovalRule(1)),
		),
		WithApprovalRecord(
			oapi.ApprovalStatusApproved,
			versionID,
			"", // any environment
		),
		WithJobAgent("deployer", JobAgentID(agentID)),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertJobCreated(t)
	p.AssertJobAgentID(t, 0, agentID)
}

// ===========================================================================
// Edge cases
// ===========================================================================

func TestVersion_SingleVersion_SingleResource_FullPipeline(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentName("api")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionName("initial-release"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithJobAgent("deployer", JobAgentID(agentID)),
	)

	// Step through each phase to verify the full pipeline
	p.EnqueueSelectorEval()

	n := p.ProcessSelectorEvals()
	require.Equal(t, 1, n)
	p.AssertComputedResourceCount(t, 1)
	p.AssertNoRelease(t)
	p.AssertNoJob(t)

	n = p.ProcessDesiredReleases()
	require.Equal(t, 1, n)
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertNoJob(t)

	n = p.ProcessJobDispatches()
	require.Equal(t, 1, n)
	p.AssertJobCreated(t)
	p.AssertJobCount(t, 1)
	p.AssertJobAgentID(t, 0, agentID)
	p.AssertJobStatus(t, 0, oapi.JobStatusPending)
}

// ===========================================================================
// Pausing and resuming a version
// ===========================================================================

func TestVersion_PauseAndResume(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
		WithJobAgent("deployer"),
	)

	// First run: v1.0.0 is ready, deploys normally
	p.Run()
	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
	p.AssertJobCount(t, 1)

	// Pause v1.0.0
	p.ReleaseGetter.Versions[0].Status = oapi.DeploymentVersionStatusPaused
	p.EnqueueSelectorEval()
	p.Run()

	// No new release while paused (version selector blocks non-ready)
	p.AssertReleaseCount(t, 1)

	// Resume by setting back to ready
	p.ReleaseGetter.Versions[0].Status = oapi.DeploymentVersionStatusReady
	p.EnqueueSelectorEval()
	p.Run()

	// Deploys again after resuming
	p.AssertReleaseCount(t, 2)
	p.AssertReleaseVersion(t, 1, "v1.0.0")
}

// ===========================================================================
// Rapid version succession
// ===========================================================================

func TestVersion_RapidSuccession_OnlyLatestDispatched(t *testing.T) {
	now := time.Now()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now.Add(-1*time.Second)),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now.Add(-2*time.Second)),
		),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseCount(t, 1)
	p.AssertReleaseVersion(t, 0, "v3.0.0")
	p.AssertJobCount(t, 1)
}

func TestVersion_RapidSuccession_MultipleResources_AllGetLatest(t *testing.T) {
	now := time.Now()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("server-1"), ResourceKind("Node")),
		WithResource(ResourceName("server-2"), ResourceKind("Node")),
		WithResource(ResourceName("server-3"), ResourceKind("Node")),
		WithVersion(
			VersionTag("v3.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now),
		),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now.Add(-1*time.Second)),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
			VersionCreatedAt(now.Add(-2*time.Second)),
		),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertJobCount(t, 3)
	for _, rel := range p.Releases() {
		assert.Equal(t, "v3.0.0", rel.Version.Tag,
			"all resources should get the latest version")
	}
}

// ===========================================================================
// Version config flows through to release and job
// ===========================================================================

func TestVersion_ConfigAndMetadataFlowToRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{
				"git-sha":    "abc123",
				"build-url":  "https://ci.example.com/builds/42",
				"image-repo": "ghcr.io/myorg/myapp",
			}),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	release := p.Releases()[0]
	assert.Equal(t, "v1.0.0", release.Version.Tag)
	assert.Equal(t, "abc123", release.Version.Metadata["git-sha"])
	assert.Equal(t, "https://ci.example.com/builds/42", release.Version.Metadata["build-url"])
	assert.Equal(t, "ghcr.io/myorg/myapp", release.Version.Metadata["image-repo"])
}

func TestVersion_JobAgentConfigFlowsToJob(t *testing.T) {
	agentID := uuid.New().String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithJobAgent("deployer",
			JobAgentID(agentID),
			JobAgentConfig(oapi.JobAgentConfig{
				"namespace": "production",
				"cluster":   "us-east-1",
				"timeout":   "300s",
			}),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertJobCreated(t)

	jobs := p.Jobs()
	require.Len(t, jobs, 1)
	assert.Equal(t, "production", jobs[0].JobAgentConfig["namespace"])
	assert.Equal(t, "us-east-1", jobs[0].JobAgentConfig["cluster"])
	assert.Equal(t, "300s", jobs[0].JobAgentConfig["timeout"])
}

func TestVersion_VersionConfigFlowsToRelease(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionMetadata(map[string]string{"deploy-strategy": "blue-green"}),
		),
		WithJobAgent("deployer"),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertJobCreated(t)

	release := p.Releases()[0]
	assert.Equal(t, "blue-green", release.Version.Metadata["deploy-strategy"])
	p.AssertJobReleaseID(t, 0, release.Id.String())
}

// ===========================================================================
// More edge cases
// ===========================================================================

func TestVersion_BuildingStatus_NotDeployable(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusBuilding),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestVersion_FailedStatus_NotDeployable(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv"), ResourceKind("Server")),
		WithVersion(
			VersionTag("v2.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusFailed),
		),
		WithVersion(
			VersionTag("v1.0.0"),
			VersionStatus(oapi.DeploymentVersionStatusReady),
		),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithVersionSelectorRule(`version.status == "ready"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}
