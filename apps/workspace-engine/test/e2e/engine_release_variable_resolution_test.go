package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"

	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// TestEngine_ReleaseVariableResolution_LiteralValues tests resolving literal variable values
func TestEngine_ReleaseVariableResolution_LiteralValues(t *testing.T) {
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"app_name",
				integration.ResourceVariableStringValue("my-app"),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(3),
			),
			integration.WithResourceVariable(
				"debug_mode",
				integration.ResourceVariableBoolValue(false),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get the release for the target
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify all variables are resolved
	if len(variables) != 3 {
		t.Fatalf("expected 3 variables, got %d", len(variables))
	}

	// Check app_name
	appName, exists := variables["app_name"]
	if !exists {
		t.Fatalf("app_name variable not found")
	}
	appNameStr, _ := appName.AsStringValue()
	if appNameStr != "my-app" {
		t.Errorf("app_name = %s, want my-app", appNameStr)
	}

	// Check replicas
	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasInt, _ := replicas.AsIntegerValue()
	if int64(replicasInt) != 3 {
		t.Errorf("replicas = %d, want 3", replicasInt)
	}

	// Check debug_mode
	debugMode, exists := variables["debug_mode"]
	if !exists {
		t.Fatalf("debug_mode variable not found")
	}
	debugModeBool, _ := debugMode.AsBooleanValue()
	if debugModeBool {
		t.Errorf("debug_mode = %v, want false", debugModeBool)
	}
}

// TestEngine_ReleaseVariableResolution_ObjectValue tests resolving complex object variable values
func TestEngine_ReleaseVariableResolution_ObjectValue(t *testing.T) {
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"database_config",
				integration.ResourceVariableLiteralValue(map[string]any{
					"host":     "db.example.com",
					"port":     5432,
					"database": "production_db",
					"ssl":      true,
					"pool": map[string]any{
						"min_connections": 5,
						"max_connections": 20,
					},
				}),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get the release for the target
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	dbConfig, exists := variables["database_config"]
	if !exists {
		t.Fatalf("database_config variable not found")
	}

	// Verify it's an object
	obj, err := dbConfig.AsObjectValue()
	if err != nil {
		t.Fatalf("database_config is not an object: %v", err)
	}

	// Verify nested fields
	if obj.Object["host"] != "db.example.com" {
		t.Errorf("host = %s, want db.example.com", obj.Object["host"])
	}

	if obj.Object["port"] != float64(5432) {
		t.Errorf("port = %v, want 5432", obj.Object["port"])
	}

	if obj.Object["ssl"] != true {
		t.Errorf("ssl = %v, want true", obj.Object["ssl"])
	}

	// Verify nested pool object
	pool, ok := obj.Object["pool"].(map[string]interface{})
	if !ok {
		t.Fatalf("pool is not a map")
	}

	if pool["min_connections"] != float64(5) {
		t.Errorf("pool.min_connections = %v, want 5", pool["min_connections"])
	}
}

// TestEngine_ReleaseVariableResolution_ReferenceValue tests resolving reference variable values
func TestEngine_ReleaseVariableResolution_ReferenceValue(t *testing.T) {
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
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
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
		integration.WithResource(
			integration.ResourceID(vpcID),
			integration.ResourceName("vpc-main"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				"cidr":   "10.0.0.0/16",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-main"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
				"region": "us-east-1",
			}),
			integration.WithResourceVariable(
				"vpc_id",
				integration.ResourceVariableReferenceValue("vpc", []string{"id"}),
			),
			integration.WithResourceVariable(
				"vpc_region",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "region"}),
			),
			integration.WithResourceVariable(
				"vpc_cidr",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "cidr"}),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get the release for the target
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify all reference variables are resolved
	if len(variables) != 3 {
		t.Fatalf("expected 3 variables, got %d", len(variables))
	}

	// Check vpc_id
	vpcIDVar, exists := variables["vpc_id"]
	if !exists {
		t.Fatalf("vpc_id variable not found")
	}
	vpcIDStr, _ := vpcIDVar.AsStringValue()
	if vpcIDStr != vpcID {
		t.Errorf("vpc_id = %s, want %s", vpcIDStr, vpcID)
	}

	// Check vpc_region
	vpcRegion, exists := variables["vpc_region"]
	if !exists {
		t.Fatalf("vpc_region variable not found")
	}
	vpcRegionStr, _ := vpcRegion.AsStringValue()
	if vpcRegionStr != "us-east-1" {
		t.Errorf("vpc_region = %s, want us-east-1", vpcRegionStr)
	}

	// Check vpc_cidr
	vpcCIDR, exists := variables["vpc_cidr"]
	if !exists {
		t.Fatalf("vpc_cidr variable not found")
	}
	vpcCIDRStr, _ := vpcCIDR.AsStringValue()
	if vpcCIDRStr != "10.0.0.0/16" {
		t.Errorf("vpc_cidr = %s, want 10.0.0.0/16", vpcCIDRStr)
	}
}

// TestEngine_ReleaseVariableResolution_MixedValues tests resolving mix of literal and reference values
func TestEngine_ReleaseVariableResolution_MixedValues(t *testing.T) {
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
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgentID),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
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
		integration.WithResource(
			integration.ResourceID(vpcID),
			integration.ResourceName("vpc-main"),
			integration.ResourceKind("vpc"),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-main"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
			}),
			integration.WithResourceVariable(
				"cluster_name",
				integration.ResourceVariableStringValue("prod-cluster"),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(5),
			),
			integration.WithResourceVariable(
				"vpc_name",
				integration.ResourceVariableReferenceValue("vpc", []string{"name"}),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get the release for the target
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify all variables are resolved
	if len(variables) != 3 {
		t.Fatalf("expected 3 variables, got %d", len(variables))
	}

	// Check literal values
	clusterName, exists := variables["cluster_name"]
	if !exists {
		t.Fatalf("cluster_name variable not found")
	}
	clusterNameStr, _ := clusterName.AsStringValue()
	if clusterNameStr != "prod-cluster" {
		t.Errorf("cluster_name = %s, want prod-cluster", clusterNameStr)
	}

	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasInt, _ := replicas.AsIntegerValue()
	if int64(replicasInt) != 5 {
		t.Errorf("replicas = %d, want 5", replicasInt)
	}

	// Check reference value
	vpcName, exists := variables["vpc_name"]
	if !exists {
		t.Fatalf("vpc_name variable not found")
	}
	vpcNameStr, _ := vpcName.AsStringValue()
	if vpcNameStr != "vpc-main" {
		t.Errorf("vpc_name = %s, want vpc-main", vpcNameStr)
	}
}

// TestEngine_ReleaseVariableResolution_MultipleResources tests variable resolution for multiple resources
func TestEngine_ReleaseVariableResolution_MultipleResources(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID1 := uuid.New().String()
	resourceID2 := uuid.New().String()
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID1),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(3),
			),
			integration.WithResourceVariable(
				"region",
				integration.ResourceVariableStringValue("us-east-1"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID2),
			integration.ResourceName("server-2"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(5),
			),
			integration.WithResourceVariable(
				"region",
				integration.ResourceVariableStringValue("us-west-2"),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation for both resources
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Get release for resource 1
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID1,
	}

	jobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget1)
	if len(jobs1) != 1 {
		t.Fatalf("expected 1 job for resource 1, got %d", len(jobs1))
	}

	var job1 *oapi.Job
	for _, j := range jobs1 {
		job1 = j
		break
	}

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 1")
	}

	variables1 := release1.Variables

	// Verify resource 1 variables
	replicas1Int, _ := variables1["replicas"].AsIntegerValue()
	if int64(replicas1Int) != 3 {
		t.Errorf("resource 1 replicas = %d, want 3", replicas1Int)
	}
	region1Str, _ := variables1["region"].AsStringValue()
	if region1Str != "us-east-1" {
		t.Errorf("resource 1 region = %s, want us-east-1", region1Str)
	}

	// Get release for resource 2
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID2,
	}

	jobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget2)
	if len(jobs2) != 1 {
		t.Fatalf("expected 1 job for resource 2, got %d", len(jobs2))
	}

	var job2 *oapi.Job
	for _, j := range jobs2 {
		job2 = j
		break
	}

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release not found for resource 2")
	}

	variables2 := release2.Variables

	// Verify resource 2 variables (different from resource 1)
	replicas2Int, _ := variables2["replicas"].AsIntegerValue()
	if int64(replicas2Int) != 5 {
		t.Errorf("resource 2 replicas = %d, want 5", replicas2Int)
	}
	region2Str, _ := variables2["region"].AsStringValue()
	if region2Str != "us-west-2" {
		t.Errorf("resource 2 region = %s, want us-west-2", region2Str)
	}
}

// TestEngine_ReleaseVariableResolution_ChainedReferences tests resolving chained relationship references
func TestEngine_ReleaseVariableResolution_ChainedReferences(t *testing.T) {
	jobAgentID := uuid.New().String()
	podID := uuid.New().String()
	clusterID := uuid.New().String()
	vpcID := uuid.New().String()
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		// Pod -> Cluster relationship
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("pod-to-cluster"),
			integration.RelationshipRuleReference("cluster"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "pod",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cluster_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		// Cluster -> VPC relationship
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-2"),
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
		integration.WithResource(
			integration.ResourceID(vpcID),
			integration.ResourceName("vpc-main"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"cidr": "10.0.0.0/16",
			}),
		),
		integration.WithResource(
			integration.ResourceID(clusterID),
			integration.ResourceName("cluster-main"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
			}),
		),
		integration.WithResource(
			integration.ResourceID(podID),
			integration.ResourceName("pod-api-123"),
			integration.ResourceKind("pod"),
			integration.ResourceMetadata(map[string]string{
				"cluster_id": clusterID,
			}),
			// Pod can reference its cluster directly
			integration.WithResourceVariable(
				"cluster_name",
				integration.ResourceVariableReferenceValue("cluster", []string{"name"}),
			),
			// Pod cannot directly reference VPC (would need cluster as intermediary in real scenario)
			// But cluster can reference VPC
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test pod referencing cluster
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    podID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify cluster_name is resolved
	clusterName, exists := variables["cluster_name"]
	if !exists {
		t.Fatalf("cluster_name variable not found")
	}
	clusterNameStr, _ := clusterName.AsStringValue()
	if clusterNameStr != "cluster-main" {
		t.Errorf("cluster_name = %s, want cluster-main", clusterNameStr)
	}
}

// TestEngine_ReleaseVariableResolution_NoVariables tests resource with no variables
func TestEngine_ReleaseVariableResolution_NoVariables(t *testing.T) {
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
		// No variables defined
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Should return empty map, not nil
	if variables == nil {
		t.Fatalf("variables should not be nil")
	}

	// Should have no variables
	if len(variables) != 0 {
		t.Fatalf("expected 0 variables, got %d", len(variables))
	}
}

// TestEngine_ReleaseVariableResolution_DifferentResourceTypes tests variables across different resource types
func TestEngine_ReleaseVariableResolution_DifferentResourceTypes(t *testing.T) {
	jobAgentID := uuid.New().String()
	dbID := uuid.New().String()
	cacheID := uuid.New().String()
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(dbID),
			integration.ResourceName("postgres-main"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"engine": "postgres",
			}),
			integration.WithResourceVariable(
				"connection_string",
				integration.ResourceVariableStringValue("postgres://localhost:5432/mydb"),
			),
			integration.WithResourceVariable(
				"max_connections",
				integration.ResourceVariableIntValue(100),
			),
		),
		integration.WithResource(
			integration.ResourceID(cacheID),
			integration.ResourceName("redis-main"),
			integration.ResourceKind("cache"),
			integration.ResourceMetadata(map[string]string{
				"engine": "redis",
			}),
			integration.WithResourceVariable(
				"endpoint",
				integration.ResourceVariableStringValue("redis://localhost:6379"),
			),
			integration.WithResourceVariable(
				"ttl_seconds",
				integration.ResourceVariableIntValue(3600),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation for both resources
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test database variables
	dbReleaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    dbID,
	}

	dbJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(dbReleaseTarget)
	if len(dbJobs) != 1 {
		t.Fatalf("expected 1 job for database, got %d", len(dbJobs))
	}

	var dbJob *oapi.Job
	for _, j := range dbJobs {
		dbJob = j
		break
	}

	dbRelease, exists := engine.Workspace().Releases().Get(dbJob.ReleaseId)
	if !exists {
		t.Fatalf("release not found for database")
	}

	dbVariables := dbRelease.Variables

	if len(dbVariables) != 2 {
		t.Fatalf("expected 2 database variables, got %d", len(dbVariables))
	}

	connStr, _ := dbVariables["connection_string"].AsStringValue()
	if connStr != "postgres://localhost:5432/mydb" {
		t.Errorf("connection_string mismatch")
	}

	maxConn, _ := dbVariables["max_connections"].AsIntegerValue()
	if int64(maxConn) != 100 {
		t.Errorf("max_connections mismatch")
	}

	// Test cache variables
	cacheReleaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    cacheID,
	}

	cacheJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(cacheReleaseTarget)
	if len(cacheJobs) != 1 {
		t.Fatalf("expected 1 job for cache, got %d", len(cacheJobs))
	}

	var cacheJob *oapi.Job
	for _, j := range cacheJobs {
		cacheJob = j
		break
	}

	cacheRelease, exists := engine.Workspace().Releases().Get(cacheJob.ReleaseId)
	if !exists {
		t.Fatalf("release not found for cache")
	}

	cacheVariables := cacheRelease.Variables

	if len(cacheVariables) != 2 {
		t.Fatalf("expected 2 cache variables, got %d", len(cacheVariables))
	}

	endpoint, _ := cacheVariables["endpoint"].AsStringValue()
	if endpoint != "redis://localhost:6379" {
		t.Errorf("endpoint mismatch")
	}

	ttl, _ := cacheVariables["ttl_seconds"].AsIntegerValue()
	if int64(ttl) != 3600 {
		t.Errorf("ttl_seconds mismatch")
	}
}

// TestEngine_ReleaseVariableResolution_NestedReferenceProperty tests reference to nested properties
func TestEngine_ReleaseVariableResolution_NestedReferenceProperty(t *testing.T) {
	jobAgentID := uuid.New().String()
	serviceID := uuid.New().String()
	dbID := uuid.New().String()
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
			integration.RelationshipRuleName("service-to-database"),
			integration.RelationshipRuleReference("database"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "db_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID(dbID),
			integration.ResourceName("postgres-main"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"host":     "db.example.com",
				"port":     "5432",
				"database": "production_db",
			}),
		),
		integration.WithResource(
			integration.ResourceID(serviceID),
			integration.ResourceName("api-service"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"db_id": dbID,
			}),
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
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    serviceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify all nested properties are resolved correctly
	if len(variables) != 3 {
		t.Fatalf("expected 3 variables, got %d", len(variables))
	}

	dbHost, _ := variables["db_host"].AsStringValue()
	if dbHost != "db.example.com" {
		t.Errorf("db_host = %s, want db.example.com", dbHost)
	}

	dbPort, _ := variables["db_port"].AsStringValue()
	if dbPort != "5432" {
		t.Errorf("db_port = %s, want 5432", dbPort)
	}

	dbName, _ := variables["db_name"].AsStringValue()
	if dbName != "production_db" {
		t.Errorf("db_name = %s, want production_db", dbName)
	}
}

// TestEngine_ReleaseVariableResolution_MultipleReferences tests resource with multiple relationship references
func TestEngine_ReleaseVariableResolution_MultipleReferences(t *testing.T) {
	jobAgentID := uuid.New().String()
	appID := uuid.New().String()
	dbID := uuid.New().String()
	cacheID := uuid.New().String()
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		// App -> Database relationship
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-1"),
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
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		// App -> Cache relationship
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rel-rule-2"),
			integration.RelationshipRuleName("app-to-cache"),
			integration.RelationshipRuleReference("cache"),
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
				"value":    "cache",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cache_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		integration.WithResource(
			integration.ResourceID(dbID),
			integration.ResourceName("postgres-main"),
			integration.ResourceKind("database"),
		),
		integration.WithResource(
			integration.ResourceID(cacheID),
			integration.ResourceName("redis-main"),
			integration.ResourceKind("cache"),
		),
		integration.WithResource(
			integration.ResourceID(appID),
			integration.ResourceName("web-app"),
			integration.ResourceKind("application"),
			integration.ResourceMetadata(map[string]string{
				"db_id":    dbID,
				"cache_id": cacheID,
			}),
			integration.WithResourceVariable(
				"db_name",
				integration.ResourceVariableReferenceValue("database", []string{"name"}),
			),
			integration.WithResourceVariable(
				"cache_name",
				integration.ResourceVariableReferenceValue("cache", []string{"name"}),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    appID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify both references are resolved
	if len(variables) != 2 {
		t.Fatalf("expected 2 variables, got %d", len(variables))
	}

	dbNameStr, _ := variables["db_name"].AsStringValue()
	if dbNameStr != "postgres-main" {
		t.Errorf("db_name = %s, want postgres-main", dbNameStr)
	}

	cacheNameStr, _ := variables["cache_name"].AsStringValue()
	if cacheNameStr != "redis-main" {
		t.Errorf("cache_name = %s, want redis-main", cacheNameStr)
	}
}

// TestEngine_ReleaseVariableResolution_DirectResolveValue tests the low-level ResolveValue function
func TestEngine_ReleaseVariableResolution_DirectResolveValue(t *testing.T) {
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("test-resource"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	resource, exists := engine.Workspace().Resources().Get(resourceID)
	if !exists {
		t.Fatalf("resource not found")
	}

	entity := relationships.NewResourceEntity(resource)

	// Test literal string value
	stringValue := c.NewValueFromString("test-string")

	resolved, err := engine.Workspace().Variables().ResolveValue(ctx, entity, stringValue)
	if err != nil {
		t.Fatalf("failed to resolve string value: %v", err)
	}

	resolvedStr, _ := resolved.AsStringValue()
	if resolvedStr != "test-string" {
		t.Errorf("resolved string = %s, want test-string", resolvedStr)
	}

	// Test literal int value
	intValue := c.NewValueFromInt(42)

	resolved, err = engine.Workspace().Variables().ResolveValue(ctx, entity, intValue)
	if err != nil {
		t.Fatalf("failed to resolve int value: %v", err)
	}

	resolvedInt, _ := resolved.AsIntegerValue()
	if int64(resolvedInt) != 42 {
		t.Errorf("resolved int = %d, want 42", resolvedInt)
	}

	// Test literal bool value
	boolValue := c.NewValueFromBool(true)

	resolved, err = engine.Workspace().Variables().ResolveValue(ctx, entity, boolValue)
	if err != nil {
		t.Fatalf("failed to resolve bool value: %v", err)
	}

	resolvedBool, _ := resolved.AsBooleanValue()
	if !resolvedBool {
		t.Errorf("resolved bool = %v, want true", resolvedBool)
	}
}

// TestEngine_ReleaseVariableResolution_DeploymentLiteralValues tests resolving deployment variable literal values
func TestEngine_ReleaseVariableResolution_DeploymentLiteralValues(t *testing.T) {
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
				integration.WithDeploymentVariable(
					"app_port",
					integration.DeploymentVariableIntValue(8080),
				),
				integration.WithDeploymentVariable(
					"app_name",
					integration.DeploymentVariableStringValue("my-api"),
				),
				integration.WithDeploymentVariable(
					"enable_metrics",
					integration.DeploymentVariableBoolValue(true),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify all deployment variables are resolved
	if len(variables) != 3 {
		t.Fatalf("expected 3 variables, got %d", len(variables))
	}

	// Check app_port
	appPort, exists := variables["app_port"]
	if !exists {
		t.Fatalf("app_port variable not found")
	}
	appPortInt, _ := appPort.AsIntegerValue()
	if int64(appPortInt) != 8080 {
		t.Errorf("app_port = %d, want 8080", appPortInt)
	}

	// Check app_name
	appName, exists := variables["app_name"]
	if !exists {
		t.Fatalf("app_name variable not found")
	}
	appNameStr, _ := appName.AsStringValue()
	if appNameStr != "my-api" {
		t.Errorf("app_name = %s, want my-api", appNameStr)
	}

	// Check enable_metrics
	enableMetrics, exists := variables["enable_metrics"]
	if !exists {
		t.Fatalf("enable_metrics variable not found")
	}
	enableMetricsBool, _ := enableMetrics.AsBooleanValue()
	if !enableMetricsBool {
		t.Errorf("enable_metrics = %v, want true", enableMetricsBool)
	}
}

// TestEngine_ReleaseVariableResolution_DeploymentObjectValue tests resolving deployment variable object values
func TestEngine_ReleaseVariableResolution_DeploymentObjectValue(t *testing.T) {
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
				integration.WithDeploymentVariable(
					"api_config",
					integration.DeploymentVariableLiteralValue(map[string]any{
						"timeout": 30,
						"retries": 3,
						"auth": map[string]any{
							"enabled": true,
							"type":    "bearer",
						},
					}),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify api_config exists
	apiConfig, exists := variables["api_config"]
	if !exists {
		t.Fatalf("api_config variable not found")
	}

	// Verify it's an object
	obj, err := apiConfig.AsObjectValue()
	if err != nil {
		t.Fatalf("api_config is not an object: %v", err)
	}

	// Verify nested fields
	if obj.Object["timeout"] != float64(30) {
		t.Errorf("timeout = %v, want 30", obj.Object["timeout"])
	}

	if obj.Object["retries"] != float64(3) {
		t.Errorf("retries = %v, want 3", obj.Object["retries"])
	}

	// Verify nested auth object
	auth, ok := obj.Object["auth"].(map[string]interface{})
	if !ok {
		t.Fatalf("auth is not a map")
	}

	if auth["enabled"] != true {
		t.Errorf("auth.enabled = %v, want true", auth["enabled"])
	}

	if auth["type"] != "bearer" {
		t.Errorf("auth.type = %s, want bearer", auth["type"])
	}
}

// TestEngine_ReleaseVariableResolution_DeploymentResourceOverride tests that resource variables override deployment variables
func TestEngine_ReleaseVariableResolution_DeploymentResourceOverride(t *testing.T) {
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
				integration.WithDeploymentVariable(
					"replicas",
					integration.DeploymentVariableIntValue(3),
				),
				integration.WithDeploymentVariable(
					"region",
					integration.DeploymentVariableStringValue("us-west-2"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(5),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify 2 variables (replicas and region)
	if len(variables) != 2 {
		t.Fatalf("expected 2 variables, got %d", len(variables))
	}

	// Check replicas is overridden by resource variable
	replicas, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}
	replicasInt, _ := replicas.AsIntegerValue()
	if int64(replicasInt) != 5 {
		t.Errorf("replicas = %d, want 5 (resource override)", replicasInt)
	}

	// Check region comes from deployment variable
	region, exists := variables["region"]
	if !exists {
		t.Fatalf("region variable not found")
	}
	regionStr, _ := region.AsStringValue()
	if regionStr != "us-west-2" {
		t.Errorf("region = %s, want us-west-2", regionStr)
	}
}

// TestEngine_ReleaseVariableResolution_MultipleDeployments tests that different deployments have different variables
func TestEngine_ReleaseVariableResolution_MultipleDeployments(t *testing.T) {
	jobAgent1ID := uuid.New().String()
	jobAgent2ID := uuid.New().String()
	resourceID := uuid.New().String()
	deployment1ID := uuid.New().String()
	deployment2ID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgent1ID),
			integration.JobAgentName("API Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID(jobAgent2ID),
			integration.JobAgentName("Worker Agent"),
		),
		integration.WithSystem(
			integration.SystemName("test-system"),
			integration.WithDeployment(
				integration.DeploymentID(deployment1ID),
				integration.DeploymentName("api"),
				integration.DeploymentJobAgent(jobAgent1ID),
				integration.WithDeploymentVariable(
					"port",
					integration.DeploymentVariableIntValue(8080),
				),
				integration.WithDeploymentVariable(
					"type",
					integration.DeploymentVariableStringValue("api"),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID(deployment2ID),
				integration.DeploymentName("worker"),
				integration.DeploymentJobAgent(jobAgent2ID),
				integration.WithDeploymentVariable(
					"port",
					integration.DeploymentVariableIntValue(9090),
				),
				integration.WithDeploymentVariable(
					"type",
					integration.DeploymentVariableStringValue("worker"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create deployment version for API
	apiDv := c.NewDeploymentVersion()
	apiDv.DeploymentId = deployment1ID
	apiDv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, apiDv)

	// Evaluate variables for API deployment
	apiReleaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deployment1ID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	apiJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(apiReleaseTarget)
	if len(apiJobs) != 1 {
		t.Fatalf("expected 1 API job, got %d", len(apiJobs))
	}

	var apiJob *oapi.Job
	for _, j := range apiJobs {
		apiJob = j
		break
	}

	apiRelease, exists := engine.Workspace().Releases().Get(apiJob.ReleaseId)
	if !exists {
		t.Fatalf("API release not found")
	}

	apiVariables := apiRelease.Variables

	// Verify API deployment variables
	if len(apiVariables) != 2 {
		t.Fatalf("expected 2 API variables, got %d", len(apiVariables))
	}

	apiPort, _ := apiVariables["port"].AsIntegerValue()
	if int64(apiPort) != 8080 {
		t.Errorf("API port = %d, want 8080", apiPort)
	}

	apiType, _ := apiVariables["type"].AsStringValue()
	if apiType != "api" {
		t.Errorf("API type = %s, want api", apiType)
	}

	// Create deployment version for Worker
	workerDv := c.NewDeploymentVersion()
	workerDv.DeploymentId = deployment2ID
	workerDv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, workerDv)

	// Evaluate variables for Worker deployment
	workerReleaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deployment2ID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	workerJobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(workerReleaseTarget)
	if len(workerJobs) != 1 {
		t.Fatalf("expected 1 Worker job, got %d", len(workerJobs))
	}

	var workerJob *oapi.Job
	for _, j := range workerJobs {
		workerJob = j
		break
	}

	workerRelease, exists := engine.Workspace().Releases().Get(workerJob.ReleaseId)
	if !exists {
		t.Fatalf("Worker release not found")
	}

	workerVariables := workerRelease.Variables

	// Verify Worker deployment variables (different from API)
	if len(workerVariables) != 2 {
		t.Fatalf("expected 2 Worker variables, got %d", len(workerVariables))
	}

	workerPort, _ := workerVariables["port"].AsIntegerValue()
	if int64(workerPort) != 9090 {
		t.Errorf("Worker port = %d, want 9090", workerPort)
	}

	workerType, _ := workerVariables["type"].AsStringValue()
	if workerType != "worker" {
		t.Errorf("Worker type = %s, want worker", workerType)
	}
}

// TestEngine_ReleaseVariableResolution_DeploymentMixedSources tests variables from both deployment and resource
func TestEngine_ReleaseVariableResolution_DeploymentMixedSources(t *testing.T) {
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
				integration.WithDeploymentVariable(
					"app_version",
					integration.DeploymentVariableStringValue("v1.2.3"),
				),
				integration.WithDeploymentVariable(
					"timeout",
					integration.DeploymentVariableIntValue(30),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
			integration.WithResourceVariable(
				"instance_id",
				integration.ResourceVariableStringValue("i-1234567890"),
			),
			integration.WithResourceVariable(
				"zone",
				integration.ResourceVariableStringValue("us-east-1a"),
			),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify all variables from both sources
	if len(variables) != 4 {
		t.Fatalf("expected 4 variables, got %d", len(variables))
	}

	// Check deployment variables
	appVersion, _ := variables["app_version"].AsStringValue()
	if appVersion != "v1.2.3" {
		t.Errorf("app_version = %s, want v1.2.3", appVersion)
	}

	timeout, _ := variables["timeout"].AsIntegerValue()
	if int64(timeout) != 30 {
		t.Errorf("timeout = %d, want 30", timeout)
	}

	// Check resource variables
	instanceID, _ := variables["instance_id"].AsStringValue()
	if instanceID != "i-1234567890" {
		t.Errorf("instance_id = %s, want i-1234567890", instanceID)
	}

	zone, _ := variables["zone"].AsStringValue()
	if zone != "us-east-1a" {
		t.Errorf("zone = %s, want us-east-1a", zone)
	}
}

// TestEngine_ReleaseVariableResolution_DeploymentNoVariables tests deployment with no variables
func TestEngine_ReleaseVariableResolution_DeploymentNoVariables(t *testing.T) {
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
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
		// No deployment variables defined
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Should return empty map
	if variables == nil {
		t.Fatalf("variables should not be nil")
	}

	if len(variables) != 0 {
		t.Fatalf("expected 0 variables, got %d", len(variables))
	}
}

// TestEngine_ReleaseVariableResolution_DeploymentEmptyStringValue tests deployment variable with empty string
func TestEngine_ReleaseVariableResolution_DeploymentEmptyStringValue(t *testing.T) {
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
				integration.WithDeploymentVariable(
					"optional_value",
					integration.DeploymentVariableStringValue(""),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("server-1"),
			integration.ResourceKind("server"),
		),
	)

	ctx := context.Background()

	// Create a deployment version to trigger release creation
	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Verify optional_value exists
	optionalValue, exists := variables["optional_value"]
	if !exists {
		t.Fatalf("optional_value variable not found")
	}

	// Verify it's an empty string
	optionalValueStr, _ := optionalValue.AsStringValue()
	if optionalValueStr != "" {
		t.Errorf("optional_value = %s, want empty string", optionalValueStr)
	}
}
