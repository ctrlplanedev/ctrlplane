package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/pb"
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
				integration.DeploymentJobAgentConfig(map[string]any{
					"namespace": "production",
					"replicas":  3,
				}),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
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
		),
		integration.WithResourceVariable(
			resourceId,
			"app_name",
			integration.ResourceVariableStringValue("my-app"),
		),
		integration.WithResourceVariable(
			resourceId,
			"replicas",
			integration.ResourceVariableIntValue(5),
		),
		integration.WithResourceVariable(
			resourceId,
			"debug_mode",
			integration.ResourceVariableBoolValue(true),
		),
		integration.WithResourceVariable(
			resourceId,
			"config",
			integration.ResourceVariableLiteralValue(map[string]any{
				"timeout":     30,
				"max_retries": 3,
				"enabled":     true,
			}),
		),
	)

	ctx := context.Background()

	// Verify release target was created
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
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
	dv.Config = c.MustNewStructFromMap(map[string]any{
		"image":        "myapp:v1.2.3",
		"git_commit":   "abc123def456",
		"build_number": float64(42),
	})
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Step 2: Verify a release was created
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 job after deployment version creation, got %d", len(pendingJobs))
	}

	// Get the job
	var job *pb.Job
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
	if job.Status != pb.JobStatus_JOB_STATUS_PENDING {
		t.Errorf("expected job status PENDING, got %v", job.Status)
	}

	// Verify job properties
	if job.DeploymentId != deploymentId {
		t.Errorf("job deployment_id = %s, want %s", job.DeploymentId, deploymentId)
	}
	if job.EnvironmentId != environmentId {
		t.Errorf("job environment_id = %s, want %s", job.EnvironmentId, environmentId)
	}
	if job.ResourceId != resourceId {
		t.Errorf("job resource_id = %s, want %s", job.ResourceId, resourceId)
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
	} else if appName.GetString_() != "my-app" {
		t.Errorf("app_name = %s, want my-app", appName.GetString_())
	}

	// Verify replicas
	if replicas, exists := variables["replicas"]; !exists {
		t.Error("replicas variable not found")
	} else if replicas.GetInt64() != 5 {
		t.Errorf("replicas = %d, want 5", replicas.GetInt64())
	}

	// Verify debug_mode
	if debugMode, exists := variables["debug_mode"]; !exists {
		t.Error("debug_mode variable not found")
	} else if !debugMode.GetBool() {
		t.Errorf("debug_mode = %v, want true", debugMode.GetBool())
	}

	// Verify config object
	if config, exists := variables["config"]; !exists {
		t.Error("config variable not found")
	} else {
		obj := config.GetObject()
		if obj == nil {
			t.Error("config is not an object")
		} else {
			if obj.Fields["timeout"].GetNumberValue() != 30 {
				t.Errorf("config.timeout = %v, want 30", obj.Fields["timeout"].GetNumberValue())
			}
			if obj.Fields["max_retries"].GetNumberValue() != 3 {
				t.Errorf("config.max_retries = %v, want 3", obj.Fields["max_retries"].GetNumberValue())
			}
			if !obj.Fields["enabled"].GetBoolValue() {
				t.Errorf("config.enabled = %v, want true", obj.Fields["enabled"].GetBoolValue())
			}
		}
	}

	// Step 5: Verify the version on the job (via the release)
	if release.Version == nil {
		t.Fatal("expected release version to be set")
	}

	if release.Version.Tag != "v1.2.3" {
		t.Errorf("release version tag = %s, want v1.2.3", release.Version.Tag)
	}

	// Verify version config
	if release.Version.Config == nil {
		t.Fatal("expected release version config to be set")
	}

	versionConfig := release.Version.Config.AsMap()
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
	jobConfig := job.GetJobAgentConfig().AsMap()
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
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
		// Variables on the app that reference the database
		integration.WithResourceVariable(
			appId,
			"db_host",
			integration.ResourceVariableReferenceValue("database", []string{"metadata", "host"}),
		),
		integration.WithResourceVariable(
			appId,
			"db_port",
			integration.ResourceVariableReferenceValue("database", []string{"metadata", "port"}),
		),
		integration.WithResourceVariable(
			appId,
			"db_name",
			integration.ResourceVariableReferenceValue("database", []string{"metadata", "database"}),
		),
		integration.WithResourceVariable(
			appId,
			"app_version",
			integration.ResourceVariableStringValue("1.0.0"),
		),
	)

	ctx := context.Background()

	// Verify release targets were created (2 resources * 1 deployment * 1 environment = 2)
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
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
	var appJob *pb.Job
	for _, job := range pendingJobs {
		if job.ResourceId == appId {
			appJob = job
			break
		}
	}

	if appJob == nil {
		t.Fatal("no job found for application resource")
	}

	// Verify the job is pending
	if appJob.Status != pb.JobStatus_JOB_STATUS_PENDING {
		t.Errorf("expected job status PENDING, got %v", appJob.Status)
	}

	// Verify the release exists
	release, releaseExists := engine.Workspace().Releases().Get(appJob.ReleaseId)
	if !releaseExists {
		t.Fatalf("release %s not found for job", appJob.ReleaseId)
	}

	// Verify the version
	if release.Version == nil {
		t.Fatal("expected release version to be set")
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
	} else if dbHost.GetString_() != "db.example.com" {
		t.Errorf("db_host = %s, want db.example.com", dbHost.GetString_())
	}

	if dbPort, exists := variables["db_port"]; !exists {
		t.Error("db_port variable not found")
	} else if dbPort.GetString_() != "5432" {
		t.Errorf("db_port = %s, want 5432", dbPort.GetString_())
	}

	if dbName, exists := variables["db_name"]; !exists {
		t.Error("db_name variable not found")
	} else if dbName.GetString_() != "production_db" {
		t.Errorf("db_name = %s, want production_db", dbName.GetString_())
	}

	// Verify literal variable
	if appVersion, exists := variables["app_version"]; !exists {
		t.Error("app_version variable not found")
	} else if appVersion.GetString_() != "1.0.0" {
		t.Errorf("app_version = %s, want 1.0.0", appVersion.GetString_())
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentId),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1Id),
			integration.ResourceName("server-1"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResourceVariable(
			resource1Id,
			"region",
			integration.ResourceVariableStringValue("us-east-1"),
		),
		integration.WithResourceVariable(
			resource1Id,
			"instance_count",
			integration.ResourceVariableIntValue(3),
		),
		integration.WithResource(
			integration.ResourceID(resource2Id),
			integration.ResourceName("server-2"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-west-2",
			}),
		),
		integration.WithResourceVariable(
			resource2Id,
			"region",
			integration.ResourceVariableStringValue("us-west-2"),
		),
		integration.WithResourceVariable(
			resource2Id,
			"instance_count",
			integration.ResourceVariableIntValue(5),
		),
		integration.WithResource(
			integration.ResourceID(resource3Id),
			integration.ResourceName("server-3"),
			integration.ResourceMetadata(map[string]string{
				"region": "eu-west-1",
			}),
		),
		integration.WithResourceVariable(
			resource3Id,
			"region",
			integration.ResourceVariableStringValue("eu-west-1"),
		),
		integration.WithResourceVariable(
			resource3Id,
			"instance_count",
			integration.ResourceVariableIntValue(2),
		),
	)

	ctx := context.Background()

	// Verify release targets (3 resources * 1 deployment * 1 environment = 3)
	releaseTargets := engine.Workspace().ReleaseTargets().Items(ctx)
	if len(releaseTargets) != 3 {
		t.Fatalf("expected 3 release targets, got %d", len(releaseTargets))
	}

	// Create a deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentId
	dv.Tag = "v3.0.0"
	dv.Config = c.MustNewStructFromMap(map[string]any{
		"image": "myapp:v3.0.0",
	})
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Should create 3 jobs (one for each resource)
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 3 {
		t.Fatalf("expected 3 jobs after deployment version creation, got %d", len(pendingJobs))
	}

	// Verify each job has correct properties
	jobsByResource := make(map[string]*pb.Job)
	for _, job := range pendingJobs {
		jobsByResource[job.ResourceId] = job

		// Verify job is pending
		if job.Status != pb.JobStatus_JOB_STATUS_PENDING {
			t.Errorf("job %s has status %v, want PENDING", job.Id, job.Status)
		}

		// Verify job has correct deployment and environment
		if job.DeploymentId != deploymentId {
			t.Errorf("job %s has deployment_id %s, want %s", job.Id, job.DeploymentId, deploymentId)
		}
		if job.EnvironmentId != environmentId {
			t.Errorf("job %s has environment_id %s, want %s", job.Id, job.EnvironmentId, environmentId)
		}

		// Verify release exists and has correct version
		release, releaseExists := engine.Workspace().Releases().Get(job.ReleaseId)
		if !releaseExists {
			t.Errorf("release %s not found for job %s", job.ReleaseId, job.Id)
			continue
		}

		if release.Version == nil {
			t.Errorf("release %s has no version", release.ID())
			continue
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
			if vars1["region"].GetString_() != "us-east-1" {
				t.Errorf("resource 1 region = %s, want us-east-1", vars1["region"].GetString_())
			}
			if vars1["instance_count"].GetInt64() != 3 {
				t.Errorf("resource 1 instance_count = %d, want 3", vars1["instance_count"].GetInt64())
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
			if vars2["region"].GetString_() != "us-west-2" {
				t.Errorf("resource 2 region = %s, want us-west-2", vars2["region"].GetString_())
			}
			if vars2["instance_count"].GetInt64() != 5 {
				t.Errorf("resource 2 instance_count = %d, want 5", vars2["instance_count"].GetInt64())
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
			if vars3["region"].GetString_() != "eu-west-1" {
				t.Errorf("resource 3 region = %s, want eu-west-1", vars3["region"].GetString_())
			}
			if vars3["instance_count"].GetInt64() != 2 {
				t.Errorf("resource 3 instance_count = %d, want 2", vars3["instance_count"].GetInt64())
			}
		}
	}
}
