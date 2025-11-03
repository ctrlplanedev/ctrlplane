package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_ReleaseManager_CompleteFlow tests the complete flow of the release manager:
// 1. Creates a release by creating a deployment version
// 2. Verifies the release was created
// 3. Verifies a job was created in pending status
// 4. Verifies the variables on the job
// 5. Verifies the version on the job
func TestEngine_ReleaseManager_CompleteFlow(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resourceId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("app_name"),
				integration.WithDeploymentVariable("replicas"),
				integration.WithDeploymentVariable("debug_mode"),
				integration.WithDeploymentVariable("config"),
				integration.DeploymentJobAgentConfig(map[string]any{
					"namespace": "production",
					"replicas":  3,
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceId),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"zone":   "us-east-1a",
			}),
			integration.WithResourceVariable(
				"app_name",
				integration.ResourceVariableStringValue("my-app"),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(5),
			),
			integration.WithResourceVariable(
				"debug_mode",
				integration.ResourceVariableBoolValue(true),
			),
			integration.WithResourceVariable(
				"config",
				integration.ResourceVariableLiteralValue(map[string]any{
					"timeout":     30,
					"max_retries": 3,
					"enabled":     true,
				}),
			),
		),
	)

	ctx := context.Background()

	// Verify release target was created
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 1 {
		t.Fatalf("expected 1 release target, got %d", len(releaseTargets))
	}

	// Initially no jobs or releases
	initialJobs := engine.Workspace().Jobs().GetPending()
	if len(initialJobs) != 0 {
		t.Fatalf("expected 0 jobs before deployment version, got %d", len(initialJobs))
	}

	// Step 1: Create a deployment version - this creates a release
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v1.2.3"
	dv.Config = map[string]any{
		"image":        "myapp:v1.2.3",
		"git_commit":   "abc123def456",
		"build_number": float64(42),
	}
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Step 2: Verify a release was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job after deployment version creation, got %d", len(pendingJobs))
	}

	// Get the job
	var job *oapi.Job
	for _, j := range pendingJobs {
		job = j
		break
	}

	// Verify the release exists
	release, releaseExists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !releaseExists {
		t.Fatalf("release %s not found for job %s", job.ReleaseId, job.Id)
	}

	// Step 3: Verify the job is in pending status
	if job.Status != oapi.Pending {
		t.Errorf("expected job status PENDING, got %v", job.Status)
	}

	// Verify job properties
	if release.ReleaseTarget.DeploymentId != deploymentId {
		t.Errorf("job deployment_id = %s, want %s", release.ReleaseTarget.DeploymentId, deploymentId)
	}
	if release.ReleaseTarget.EnvironmentId != environmentId {
		t.Errorf("job environment_id = %s, want %s", release.ReleaseTarget.EnvironmentId, environmentId)
	}
	if release.ReleaseTarget.ResourceId != resourceId {
		t.Errorf("job resource_id = %s, want %s", release.ReleaseTarget.ResourceId, resourceId)
	}
	if job.JobAgentId != jobAgentId {
		t.Errorf("job job_agent_id = %s, want %s", job.JobAgentId, jobAgentId)
	}

	variables := release.Variables

	// Verify all variables are present
	if len(variables) != 4 {
		t.Errorf("expected 4 variables, got %d", len(variables))
	}

	// Verify app_name
	if appName, exists := variables["app_name"]; !exists {
		t.Error("app_name variable not found")
	} else if v, _ := appName.AsStringValue(); v != "my-app" {
		t.Errorf("app_name = %s, want my-app", v)
	}

	// Verify replicas
	if replicas, exists := variables["replicas"]; !exists {
		t.Error("replicas variable not found")
	} else if v, _ := replicas.AsIntegerValue(); v != 5 {
		t.Errorf("replicas = %d, want 5", v)
	}

	// Verify debug_mode
	if debugMode, exists := variables["debug_mode"]; !exists {
		t.Error("debug_mode variable not found")
	} else if v, _ := debugMode.AsBooleanValue(); !v {
		t.Errorf("debug_mode = %v, want true", v)
	}

	// Verify config object
	if config, exists := variables["config"]; !exists {
		t.Error("config variable not found")
	} else {
		obja, _ := config.AsObjectValue()
		obj := obja.Object
		if obj == nil {
			t.Error("config is not an object")
		} else {
			if obj["timeout"] != float64(30) {
				t.Logf("config.timeout type: %T", obj["timeout"])
				t.Errorf("config.timeout = %d, want 30", obj["timeout"])
			}
			if obj["max_retries"] != float64(3) {
				t.Errorf("config.max_retries = %v, want 3", obj["max_retries"])
			}
			if obj["enabled"] != true {
				t.Errorf("config.enabled = %v, want true", obj["enabled"])
			}
		}
	}

	if release.Version.Tag != "v1.2.3" {
		t.Errorf("release version tag = %s, want v1.2.3", release.Version.Tag)
	}

	// Verify version config
	if release.Version.Config == nil {
		t.Fatal("expected release version config to be set")
	}

	versionConfig := release.Version.Config
	if versionConfig["image"] != "myapp:v1.2.3" {
		t.Errorf("version config image = %v, want myapp:v1.2.3", versionConfig["image"])
	}
	if versionConfig["git_commit"] != "abc123def456" {
		t.Errorf("version config git_commit = %v, want abc123def456", versionConfig["git_commit"])
	}
	if versionConfig["build_number"] != float64(42) {
		t.Errorf("version config build_number = %v, want 42", versionConfig["build_number"])
	}

	// Verify job agent config is preserved
	jobConfig := job.JobAgentConfig
	if jobConfig["namespace"] != "production" {
		t.Errorf("job config namespace = %v, want production", jobConfig["namespace"])
	}
	if jobConfig["replicas"] != float64(3) {
		t.Errorf("job config replicas = %v, want 3", jobConfig["replicas"])
	}
}

// TestEngine_ReleaseManager_WithReferenceVariables tests release manager with variables that reference other resources
func TestEngine_ReleaseManager_WithReferenceVariables(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	appId := uuid.New().String()
	dbId := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("db_host"),
				integration.WithDeploymentVariable("db_port"),
				integration.WithDeploymentVariable("db_name"),
				integration.WithDeploymentVariable("app_version"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// Database resource
		integration.WithResource(
			integration.ResourceID(dbId),
			integration.ResourceName("postgres-main"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"host":     "db.example.com",
				"port":     "5432",
				"database": "production_db",
			}),
		),
		// Application resource that references the database
		integration.WithResource(
			integration.ResourceID(appId),
			integration.ResourceName("api-app"),
			integration.ResourceKind("application"),
			integration.ResourceMetadata(map[string]string{
				"db_id": dbId,
			}),
			// Variables on the app that reference the database
			integration.WithResourceVariable(
				"db_host",
				integration.ResourceVariableReferenceValue("database", []string{"metadata", "host"}),
			),
			integration.WithResourceVariable(
				"db_port",
				integration.ResourceVariableReferenceValue("database", []string{"metadata", "port"}),
			),
			integration.WithResourceVariable(
				"db_name",
				integration.ResourceVariableReferenceValue("database", []string{"metadata", "database"}),
			),
			integration.WithResourceVariable(
				"app_version",
				integration.ResourceVariableStringValue("1.0.0"),
			),
		),
		// Relationship rule: app -> database
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("app-to-db"),
			integration.RelationshipRuleName("app-to-database"),
			integration.RelationshipRuleReference("database"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "application",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "db_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
	)

	ctx := context.Background()

	// Verify release targets were created (2 resources * 1 deployment * 1 environment = 2)
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 2 {
		t.Fatalf("expected 2 release targets, got %d", len(releaseTargets))
	}

	// Create a deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Should create 2 jobs (one for each resource)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 2 {
		t.Fatalf("expected 2 jobs after deployment version creation, got %d", len(pendingJobs))
	}

	// Find the job for the application resource
	var appJob *oapi.Job
	for _, job := range pendingJobs {
		release, ok := engine.Workspace().Releases().Get(job.ReleaseId)
		if ok && release.ReleaseTarget.ResourceId == appId {
			appJob = job
			break
		}
	}

	if appJob == nil {
		t.Fatal("no job found for application resource")
	}

	// Verify the job is pending
	if appJob.Status != oapi.Pending {
		t.Errorf("expected job status PENDING, got %v", appJob.Status)
	}

	// Verify the release exists
	release, releaseExists := engine.Workspace().Releases().Get(appJob.ReleaseId)
	if !releaseExists {
		t.Fatalf("release %s not found for job", appJob.ReleaseId)
	}

	if release.Version.Tag != "v2.0.0" {
		t.Errorf("release version tag = %s, want v2.0.0", release.Version.Tag)
	}

	// Verify the reference variables are resolved correctly in the release
	variables := release.Variables

	// Verify all variables are present (3 reference + 1 literal = 4)
	if len(variables) != 4 {
		t.Errorf("expected 4 variables, got %d", len(variables))
	}

	// Verify reference variables resolved from database
	if dbHost, exists := variables["db_host"]; !exists {
		t.Error("db_host variable not found")
	} else if v, _ := dbHost.AsStringValue(); v != "db.example.com" {
		t.Errorf("db_host = %s, want db.example.com", v)
	}

	if dbPort, exists := variables["db_port"]; !exists {
		t.Error("db_port variable not found")
	} else if v, _ := dbPort.AsStringValue(); v != "5432" {
		t.Errorf("db_port = %s, want 5432", v)
	}

	if dbName, exists := variables["db_name"]; !exists {
		t.Error("db_name variable not found")
	} else if v, _ := dbName.AsStringValue(); v != "production_db" {
		t.Errorf("db_name = %s, want production_db", v)
	}

	// Verify literal variable
	if appVersion, exists := variables["app_version"]; !exists {
		t.Error("app_version variable not found")
	} else if v, _ := appVersion.AsStringValue(); v != "1.0.0" {
		t.Errorf("app_version = %s, want 1.0.0", v)
	}
}

// TestEngine_ReleaseManager_MultipleResources tests release manager creates correct jobs for multiple resources
func TestEngine_ReleaseManager_MultipleResources(t *testing.T) {
	jobAgentId := uuid.New().String()
	deploymentId := uuid.New().String()
	environmentId := uuid.New().String()
	resource1Id := uuid.New().String()
	resource2Id := uuid.New().String()
	resource3Id := uuid.New().String()

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentId),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentId),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent(jobAgentId),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("region"),
				integration.WithDeploymentVariable("instance_count"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("server-1"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
			integration.WithResourceVariable(
				"region",
				integration.ResourceVariableStringValue("us-east-1"),
			),
			integration.WithResourceVariable(
				"instance_count",
				integration.ResourceVariableIntValue(3),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("server-2"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
			integration.WithResourceVariable(
				"region",
				integration.ResourceVariableStringValue("us-west-2"),
			),
			integration.WithResourceVariable(
				"instance_count",
				integration.ResourceVariableIntValue(5),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource3Id),
			integration.ResourceName("server-3"),
			integration.ResourceMetadata(map[string]string{
				"region": "eu-west-1",
			}),
			integration.WithResourceVariable(
				"region",
				integration.ResourceVariableStringValue("eu-west-1"),
			),
			integration.WithResourceVariable(
				"instance_count",
				integration.ResourceVariableIntValue(2),
			),
		),
	)

	ctx := context.Background()

	// Verify release targets (3 resources * 1 deployment * 1 environment = 3)
	releaseTargets, _ := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Create a deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v3.0.0"
	dv.Config = map[string]any{
		"image": "myapp:v3.0.0",
	}
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Should create 3 jobs (one for each resource)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 3 {
		t.Fatalf("expected 3 jobs after deployment version creation, got %d", len(pendingJobs))
	}

	// Verify each job has correct properties
	jobsByResource := make(map[string]*oapi.Job)
	for _, job := range pendingJobs {
		// Verify release exists and has correct version
		release, releaseExists := engine.Workspace().Releases().Get(job.ReleaseId)
		if !releaseExists {
			t.Errorf("release %s not found for job %s", job.ReleaseId, job.Id)
			continue
		}

		jobsByResource[release.ReleaseTarget.ResourceId] = job

		// Verify job is pending
		if job.Status != oapi.Pending {
			t.Errorf("job %s has status %v, want PENDING", job.Id, job.Status)
		}

		// Verify job has correct deployment and environment
		if release.ReleaseTarget.DeploymentId != deploymentId {
			t.Errorf("job %s has deployment_id %s, want %s", job.Id, release.ReleaseTarget.DeploymentId, deploymentId)
		}
		if release.ReleaseTarget.EnvironmentId != environmentId {
			t.Errorf("job %s has environment_id %s, want %s", job.Id, release.ReleaseTarget.EnvironmentId, environmentId)
		}

		if release.Version.Tag != "v3.0.0" {
			t.Errorf("release %s has version tag %s, want v3.0.0", release.ID(), release.Version.Tag)
		}
	}

	// Verify all resources have jobs
	if _, exists := jobsByResource[resource1Id]; !exists {
		t.Error("no job found for resource-1")
	}
	if _, exists := jobsByResource[resource2Id]; !exists {
		t.Error("no job found for resource-2")
	}
	if _, exists := jobsByResource[resource3Id]; !exists {
		t.Error("no job found for resource-3")
	}

	// Verify variables for each resource by checking their releases
	job1 := jobsByResource[resource1Id]
	if job1 != nil {
		release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
		if !exists {
			t.Error("release not found for resource 1")
		} else {
			vars1 := release1.Variables
			if v, _ := vars1["region"].AsStringValue(); v != "us-east-1" {
				t.Errorf("resource 1 region = %s, want us-east-1", v)
			}
			if v, _ := vars1["instance_count"].AsIntegerValue(); v != 3 {
				t.Errorf("resource 1 instance_count = %d, want 3", v)
			}
		}
	}

	job2 := jobsByResource[resource2Id]
	if job2 != nil {
		release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
		if !exists {
			t.Error("release not found for resource 2")
		} else {
			vars2 := release2.Variables
			if v, _ := vars2["region"].AsStringValue(); v != "us-west-2" {
				t.Errorf("resource 2 region = %s, want us-west-2", v)
			}
			if v, _ := vars2["instance_count"].AsIntegerValue(); v != 5 {
				t.Errorf("resource 2 instance_count = %d, want 5", v)
			}
		}
	}

	job3 := jobsByResource[resource3Id]
	if job3 != nil {
		release3, exists := engine.Workspace().Releases().Get(job3.ReleaseId)
		if !exists {
			t.Error("release not found for resource 3")
		} else {
			vars3 := release3.Variables
			if v, _ := vars3["region"].AsStringValue(); v != "eu-west-1" {
				t.Errorf("resource 3 region = %s, want eu-west-1", v)
			}
			if v, _ := vars3["instance_count"].AsIntegerValue(); v != 2 {
				t.Errorf("resource 3 instance_count = %d, want 2", v)
			}
		}
	}
}
