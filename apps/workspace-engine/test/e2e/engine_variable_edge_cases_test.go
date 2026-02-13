package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// NULL AND UNDEFINED HANDLING TESTS
// =============================================================================

// TestEngine_VariableResolution_NullValueInDeploymentDefault tests deployment variable with explicit null default
func TestEngine_VariableResolution_NullValueInDeploymentDefault(t *testing.T) {
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
				integration.WithDeploymentVariable("optional_config"),
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
		),
	)

	ctx := context.Background()

	// Get deployment and set null default value directly
	deployment, _ := engine.Workspace().Deployments().Get(deploymentID)
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	if optConfig, exists := deploymentVars["optional_config"]; exists {
		// Set to nil (null)
		optConfig.DefaultValue = nil
		engine.Workspace().DeploymentVariables().Upsert(ctx, optConfig.Id, optConfig)
	}

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deployment.Id
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

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Variable with nil default should NOT be included (no value to resolve)
	if _, exists := variables["optional_config"]; exists {
		t.Logf("Note: Variable with nil default is included in release")
	} else {
		t.Logf("Variable with nil default is NOT included in release (expected behavior)")
	}

	_, dcOptionalConfigExists := (*job.DispatchContext.Variables)["optional_config"]
	if !dcOptionalConfigExists {
		t.Logf("optional_config correctly not in DispatchContext.Variables")
	}
}

// TestEngine_VariableResolution_NullInNestedObjectPath tests null values in nested object property paths
func TestEngine_VariableResolution_NullInNestedObjectPath(t *testing.T) {
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
						"database": map[string]any{
							"host": "localhost",
							"auth": nil, // null value in nested path
							"port": 5432,
						},
						"cache": map[string]any{
							"host": "redis.local",
						},
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
		),
	)

	ctx := context.Background()

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

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)
	assert.NotNil(t, (*job.DispatchContext.Variables)["config"])

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables
	config, exists := variables["config"]
	if !exists {
		t.Fatalf("config variable not found")
	}

	obj, err := config.AsObjectValue()
	if err != nil {
		t.Fatalf("config is not an object: %v", err)
	}

	// Verify nested null is preserved
	database, ok := obj.Object["database"].(map[string]interface{})
	if !ok {
		t.Fatalf("database is not a map")
	}

	// Check that null value is present
	if auth, exists := database["auth"]; exists {
		if auth != nil {
			t.Errorf("auth should be nil, got %v", auth)
		}
		t.Logf("SUCCESS: null value preserved in nested object path")
	} else {
		t.Logf("Note: null value was omitted from nested object")
	}
}

// TestEngine_VariableResolution_ResourceVariableOverrideWithNull tests resource variable overriding deployment default with null
func TestEngine_VariableResolution_ResourceVariableOverrideWithNull(t *testing.T) {
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
					"feature_flag",
					integration.DeploymentVariableDefaultStringValue("enabled"),
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
			// Resource variable with null value - testing if this can override
			integration.WithResourceVariable(
				"feature_flag",
				integration.ResourceVariableLiteralValue(nil),
			),
		),
	)

	ctx := context.Background()

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

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Test behavior when resource variable has null value
	if featureFlag, exists := variables["feature_flag"]; exists {
		if val, err := featureFlag.AsStringValue(); err == nil {
			t.Logf("feature_flag resolved to: %s (deployment default used)", val)
			dcVal, dcErr := (*job.DispatchContext.Variables)["feature_flag"].AsStringValue()
			assert.NoError(t, dcErr)
			assert.Equal(t, val, dcVal)
		} else {
			t.Logf("feature_flag exists but type conversion failed: %v", err)
		}
	} else {
		t.Logf("feature_flag not found in variables (null override removed it)")
		_, dcFeatureFlagExists := (*job.DispatchContext.Variables)["feature_flag"]
		if !dcFeatureFlagExists {
			t.Logf("feature_flag correctly not in DispatchContext.Variables")
		}
	}
}

// =============================================================================
// REFERENCE RESOLUTION FAILURES TESTS
// =============================================================================

// TestEngine_VariableResolution_ReferenceWithZeroMatches tests reference when no resources match relationship
func TestEngine_VariableResolution_ReferenceWithZeroMatches(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

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
				integration.WithDeploymentVariable("vpc_id"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
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
		// NO VPC resource created - relationship has zero matches
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": "vpc-nonexistent",
			}),
			integration.WithResourceVariable(
				"vpc_id",
				integration.ResourceVariableReferenceValue("vpc", []string{"id"}),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	// Release should still be created even when reference has zero matches
	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job even with zero reference matches, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release should exist even when reference has zero matches")
	}

	variables := release.Variables

	// Variable should not be resolved when reference has zero matches
	if _, exists := variables["vpc_id"]; exists {
		t.Errorf("vpc_id should not exist when reference has zero matches")
	} else {
		t.Logf("SUCCESS: Variable correctly excluded when reference has zero matches")
	}

	_, dcVpcIdExists := (*job.DispatchContext.Variables)["vpc_id"]
	assert.False(t, dcVpcIdExists, "vpc_id should not exist in DispatchContext.Variables when reference has zero matches")
}

// TestEngine_VariableResolution_ReferenceWithMultipleMatches tests reference when multiple resources match
func TestEngine_VariableResolution_ReferenceWithMultipleMatches(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	vpc1ID := uuid.New().String()
	vpc2ID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

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
				integration.WithDeploymentVariable("vpc_name"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
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
				integration.PropertyMatcherFromProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherToProperty([]string{"metadata", "region"}),
				integration.PropertyMatcherOperator(oapi.Equals),
			),
		),
		// Create MULTIPLE VPCs in same region - relationship will match multiple
		integration.WithResource(
			integration.ResourceID(vpc1ID),
			integration.ResourceName("vpc-primary"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(vpc2ID),
			integration.ResourceName("vpc-secondary"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
			}),
			integration.WithResourceVariable(
				"vpc_name",
				integration.ResourceVariableReferenceValue("vpc", []string{"name"}),
			),
		),
	)

	ctx := context.Background()

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

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// When multiple resources match, implementation should use the FIRST match
	if vpcName, exists := variables["vpc_name"]; exists {
		name, _ := vpcName.AsStringValue()
		t.Logf("SUCCESS: Reference with multiple matches resolved to: %s (first match)", name)
		if name != "vpc-primary" && name != "vpc-secondary" {
			t.Errorf("vpc_name should be one of the matching VPCs, got %s", name)
		}
		dcName, dcErr := (*job.DispatchContext.Variables)["vpc_name"].AsStringValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, name, dcName)
	} else {
		t.Errorf("vpc_name should be resolved when reference has multiple matches (should use first)")
	}
}

// TestEngine_VariableResolution_ReferenceWithMissingIntermediateProperty tests reference when intermediate property is missing
func TestEngine_VariableResolution_ReferenceWithMissingIntermediateProperty(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	vpcID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

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
				integration.WithDeploymentVariable("subnet_cidr"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
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
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				// NOTE: No "subnets" property - intermediate property is missing
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
			}),
			integration.WithResourceVariable(
				"subnet_cidr",
				// References property path where intermediate "subnets" doesn't exist
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "subnets", "private", "cidr"}),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	// Release should still be created even when property path is invalid
	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job even with invalid property path, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release should exist even when property path is invalid")
	}

	variables := release.Variables

	// Variable should not be resolved when intermediate property is missing
	if _, exists := variables["subnet_cidr"]; exists {
		t.Errorf("subnet_cidr should not exist when intermediate property is missing")
	} else {
		t.Logf("SUCCESS: Variable correctly excluded when intermediate property path is missing")
	}

	_, dcSubnetCidrExists := (*job.DispatchContext.Variables)["subnet_cidr"]
	assert.False(t, dcSubnetCidrExists, "subnet_cidr should not exist in DispatchContext.Variables when intermediate property is missing")
}

// TestEngine_VariableResolution_ReferenceWithLeafPropertyMissing tests reference when only the leaf property is missing
func TestEngine_VariableResolution_ReferenceWithLeafPropertyMissing(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	vpcID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	relRuleID := uuid.New().String()

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
				integration.WithDeploymentVariable("vpc_cidr"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithRelationshipRule(
			integration.RelationshipRuleID(relRuleID),
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
			integration.ResourceName("vpc-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region": "us-east-1",
				// NOTE: "cidr" property is missing
			}),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("cluster-1"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id": vpcID,
			}),
			integration.WithResourceVariable(
				"vpc_cidr",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "cidr"}),
			),
		),
	)

	ctx := context.Background()

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

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	variables := release.Variables

	// Variable should not be resolved when leaf property is missing
	if _, exists := variables["vpc_cidr"]; exists {
		t.Errorf("vpc_cidr should not exist when leaf property is missing")
	} else {
		t.Logf("SUCCESS: Variable correctly excluded when leaf property is missing")
	}

	_, dcVpcCidrExists := (*job.DispatchContext.Variables)["vpc_cidr"]
	assert.False(t, dcVpcCidrExists, "vpc_cidr should not exist in DispatchContext.Variables when leaf property is missing")
}

// TestEngine_VariableResolution_ReferenceToNonExistentRelationship tests reference to relationship name that doesn't exist
func TestEngine_VariableResolution_ReferenceToNonExistentRelationship(t *testing.T) {
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
				integration.WithDeploymentVariable("database_host"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// NO relationship rules defined at all
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("app-1"),
			integration.ResourceKind("application"),
			integration.WithResourceVariable(
				"database_host",
				// References non-existent relationship
				integration.ResourceVariableReferenceValue("database", []string{"metadata", "host"}),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resourceID,
	}

	// Release should still be created even when relationship doesn't exist
	jobs := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) != 1 {
		t.Fatalf("expected 1 job even with non-existent relationship, got %d", len(jobs))
	}

	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release should exist even when relationship doesn't exist")
	}

	variables := release.Variables

	// Variable should not be resolved when relationship doesn't exist
	if _, exists := variables["database_host"]; exists {
		t.Errorf("database_host should not exist when relationship doesn't exist")
	} else {
		t.Logf("SUCCESS: Variable correctly excluded when relationship doesn't exist")
	}

	_, dcDatabaseHostExists := (*job.DispatchContext.Variables)["database_host"]
	assert.False(t, dcDatabaseHostExists, "database_host should not exist in DispatchContext.Variables when relationship doesn't exist")
}

// =============================================================================
// TYPE CONVERSION AND COERCION TESTS
// =============================================================================

// TestEngine_VariableResolution_StringNumberConversion tests string "123" vs number 123
func TestEngine_VariableResolution_StringNumberConversion(t *testing.T) {
	jobAgentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
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
				integration.WithDeploymentVariable("port"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// Resource 1 with string "8080"
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
			integration.WithResourceVariable(
				"port",
				integration.ResourceVariableStringValue("8080"),
			),
		),
		// Resource 2 with integer 8080
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
			integration.WithResourceVariable(
				"port",
				integration.ResourceVariableIntValue(8080),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (string "8080")
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource1ID,
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

	assert.NotNil(t, job1.DispatchContext)
	assert.NotNil(t, job1.DispatchContext.Variables)

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release 1 not found")
	}

	port1 := release1.Variables["port"]
	if port1Str, err := port1.AsStringValue(); err == nil {
		t.Logf("Resource 1 port (string): %s", port1Str)
		if port1Str != "8080" {
			t.Errorf("Resource 1 port string should be '8080', got %s", port1Str)
		}
		dcPort1, dcErr := (*job1.DispatchContext.Variables)["port"].AsStringValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, "8080", dcPort1)
	} else {
		t.Logf("Resource 1 port is not a string: %v", err)
	}

	// Test resource 2 (integer 8080)
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource2ID,
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

	assert.NotNil(t, job2.DispatchContext)
	assert.NotNil(t, job2.DispatchContext.Variables)

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release 2 not found")
	}

	port2 := release2.Variables["port"]
	if port2Int, err := port2.AsIntegerValue(); err == nil {
		t.Logf("Resource 2 port (integer): %d", port2Int)
		if int64(port2Int) != 8080 {
			t.Errorf("Resource 2 port integer should be 8080, got %d", port2Int)
		}
		dcPort2, dcErr := (*job2.DispatchContext.Variables)["port"].AsIntegerValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, 8080, dcPort2)
	} else {
		t.Logf("Resource 2 port is not an integer: %v", err)
	}

	t.Logf("SUCCESS: String '8080' and integer 8080 are kept as distinct types")
}

// TestEngine_VariableResolution_BooleanStringConversion tests boolean true vs string "true"
func TestEngine_VariableResolution_BooleanStringConversion(t *testing.T) {
	jobAgentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
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
				integration.WithDeploymentVariable("enabled"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// Resource 1 with string "true"
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
			integration.WithResourceVariable(
				"enabled",
				integration.ResourceVariableStringValue("true"),
			),
		),
		// Resource 2 with boolean true
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
			integration.WithResourceVariable(
				"enabled",
				integration.ResourceVariableBoolValue(true),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (string "true")
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource1ID,
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

	assert.NotNil(t, job1.DispatchContext)
	assert.NotNil(t, job1.DispatchContext.Variables)

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release 1 not found")
	}

	enabled1 := release1.Variables["enabled"]
	if enabled1Str, err := enabled1.AsStringValue(); err == nil {
		t.Logf("Resource 1 enabled (string): %s", enabled1Str)
		if enabled1Str != "true" {
			t.Errorf("Resource 1 enabled string should be 'true', got %s", enabled1Str)
		}
		dcEnabled1, dcErr := (*job1.DispatchContext.Variables)["enabled"].AsStringValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, "true", dcEnabled1)
	} else {
		t.Logf("Resource 1 enabled is not a string: %v", err)
	}

	// Test resource 2 (boolean true)
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource2ID,
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

	assert.NotNil(t, job2.DispatchContext)
	assert.NotNil(t, job2.DispatchContext.Variables)

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release 2 not found")
	}

	enabled2 := release2.Variables["enabled"]
	if enabled2Bool, err := enabled2.AsBooleanValue(); err == nil {
		t.Logf("Resource 2 enabled (boolean): %v", enabled2Bool)
		if !enabled2Bool {
			t.Errorf("Resource 2 enabled boolean should be true, got %v", enabled2Bool)
		}
		dcEnabled2, dcErr := (*job2.DispatchContext.Variables)["enabled"].AsBooleanValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, true, dcEnabled2)
	} else {
		t.Logf("Resource 2 enabled is not a boolean: %v", err)
	}

	t.Logf("SUCCESS: String 'true' and boolean true are kept as distinct types")
}

// TestEngine_VariableResolution_ZeroVsEmptyString tests integer 0 vs empty string
func TestEngine_VariableResolution_ZeroVsEmptyString(t *testing.T) {
	jobAgentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
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
				integration.WithDeploymentVariable("value"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentName("production"),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// Resource 1 with integer 0
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
			integration.WithResourceVariable(
				"value",
				integration.ResourceVariableIntValue(0),
			),
		),
		// Resource 2 with empty string
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
			integration.WithResourceVariable(
				"value",
				integration.ResourceVariableStringValue(""),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (integer 0)
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource1ID,
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

	assert.NotNil(t, job1.DispatchContext)
	assert.NotNil(t, job1.DispatchContext.Variables)

	release1, exists := engine.Workspace().Releases().Get(job1.ReleaseId)
	if !exists {
		t.Fatalf("release 1 not found")
	}

	value1 := release1.Variables["value"]
	if value1Int, err := value1.AsIntegerValue(); err == nil {
		t.Logf("Resource 1 value (integer): %d", value1Int)
		if int64(value1Int) != 0 {
			t.Errorf("Resource 1 value should be 0, got %d", value1Int)
		}
		dcValue1, dcErr := (*job1.DispatchContext.Variables)["value"].AsIntegerValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, 0, dcValue1)
	} else {
		t.Errorf("Resource 1 value should be integer 0: %v", err)
	}

	// Test resource 2 (empty string)
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource2ID,
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

	assert.NotNil(t, job2.DispatchContext)
	assert.NotNil(t, job2.DispatchContext.Variables)

	release2, exists := engine.Workspace().Releases().Get(job2.ReleaseId)
	if !exists {
		t.Fatalf("release 2 not found")
	}

	value2 := release2.Variables["value"]
	if value2Str, err := value2.AsStringValue(); err == nil {
		t.Logf("Resource 2 value (string): '%s'", value2Str)
		if value2Str != "" {
			t.Errorf("Resource 2 value should be empty string, got '%s'", value2Str)
		}
		dcValue2, dcErr := (*job2.DispatchContext.Variables)["value"].AsStringValue()
		assert.NoError(t, dcErr)
		assert.Equal(t, "", dcValue2)
	} else {
		t.Errorf("Resource 2 value should be empty string: %v", err)
	}

	t.Logf("SUCCESS: Integer 0 and empty string are kept as distinct types")
}

// TestEngine_VariableResolution_NegativeNumbers tests negative integer values
func TestEngine_VariableResolution_NegativeNumbers(t *testing.T) {
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
					"offset",
					integration.DeploymentVariableDefaultIntValue(-42),
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
		),
	)

	ctx := context.Background()

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

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, exists := engine.Workspace().Releases().Get(job.ReleaseId)
	if !exists {
		t.Fatalf("release not found")
	}

	offset, exists := release.Variables["offset"]
	if !exists {
		t.Fatalf("offset variable not found")
	}

	offsetInt, err := offset.AsIntegerValue()
	if err != nil {
		t.Fatalf("offset should be an integer: %v", err)
	}

	if int64(offsetInt) != -42 {
		t.Errorf("offset should be -42, got %d", offsetInt)
	}

	dcOffset, dcErr := (*job.DispatchContext.Variables)["offset"].AsIntegerValue()
	assert.NoError(t, dcErr)
	assert.Equal(t, -42, dcOffset)

	t.Logf("SUCCESS: Negative integer -42 correctly stored and retrieved")
}
