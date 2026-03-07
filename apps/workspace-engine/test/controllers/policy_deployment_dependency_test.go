package controllers_test

import (
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"

	"github.com/google/uuid"
)

// ---------------------------------------------------------------------------
// Upstream dependency has successful job -> allowed
// ---------------------------------------------------------------------------

func TestDeploymentDependency_UpstreamSuccessful_Allowed(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
		),
	)

	upstreamRT := &oapi.ReleaseTarget{
		DeploymentId:  upstreamDeploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resourceID.String(),
	}
	upstreamRTKey := upstreamDeploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {
			Id:   upstreamDeploymentID.String(),
			Name: "upstream-app",
		},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			upstreamRT,
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
// Upstream dependency has no job -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentDependency_UpstreamNoJob_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
		),
	)

	upstreamRT := &oapi.ReleaseTarget{
		DeploymentId:  upstreamDeploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resourceID.String(),
	}

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {
			Id:   upstreamDeploymentID.String(),
			Name: "upstream-app",
		},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			upstreamRT,
			{
				DeploymentId:  deploymentID.String(),
				EnvironmentId: environmentID.String(),
				ResourceId:    resourceID.String(),
			},
		},
	}
	// No completed jobs for the upstream target.
	p.ReleaseGetter.LatestCompletedJobs = map[string]*oapi.Job{}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Upstream dependency has failed job -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentDependency_UpstreamFailedJob_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstreamRTKey := upstreamDeploymentID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
		),
	)

	upstreamRT := &oapi.ReleaseTarget{
		DeploymentId:  upstreamDeploymentID.String(),
		EnvironmentId: environmentID.String(),
		ResourceId:    resourceID.String(),
	}

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {
			Id:   upstreamDeploymentID.String(),
			Name: "upstream-app",
		},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			upstreamRT,
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
			Status:      oapi.JobStatusFailure,
			CompletedAt: &completedAt,
		},
	}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// No matching upstream deployments -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentDependency_NoMatchingDeployments_Blocked(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "nonexistent-app"`),
			),
		),
	)

	// Empty deployments map means no matching deployments found.
	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Disabled policy doesn't block
// ---------------------------------------------------------------------------

func TestDeploymentDependency_DisabledPolicy_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("production")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(false),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Non-matching policy selector doesn't block
// ---------------------------------------------------------------------------

func TestDeploymentDependency_NonMatchingSelector_DoesNotBlock(t *testing.T) {
	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true")),
		WithEnvironment(EnvironmentName("staging")),
		WithResource(ResourceName("srv-1"), ResourceKind("Server")),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector(`environment.name == "production"`),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
		),
	)

	p.Run()

	p.AssertReleaseCreated(t)
}

// ---------------------------------------------------------------------------
// Multiple upstream dependencies all successful -> allowed
// ---------------------------------------------------------------------------

func TestDeploymentDependency_MultipleUpstreams_AllSuccessful_Allowed(t *testing.T) {
	deploymentID := uuid.New()
	upstream1ID := uuid.New()
	upstream2ID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstream1RTKey := upstream1ID.String() + ":" + environmentID.String() + ":" + resourceID.String()
	upstream2RTKey := upstream2ID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-1" || deployment.name == "upstream-2"`),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstream1ID.String(): {Id: upstream1ID.String(), Name: "upstream-1"},
		upstream2ID.String(): {Id: upstream2ID.String(), Name: "upstream-2"},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{DeploymentId: upstream1ID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
			{DeploymentId: upstream2ID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
			{DeploymentId: deploymentID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
		},
	}

	completedAt := time.Now().Add(-10 * time.Minute)
	p.ReleaseGetter.LatestCompletedJobs = map[string]*oapi.Job{
		upstream1RTKey: {Id: uuid.New().String(), Status: oapi.JobStatusSuccessful, CompletedAt: &completedAt},
		upstream2RTKey: {Id: uuid.New().String(), Status: oapi.JobStatusSuccessful, CompletedAt: &completedAt},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Multiple upstream dependencies, one fails -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentDependency_MultipleUpstreams_OneFails_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstream1ID := uuid.New()
	upstream2ID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstream1RTKey := upstream1ID.String() + ":" + environmentID.String() + ":" + resourceID.String()
	upstream2RTKey := upstream2ID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-1" || deployment.name == "upstream-2"`),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstream1ID.String(): {Id: upstream1ID.String(), Name: "upstream-1"},
		upstream2ID.String(): {Id: upstream2ID.String(), Name: "upstream-2"},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{DeploymentId: upstream1ID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
			{DeploymentId: upstream2ID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
			{DeploymentId: deploymentID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
		},
	}

	completedAt := time.Now().Add(-10 * time.Minute)
	p.ReleaseGetter.LatestCompletedJobs = map[string]*oapi.Job{
		upstream1RTKey: {Id: uuid.New().String(), Status: oapi.JobStatusSuccessful, CompletedAt: &completedAt},
		upstream2RTKey: {Id: uuid.New().String(), Status: oapi.JobStatusFailure, CompletedAt: &completedAt},
	}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Upstream dependency missing release target -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentDependency_UpstreamMissingReleaseTarget_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(`deployment.name == "upstream-app"`),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {
			Id:   upstreamDeploymentID.String(),
			Name: "upstream-app",
		},
	}
	// Resource targets don't include the upstream deployment's target.
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{DeploymentId: deploymentID.String(), EnvironmentId: environmentID.String(), ResourceId: resourceID.String()},
		},
	}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Policy skip bypasses deployment dependency
// ---------------------------------------------------------------------------

func TestDeploymentDependency_PolicySkip_Bypasses(t *testing.T) {
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
				WithDeploymentDependencyRule(`deployment.name == "nonexistent-app"`),
			),
		),
		WithPolicySkip(ruleID, versionID, PolicySkipReason("emergency override")),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}
