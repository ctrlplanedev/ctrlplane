package controllers_test

import (
	"testing"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentversiondependency"
	. "workspace-engine/test/controllers/harness"
)

// These tests exercise the deployment-version-dependency evaluator end-to-end
// through the desired-release pipeline. They use the deployment_dependency
// edge mechanism (NOT the older policy-rule deployment dependency, which is
// covered by policy_deployment_dependency_test.go).

// ---------------------------------------------------------------------------
// No dependencies declared -> release proceeds normally
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_NoDependencies_Allowed(t *testing.T) {
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

// ---------------------------------------------------------------------------
// Dependency satisfied: upstream's current version matches selector -> allowed
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_DependencySatisfied_Allowed(t *testing.T) {
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
	)

	p.ReleaseGetter.DeploymentDependencies = map[string][]deploymentversiondependency.DependencyEdge{
		deploymentID.String(): {
			{
				DependencyDeploymentID: upstreamDeploymentID.String(),
				VersionSelector:        `version.tag == "v2.0.0"`,
			},
		},
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{
		{
			DeploymentId:  upstreamDeploymentID.String(),
			EnvironmentId: environmentID.String(),
			ResourceId:    resourceID.String(),
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
// Dependency unsatisfied: upstream's current version doesn't match -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_DependencyUnsatisfied_Blocked(t *testing.T) {
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
	)

	p.ReleaseGetter.DeploymentDependencies = map[string][]deploymentversiondependency.DependencyEdge{
		deploymentID.String(): {
			{
				DependencyDeploymentID: upstreamDeploymentID.String(),
				VersionSelector:        `version.tag == "v2.0.0"`,
			},
		},
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{
		{
			DeploymentId:  upstreamDeploymentID.String(),
			EnvironmentId: environmentID.String(),
			ResourceId:    resourceID.String(),
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
// Upstream not deployed on this resource -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_UpstreamMissingOnResource_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.ReleaseGetter.DeploymentDependencies = map[string][]deploymentversiondependency.DependencyEdge{
		deploymentID.String(): {
			{
				DependencyDeploymentID: upstreamDeploymentID.String(),
				VersionSelector:        `true`,
			},
		},
	}
	// Upstream has no release target on this resource at all.
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Upstream has release target but no successful release yet -> blocked
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_UpstreamNoSuccessfulRelease_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstreamDeploymentID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.ReleaseGetter.DeploymentDependencies = map[string][]deploymentversiondependency.DependencyEdge{
		deploymentID.String(): {
			{
				DependencyDeploymentID: upstreamDeploymentID.String(),
				VersionSelector:        `true`,
			},
		},
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{
		{
			DeploymentId:  upstreamDeploymentID.String(),
			EnvironmentId: environmentID.String(),
			ResourceId:    resourceID.String(),
		},
	}
	// No CurrentlyDeployedVersions entry → no successful release.
	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{}

	p.Run()

	p.AssertNoRelease(t)
}

// ---------------------------------------------------------------------------
// Multiple dependencies, all satisfied -> allowed
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_MultipleDependenciesAllSatisfied_Allowed(t *testing.T) {
	deploymentID := uuid.New()
	upstream1ID := uuid.New()
	upstream2ID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstream1Key := upstream1ID.String() + ":" + environmentID.String() + ":" + resourceID.String()
	upstream2Key := upstream2ID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.ReleaseGetter.DeploymentDependencies = map[string][]deploymentversiondependency.DependencyEdge{
		deploymentID.String(): {
			{
				DependencyDeploymentID: upstream1ID.String(),
				VersionSelector:        `version.tag == "v1.0.0"`,
			},
			{
				DependencyDeploymentID: upstream2ID.String(),
				VersionSelector:        `version.tag == "v2.0.0"`,
			},
		},
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{
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
	}
	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstream1Key: {
			Id: uuid.New().String(), Tag: "v1.0.0", Name: "u1",
			DeploymentId: upstream1ID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
		upstream2Key: {
			Id: uuid.New().String(), Tag: "v2.0.0", Name: "u2",
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
// Multiple dependencies, one unsatisfied -> blocked (AND semantics)
// ---------------------------------------------------------------------------

func TestDeploymentVersionDependency_MultipleDependenciesOneFails_Blocked(t *testing.T) {
	deploymentID := uuid.New()
	upstream1ID := uuid.New()
	upstream2ID := uuid.New()
	environmentID := uuid.New()
	resourceID := uuid.New()

	upstream1Key := upstream1ID.String() + ":" + environmentID.String() + ":" + resourceID.String()
	upstream2Key := upstream2ID.String() + ":" + environmentID.String() + ":" + resourceID.String()

	p := NewTestPipeline(t,
		WithDeployment(DeploymentSelector("true"), DeploymentID(deploymentID)),
		WithEnvironment(EnvironmentName("production"), EnvironmentID(environmentID)),
		WithResource(ResourceName("srv-1"), ResourceKind("Server"), ResourceID(resourceID)),
		WithVersion(VersionTag("v1.0.0")),
	)

	p.ReleaseGetter.DeploymentDependencies = map[string][]deploymentversiondependency.DependencyEdge{
		deploymentID.String(): {
			{
				DependencyDeploymentID: upstream1ID.String(),
				VersionSelector:        `version.tag == "v1.0.0"`,
			},
			{
				DependencyDeploymentID: upstream2ID.String(),
				VersionSelector:        `version.tag == "v2.0.0"`,
			},
		},
	}
	p.ReleaseGetter.ReleaseTargetsList = []*oapi.ReleaseTarget{
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
	}
	p.ReleaseGetter.CurrentlyDeployedVersions = map[string]*oapi.DeploymentVersion{
		upstream1Key: {
			Id: uuid.New().String(), Tag: "v1.0.0", Name: "u1",
			DeploymentId: upstream1ID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
		// upstream2 has the wrong version
		upstream2Key: {
			Id: uuid.New().String(), Tag: "v3.0.0", Name: "u2-wrong",
			DeploymentId: upstream2ID.String(),
			Status:       oapi.DeploymentVersionStatusReady,
			Metadata:     map[string]string{},
		},
	}

	p.Run()

	p.AssertNoRelease(t)
}
