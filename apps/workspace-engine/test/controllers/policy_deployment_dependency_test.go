package controllers_test

import (
	"testing"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	. "workspace-engine/test/controllers/harness"
)

// ---------------------------------------------------------------------------
// Upstream dependency has successful release -> allowed
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

	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstreamRTKey: {
			Id:           uuid.New().String(),
			Tag:          "v2.0.0",
			Name:         "upstream-v2",
			DeploymentId: upstreamDeploymentID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Upstream dependency has no successful release -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentDependency_UpstreamNoRelease_Blocked(t *testing.T) {
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
	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{}

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
// Version selector scopes the dependency
// ---------------------------------------------------------------------------

func TestDeploymentDependency_VersionSelector_Allowed(t *testing.T) {
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
				WithDeploymentDependencyRule(
					`deployment.name == "upstream-app" && version.tag.startsWith("v2.")`,
				),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {
			Id:   upstreamDeploymentID.String(),
			Name: "upstream-app",
		},
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

	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstreamRTKey: {
			Id:           uuid.New().String(),
			Tag:          "v2.1.0",
			Name:         "upstream-v2.1",
			DeploymentId: upstreamDeploymentID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

func TestDeploymentDependency_VersionSelector_WrongVersion_Blocked(t *testing.T) {
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
				WithDeploymentDependencyRule(
					`deployment.name == "upstream-app" && version.tag.startsWith("v2.")`,
				),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstreamDeploymentID.String(): {
			Id:   upstreamDeploymentID.String(),
			Name: "upstream-app",
		},
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

	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstreamRTKey: {
			Id:           uuid.New().String(),
			Tag:          "v1.5.0",
			Name:         "upstream-v1.5",
			DeploymentId: upstreamDeploymentID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
	}

	p.Run()

	p.AssertNoRelease(t)
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
				WithDeploymentDependencyRule(
					`deployment.name == "upstream-1" || deployment.name == "upstream-2"`,
				),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstream1ID.String(): {Id: upstream1ID.String(), Name: "upstream-1"},
		upstream2ID.String(): {Id: upstream2ID.String(), Name: "upstream-2"},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{
				DeploymentId:  upstream1ID.String(),
				EnvironmentId: environmentID.String(),
				ResourceId:    resourceID.String(),
			},
			{
				DeploymentId:  upstream2ID.String(),
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

	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstream1RTKey: {
			Id:           uuid.New().String(),
			Tag:          "v1.0.0",
			Name:         "upstream-1-v1",
			DeploymentId: upstream1ID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
		upstream2RTKey: {
			Id:           uuid.New().String(),
			Tag:          "v1.0.0",
			Name:         "upstream-2-v1",
			DeploymentId: upstream2ID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
}

// ---------------------------------------------------------------------------
// Multiple upstreams, one has no deployed version -> still allowed
// (ANY match semantics: at least one upstream matches the selector)
// ---------------------------------------------------------------------------

func TestDeploymentDependency_MultipleUpstreams_OneWithoutVersion_StillAllowed(t *testing.T) {
	deploymentID := uuid.New()
	upstream1ID := uuid.New()
	upstream2ID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstream1RTKey := upstream1ID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
		WithPolicy(
			PolicySelector("true"),
			PolicyEnabled(true),
			WithPolicyRule(
				WithDeploymentDependencyRule(
					`deployment.name == "upstream-1" || deployment.name == "upstream-2"`,
				),
			),
		),
	)

	p.ReleaseGetter.Deployments = map[string]*oapi.Deployment{
		upstream1ID.String(): {Id: upstream1ID.String(), Name: "upstream-1"},
		upstream2ID.String(): {Id: upstream2ID.String(), Name: "upstream-2"},
	}
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{
				DeploymentId:  upstream1ID.String(),
				EnvironmentId: environmentID.String(),
				ResourceId:    resourceID.String(),
			},
			{
				DeploymentId:  upstream2ID.String(),
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

	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstream1RTKey: {
			Id:           uuid.New().String(),
			Tag:          "v1.0.0",
			Name:         "upstream-1-v1",
			DeploymentId: upstream1ID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
		// upstream-2 has no deployed version
	}

	p.Run()

	p.AssertReleaseCreated(t)
	p.AssertReleaseVersion(t, 0, "v1.0.0")
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
	p.ReleaseGetter.ReleaseTargetsByResource = map[string][]*oapi.ReleaseTarget{
		resourceID.String(): {
			{
				DeploymentId:  deploymentID.String(),
				EnvironmentId: environmentID.String(),
				ResourceId:    resourceID.String(),
			},
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
