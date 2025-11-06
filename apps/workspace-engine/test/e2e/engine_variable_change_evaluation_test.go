package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_VariableChange_DeploymentDefaultStringValueChange tests that changing a deployment variable default string value triggers new release/job
func TestEngine_VariableChange_DeploymentDefaultStringValueChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"app_name",
					integration.DeploymentVariableDefaultStringValue("initial-app"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get initial job and mark as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 initial job, got %d", len(pendingJobs))
	}

	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	initialReleaseID := initialJob.ReleaseId

	// Mark job as successful
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify no more pending jobs after completion
	pendingAfterComplete := engine.Workspace().Jobs().GetPending()
	if len(pendingAfterComplete) != 0 {
		t.Fatalf("expected 0 pending jobs after completion, got %d", len(pendingAfterComplete))
	}

	// Verify initial release variables
	initialRelease, exists := engine.Workspace().Releases().Get(initialReleaseID)
	if !exists {
		t.Fatalf("initial release not found")
	}

	initialVariables := initialRelease.Variables
	initialAppName, exists := initialVariables["app_name"]
	if !exists {
		t.Fatalf("initial app_name variable not found")
	}
	initialAppNameStr, _ := initialAppName.AsStringValue()
	if initialAppNameStr != "initial-app" {
		t.Errorf("initial app_name = %s, want initial-app", initialAppNameStr)
	}

	// Get the deployment variable to update
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	appNameVar, exists := deploymentVars["app_name"]
	if !exists {
		t.Fatalf("deployment variable not found")
	}

	// Change the deployment variable default value
	newDefaultValue := c.NewLiteralValue("updated-app")
	updatedVar := &oapi.DeploymentVariable{
		Id:           appNameVar.Id,
		Key:          "app_name",
		DeploymentId: deploymentID,
		DefaultValue: newDefaultValue,
	}
	engine.PushEvent(ctx, handler.DeploymentVariableUpdate, updatedVar)

	// Variable change should automatically trigger re-evaluation and create new job
	allJobsAfterChange := engine.Workspace().Jobs().Items()

	if len(allJobsAfterChange) < 2 {
		t.Fatalf("expected at least 2 total jobs after variable change (1 successful + 1 new pending), got %d", len(allJobsAfterChange))
	}

	// Find the new pending job (should be different from initial job and have pending status)
	var newJob *oapi.Job
	for _, job := range allJobsAfterChange {
		if job.Id != initialJob.Id && job.Id != "" && job.Status == oapi.Pending {
			newJob = job
			break
		}
	}

	if newJob == nil {
		t.Fatalf("no new pending job created after variable change")
	}

	if newJob.ReleaseId == initialReleaseID {
		t.Errorf("new job should have different release ID")
	}

	// Verify new release has updated variable
	newRelease, exists := engine.Workspace().Releases().Get(newJob.ReleaseId)
	if !exists {
		t.Fatalf("new release not found")
	}

	newVariables := newRelease.Variables
	newAppName, exists := newVariables["app_name"]
	if !exists {
		t.Fatalf("new app_name variable not found")
	}
	newAppNameStr, _ := newAppName.AsStringValue()
	if newAppNameStr != "updated-app" {
		t.Errorf("new app_name = %s, want updated-app", newAppNameStr)
	}
}

// TestEngine_VariableChange_DeploymentDefaultIntValueChange tests that changing a deployment variable default int value triggers new release/job
func TestEngine_VariableChange_DeploymentDefaultIntValueChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"replicas",
					integration.DeploymentVariableDefaultIntValue(3),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get initial job and mark as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	if len(pendingJobs) != 1 {
		t.Fatalf("expected 1 initial job, got %d", len(pendingJobs))
	}

	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial variable value
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialReplicas, _ := initialRelease.Variables["replicas"].AsIntegerValue()
	if int64(initialReplicas) != 3 {
		t.Errorf("initial replicas = %d, want 3", initialReplicas)
	}

	// Get the deployment variable to update
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	replicasVar := deploymentVars["replicas"]

	// Change the deployment variable default value
	newDefaultValue := c.NewLiteralValue(5)
	updatedVar := &oapi.DeploymentVariable{
		Id:           replicasVar.Id,
		Key:          "replicas",
		DeploymentId: deploymentID,
		DefaultValue: newDefaultValue,
	}
	engine.PushEvent(ctx, handler.DeploymentVariableUpdate, updatedVar)

	// Trigger re-evaluation
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new release with updated value
	newPendingJobs := engine.Workspace().Jobs().GetPending()
	if len(newPendingJobs) != 1 {
		t.Fatalf("expected 1 new pending job, got %d", len(newPendingJobs))
	}

	var newJob *oapi.Job
	for _, job := range newPendingJobs {
		newJob = job
		break
	}
	newRelease, _ := engine.Workspace().Releases().Get(newJob.ReleaseId)
	newReplicas, _ := newRelease.Variables["replicas"].AsIntegerValue()
	if int64(newReplicas) != 5 {
		t.Errorf("new replicas = %d, want 5", newReplicas)
	}
}

// TestEngine_VariableChange_DeploymentDefaultBoolValueChange tests that changing a deployment variable default bool value triggers new release/job
func TestEngine_VariableChange_DeploymentDefaultBoolValueChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"debug_mode",
					integration.DeploymentVariableDefaultBoolValue(false),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Mark initial job as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial value
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialDebugMode, _ := initialRelease.Variables["debug_mode"].AsBooleanValue()
	if initialDebugMode {
		t.Errorf("initial debug_mode = %v, want false", initialDebugMode)
	}

	// Get the deployment variable to update
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	debugModeVar := deploymentVars["debug_mode"]

	// Change the deployment variable default value
	newDefaultValue := c.NewLiteralValue(true)
	updatedVar := &oapi.DeploymentVariable{
		Id:           debugModeVar.Id,
		Key:          "debug_mode",
		DeploymentId: deploymentID,
		DefaultValue: newDefaultValue,
	}
	engine.PushEvent(ctx, handler.DeploymentVariableUpdate, updatedVar)

	// Trigger re-evaluation
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new release with updated value
	newPendingJobs := engine.Workspace().Jobs().GetPending()
	if len(newPendingJobs) != 1 {
		t.Fatalf("expected 1 new pending job, got %d", len(newPendingJobs))
	}

	var newJob *oapi.Job
	for _, job := range newPendingJobs {
		newJob = job
		break
	}
	newRelease, _ := engine.Workspace().Releases().Get(newJob.ReleaseId)
	newDebugMode, _ := newRelease.Variables["debug_mode"].AsBooleanValue()
	if !newDebugMode {
		t.Errorf("new debug_mode = %v, want true", newDebugMode)
	}
}

// TestEngine_VariableChange_DeploymentDefaultObjectValueChange tests that changing a deployment variable default object value triggers new release/job
func TestEngine_VariableChange_DeploymentDefaultObjectValueChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"config",
					integration.DeploymentVariableDefaultLiteralValue(map[string]any{
						"timeout": 30,
						"retries": 3,
					}),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Mark initial job as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial value
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialConfig, _ := initialRelease.Variables["config"].AsObjectValue()
	if initialConfig.Object["timeout"] != float64(30) {
		t.Errorf("initial timeout = %v, want 30", initialConfig.Object["timeout"])
	}

	// Get the deployment variable to update
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	configVar := deploymentVars["config"]

	// Change the deployment variable default value
	newDefaultValue := c.NewLiteralValue(map[string]any{
		"timeout": 60,
		"retries": 5,
	})
	updatedVar := &oapi.DeploymentVariable{
		Id:           configVar.Id,
		Key:          "config",
		DeploymentId: deploymentID,
		DefaultValue: newDefaultValue,
	}
	engine.PushEvent(ctx, handler.DeploymentVariableUpdate, updatedVar)

	// Trigger re-evaluation
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}
	engine.PushEvent(ctx, handler.ReleaseTargetDeploy, releaseTarget)

	// Verify new release with updated value
	newPendingJobs := engine.Workspace().Jobs().GetPending()
	if len(newPendingJobs) != 1 {
		t.Fatalf("expected 1 new pending job, got %d", len(newPendingJobs))
	}

	var newJob *oapi.Job
	for _, job := range newPendingJobs {
		newJob = job
		break
	}
	newRelease, _ := engine.Workspace().Releases().Get(newJob.ReleaseId)
	newConfig, _ := newRelease.Variables["config"].AsObjectValue()
	if newConfig.Object["timeout"] != float64(60) {
		t.Errorf("new timeout = %v, want 60", newConfig.Object["timeout"])
	}
}

// TestEngine_VariableChange_DeploymentValueChange tests that changing a deployment variable value (with selector) triggers new release/job
func TestEngine_VariableChange_DeploymentValueChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"region",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueStringValue("us-west-1"),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Mark initial job as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial value
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialRegion, _ := initialRelease.Variables["region"].AsStringValue()
	if initialRegion != "us-west-1" {
		t.Errorf("initial region = %s, want us-west-1", initialRegion)
	}

	// Get the deployment variable and its values
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	regionVar := deploymentVars["region"]
	values := engine.Workspace().DeploymentVariables().Values(regionVar.Id)

	// Get the first value to update
	var valueToUpdate *oapi.DeploymentVariableValue
	for _, v := range values {
		valueToUpdate = v
		break
	}

	// Change the deployment variable value
	newLiteralValue := c.NewLiteralValue("us-east-1")
	newValue := c.NewValueFromLiteral(newLiteralValue)
	valueToUpdate.Value = *newValue
	engine.PushEvent(ctx, handler.DeploymentVariableValueUpdate, valueToUpdate)

	// Variable value change should automatically trigger re-evaluation
	// Verify new release with updated value
	newPendingJobs := engine.Workspace().Jobs().GetPending()
	if len(newPendingJobs) != 1 {
		t.Fatalf("expected 1 new pending job, got %d", len(newPendingJobs))
	}

	var newJob *oapi.Job
	for _, job := range newPendingJobs {
		newJob = job
		break
	}
	newRelease, _ := engine.Workspace().Releases().Get(newJob.ReleaseId)
	newRegion, _ := newRelease.Variables["region"].AsStringValue()
	if newRegion != "us-east-1" {
		t.Errorf("new region = %s, want us-east-1", newRegion)
	}
}

// TestEngine_VariableChange_ResourceVariableChange tests that changing a resource variable triggers new release/job
func TestEngine_VariableChange_ResourceVariableChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("app_version"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"app_version",
				integration.ResourceVariableStringValue("v1.0.0"),
			),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Mark initial job as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial value
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialVersion, _ := initialRelease.Variables["app_version"].AsStringValue()
	if initialVersion != "v1.0.0" {
		t.Errorf("initial app_version = %s, want v1.0.0", initialVersion)
	}

	// Change the resource variable
	updatedVar := c.NewResourceVariable(resourceID, "app_version")
	updatedVar.Value = *c.NewValueFromString("v2.0.0")
	engine.PushEvent(ctx, handler.ResourceVariableUpdate, updatedVar)

	// Resource variable change should automatically trigger re-evaluation
	// Verify new release with updated value
	newPendingJobs := engine.Workspace().Jobs().GetPending()
	if len(newPendingJobs) != 1 {
		t.Fatalf("expected 1 new pending job, got %d", len(newPendingJobs))
	}

	var newJob *oapi.Job
	for _, job := range newPendingJobs {
		newJob = job
		break
	}
	newRelease, _ := engine.Workspace().Releases().Get(newJob.ReleaseId)
	newVersion, _ := newRelease.Variables["app_version"].AsStringValue()
	if newVersion != "v2.0.0" {
		t.Errorf("new app_version = %s, want v2.0.0", newVersion)
	}
}

// TestEngine_VariableChange_ReferencedResourcePropertyChange tests that changing a referenced resource property triggers new release/job
func TestEngine_VariableChange_ReferencedResourcePropertyChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	vpcID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("cluster-to-vpc"),
			integration.RelationshipRuleReference("vpc"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "vpc_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("resource.name == 'cluster-main'"),
				integration.WithDeploymentVariable(
					"vpc_cidr",
					integration.WithDeploymentVariableValue(
						integration.DeploymentVariableValueCelResourceSelector("true"),
						integration.DeploymentVariableValueReferenceValue("vpc", []string{"metadata", "cidr"}),
					),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(vpcID),
			integration.ResourceName("vpc-main"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"cidr": "10.0.0.0/16",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-main"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
			}),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Mark initial job as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()

	if len(pendingJobs) != 1 {
		t.Fatalf("expected pending jobs to be one, got %d", len(pendingJobs))
	}

	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}

	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial referenced value
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialCIDR, _ := initialRelease.Variables["vpc_cidr"].AsStringValue()
	if initialCIDR != "10.0.0.0/16" {
		t.Errorf("initial vpc_cidr = %s, want 10.0.0.0/16", initialCIDR)
	}

	// Update the referenced resource's property
	updatedVPC := &oapi.Resource{
		Id:   vpcID,
		Name: "vpc-main",
		Kind: "vpc",
		Metadata: map[string]string{
			"cidr": "10.1.0.0/16", // Changed CIDR
		},
	}
	engine.PushEvent(ctx, handler.ResourceUpdate, updatedVPC)

	// Referenced resource update should automatically trigger re-evaluation
	// Note: This currently does NOT work - ResourceUpdate doesn't taint dependent release targets
	allJobsAfterChange := engine.Workspace().Jobs().Items()

	// Find new pending jobs
	var newJobs []*oapi.Job
	for _, job := range allJobsAfterChange {
		if job.Id != initialJob.Id && job.Id != "" && job.Status == oapi.Pending {
			newJobs = append(newJobs, job)
		}
	}

	newJob := newJobs[0]
	newRelease, _ := engine.Workspace().Releases().Get(newJob.ReleaseId)
	newCIDR, _ := newRelease.Variables["vpc_cidr"].AsStringValue()
	if newCIDR != "10.1.0.0/16" {
		t.Errorf("new vpc_cidr = %s, want 10.1.0.0/16", newCIDR)
	}
}

// TestEngine_VariableChange_MultipleVariablesChange tests that changing multiple variables simultaneously creates one new release
func TestEngine_VariableChange_MultipleVariablesChange(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
			integration.JobAgentName("Test Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("env"),
				integration.WithDeploymentVariable(
					"app_name",
					integration.DeploymentVariableDefaultStringValue("initial-app"),
				),
				integration.WithDeploymentVariable(
					"replicas",
					integration.DeploymentVariableDefaultIntValue(3),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"env",
				integration.ResourceVariableStringValue("staging"),
			),
		),
	)

	ctx := context.Background()

	// Create initial deployment version
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Mark initial job as successful
	pendingJobs := engine.Workspace().Jobs().GetPending()
	var initialJob *oapi.Job
	for _, job := range pendingJobs {
		initialJob = job
		break
	}
	now := time.Now()
	initialJob.Status = oapi.Successful
	initialJob.CompletedAt = &now
	engine.PushEvent(ctx, handler.JobUpdate, initialJob)

	// Verify initial values
	initialRelease, _ := engine.Workspace().Releases().Get(initialJob.ReleaseId)
	initialAppName, _ := initialRelease.Variables["app_name"].AsStringValue()
	initialReplicas, _ := initialRelease.Variables["replicas"].AsIntegerValue()
	initialEnv, _ := initialRelease.Variables["env"].AsStringValue()

	if initialAppName != "initial-app" || int64(initialReplicas) != 3 || initialEnv != "staging" {
		t.Errorf("initial values incorrect")
	}

	// Change first variable - this triggers a new job
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)

	appNameVar := deploymentVars["app_name"]
	updatedVar1 := &oapi.DeploymentVariable{
		Id:           appNameVar.Id,
		Key:          "app_name",
		DeploymentId: deploymentID,
		DefaultValue: c.NewLiteralValue("updated-app"),
	}
	engine.PushEvent(ctx, handler.DeploymentVariableUpdate, updatedVar1)

	// First change creates a job - mark it as successful
	pendingAfterFirstChange := engine.Workspace().Jobs().GetPending()
	var job2 *oapi.Job
	for _, job := range pendingAfterFirstChange {
		job2 = job
		break
	}
	if job2 != nil {
		job2.Status = oapi.Successful
		job2.CompletedAt = &now
		engine.PushEvent(ctx, handler.JobUpdate, job2)
	}

	// Change second variable - triggers another new job
	replicasVar := deploymentVars["replicas"]
	updatedVar2 := &oapi.DeploymentVariable{
		Id:           replicasVar.Id,
		Key:          "replicas",
		DeploymentId: deploymentID,
		DefaultValue: c.NewLiteralValue(5),
	}
	engine.PushEvent(ctx, handler.DeploymentVariableUpdate, updatedVar2)

	// Second change creates a job - mark it as successful
	pendingAfterSecondChange := engine.Workspace().Jobs().GetPending()
	var job3 *oapi.Job
	for _, job := range pendingAfterSecondChange {
		job3 = job
		break
	}
	if job3 != nil {
		job3.Status = oapi.Successful
		job3.CompletedAt = &now
		engine.PushEvent(ctx, handler.JobUpdate, job3)
	}

	// Change third variable (resource variable) - triggers final job
	updatedResourceVar := c.NewResourceVariable(resourceID, "env")
	updatedResourceVar.Value = *c.NewValueFromString("production")
	engine.PushEvent(ctx, handler.ResourceVariableUpdate, updatedResourceVar)

	// Final variable change should trigger a job with all three updates
	finalPendingJobs := engine.Workspace().Jobs().GetPending()
	if len(finalPendingJobs) != 1 {
		t.Fatalf("expected 1 final pending job, got %d", len(finalPendingJobs))
	}

	var finalJob *oapi.Job
	for _, job := range finalPendingJobs {
		finalJob = job
		break
	}

	finalRelease, _ := engine.Workspace().Releases().Get(finalJob.ReleaseId)
	finalAppName, _ := finalRelease.Variables["app_name"].AsStringValue()
	finalReplicas, _ := finalRelease.Variables["replicas"].AsIntegerValue()
	finalEnv, _ := finalRelease.Variables["env"].AsStringValue()

	if finalAppName != "updated-app" {
		t.Errorf("final app_name = %s, want updated-app", finalAppName)
	}
	if int64(finalReplicas) != 5 {
		t.Errorf("final replicas = %d, want 5", finalReplicas)
	}
	if finalEnv != "production" {
		t.Errorf("final env = %s, want production", finalEnv)
	}
}
