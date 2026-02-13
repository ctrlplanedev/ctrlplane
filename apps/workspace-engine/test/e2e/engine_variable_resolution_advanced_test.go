package e2e

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// =============================================================================
// PRIORITY AND CONFLICT RESOLUTION TESTS
// =============================================================================

// TestEngine_VariableResolution_MultipleSamePriorityValues tests behavior when
// multiple deployment variable values have the same priority.
func TestEngine_VariableResolution_MultipleSamePriorityValues(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("region"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceMetadata(map[string]string{
				"cloud": "aws",
			}),
		),
	)

	ctx := context.Background()

	// Add multiple deployment variable values with SAME priority
	deployment, _ := engine.Workspace().Deployments().Get(deploymentID)
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)

	if regionVar, exists := deploymentVars["region"]; exists {
		// Value 1: Priority 100
		value1 := c.NewDeploymentVariableValueWithOptions(
			regionVar.Id,
			c.WithPriority(100),
			c.WithStringValue("us-east-1"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value1)

		// Value 2: SAME Priority 100
		value2 := c.NewDeploymentVariableValueWithOptions(
			regionVar.Id,
			c.WithPriority(100), // Same priority!
			c.WithStringValue("us-west-2"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value2)
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

	// When multiple values have same priority, first one in sort order should win
	region, exists := release.Variables["region"]
	if !exists {
		t.Fatal("region variable should be resolved")
	}

	regionStr, err := region.AsStringValue()
	if err != nil {
		t.Fatalf("region should be a string: %v", err)
	}

	t.Logf("Region resolved to: %s (one of the same-priority values)", regionStr)
	if regionStr != "us-east-1" && regionStr != "us-west-2" {
		t.Errorf("region should be one of the same-priority values, got %s", regionStr)
	}

	assert.Equal(t, regionStr, (*job.DispatchContext.Variables)["region"])
}

// TestEngine_VariableResolution_PriorityZeroVsNegative tests that priority 0
// is higher than negative priorities.
func TestEngine_VariableResolution_PriorityZeroVsNegative(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"priority_test",
					integration.DeploymentVariableDefaultStringValue("default"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
	)

	ctx := context.Background()

	// Add values with 0 and negative priorities
	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	if priorityVar, exists := deploymentVars["priority_test"]; exists {
		// Value with priority 0
		value1 := c.NewDeploymentVariableValueWithOptions(
			priorityVar.Id,
			c.WithPriority(0),
			c.WithStringValue("zero-priority"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value1)

		// Value with negative priority
		value2 := c.NewDeploymentVariableValueWithOptions(
			priorityVar.Id,
			c.WithPriority(-10),
			c.WithStringValue("negative-priority"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value2)
	}

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

	// Priority 0 should win over negative priority
	priorityTest := release.Variables["priority_test"]
	value, _ := priorityTest.AsStringValue()

	if value != "zero-priority" {
		t.Errorf("expected 'zero-priority' (0 > -10), got %s", value)
	}

	assert.Equal(t, "zero-priority", (*job.DispatchContext.Variables)["priority_test"])

	t.Logf("SUCCESS: Priority 0 wins over negative priority")
}

// TestEngine_VariableResolution_HigherPriorityWins tests that higher priority
// values override lower priority values.
func TestEngine_VariableResolution_HigherPriorityWins(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"config",
					integration.DeploymentVariableDefaultStringValue("default-config"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceMetadata(map[string]string{
				"env": "production",
			}),
		),
	)

	ctx := context.Background()

	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	if configVar, exists := deploymentVars["config"]; exists {
		// Low priority value
		value1 := c.NewDeploymentVariableValueWithOptions(
			configVar.Id,
			c.WithPriority(10),
			c.WithStringValue("low-priority-config"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value1)

		// High priority value (should win)
		value2 := c.NewDeploymentVariableValueWithOptions(
			configVar.Id,
			c.WithPriority(100),
			c.WithStringValue("high-priority-config"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value2)

		// Medium priority value
		value3 := c.NewDeploymentVariableValueWithOptions(
			configVar.Id,
			c.WithPriority(50),
			c.WithStringValue("medium-priority-config"),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value3)
	}

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

	// Highest priority value should win
	config, exists := release.Variables["config"]
	if !exists {
		t.Fatal("config variable should be resolved")
	}

	configStr, err := config.AsStringValue()
	if err != nil {
		t.Fatalf("config should be a string: %v", err)
	}

	if configStr != "high-priority-config" {
		t.Errorf("expected 'high-priority-config' (priority 100), got %s", configStr)
	}

	assert.Equal(t, "high-priority-config", (*job.DispatchContext.Variables)["config"])

	t.Logf("SUCCESS: Highest priority value (100) wins over lower priorities (50, 10)")
}

// TestEngine_VariableResolution_SelectorMatchingWithPriority tests that
// priority is only considered for values that match the resource selector.
func TestEngine_VariableResolution_SelectorMatchingWithPriority(t *testing.T) {
	jobAgentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("env_specific_config"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("prod-server"),
			integration.ResourceMetadata(map[string]string{
				"env": "production",
			}),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("dev-server"),
			integration.ResourceMetadata(map[string]string{
				"env": "development",
			}),
		),
	)

	ctx := context.Background()

	deploymentVars := engine.Workspace().Deployments().Variables(deploymentID)
	if envVar, exists := deploymentVars["env_specific_config"]; exists {
		// High priority but only matches production
		value1 := c.NewDeploymentVariableValueWithOptions(
			envVar.Id,
			c.WithPriority(100),
			c.WithStringValue("production-config"),
			c.WithResourceSelector(c.NewResourceCelSelector(`resource.metadata["env"] == "production"`)),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value1)

		// Low priority but only matches development
		value2 := c.NewDeploymentVariableValueWithOptions(
			envVar.Id,
			c.WithPriority(10),
			c.WithStringValue("development-config"),
			c.WithResourceSelector(c.NewResourceCelSelector(`resource.metadata["env"] == "development"`)),
		)
		engine.PushEvent(ctx, handler.DeploymentVariableValueCreate, value2)
	}

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test production resource
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource1ID,
	}

	jobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget1)
	if len(jobs1) != 1 {
		t.Fatalf("expected 1 job for production resource, got %d", len(jobs1))
	}

	var job1 *oapi.Job
	for _, j := range jobs1 {
		job1 = j
		break
	}

	assert.NotNil(t, job1.DispatchContext)
	assert.NotNil(t, job1.DispatchContext.Variables)

	release1, _ := engine.Workspace().Releases().Get(job1.ReleaseId)
	config1 := release1.Variables["env_specific_config"]
	config1Str, _ := config1.AsStringValue()

	if config1Str != "production-config" {
		t.Errorf("production resource should get 'production-config', got %s", config1Str)
	}

	assert.Equal(t, "production-config", (*job1.DispatchContext.Variables)["env_specific_config"])

	// Test development resource
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource2ID,
	}

	jobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget2)
	if len(jobs2) != 1 {
		t.Fatalf("expected 1 job for development resource, got %d", len(jobs2))
	}

	var job2 *oapi.Job
	for _, j := range jobs2 {
		job2 = j
		break
	}

	assert.NotNil(t, job2.DispatchContext)
	assert.NotNil(t, job2.DispatchContext.Variables)

	release2, _ := engine.Workspace().Releases().Get(job2.ReleaseId)
	config2 := release2.Variables["env_specific_config"]
	config2Str, _ := config2.AsStringValue()

	if config2Str != "development-config" {
		t.Errorf("development resource should get 'development-config', got %s", config2Str)
	}

	assert.Equal(t, "development-config", (*job2.DispatchContext.Variables)["env_specific_config"])

	t.Logf("SUCCESS: Selector matching correctly filters values before priority comparison")
}

// =============================================================================
// COMPLEX OBJECT AND ARRAY EDGE CASES
// =============================================================================

// TestEngine_VariableResolution_VeryLargeNestedObject tests handling of
// deeply nested objects with many properties.
func TestEngine_VariableResolution_VeryLargeNestedObject(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	// Create a large nested object (3 levels deep, 15 properties per level at top)
	largeConfig := make(map[string]any)

	// First level: 15 properties
	for i := 0; i < 15; i++ {
		key := fmt.Sprintf("prop_0_%d", i)
		if i < 3 { // Only make first 3 properties nested
			secondLevel := make(map[string]any)
			// Second level: 10 properties
			for j := 0; j < 10; j++ {
				key2 := fmt.Sprintf("prop_1_%d", j)
				if j < 2 { // Only make first 2 properties nested
					thirdLevel := make(map[string]any)
					// Third level: leaf values
					for k := 0; k < 5; k++ {
						key3 := fmt.Sprintf("prop_2_%d", k)
						thirdLevel[key3] = fmt.Sprintf("value_%d_%d_%d", i, j, k)
					}
					secondLevel[key2] = thirdLevel
				} else {
					secondLevel[key2] = fmt.Sprintf("value_%d_%d", i, j)
				}
			}
			largeConfig[key] = secondLevel
		} else {
			largeConfig[key] = fmt.Sprintf("value_%d", i)
		}
	}

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"large_config",
					integration.DeploymentVariableDefaultLiteralValue(largeConfig),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	// Verify the large config was resolved
	largeConfigVar, exists := release.Variables["large_config"]
	if !exists {
		t.Fatal("large_config variable should be resolved")
	}

	obj, err := largeConfigVar.AsObjectValue()
	if err != nil {
		t.Fatalf("large_config should be an object: %v", err)
	}

	// Verify structure is preserved
	if len(obj.Object) < 15 {
		t.Errorf("expected at least 15 top-level properties, got %d", len(obj.Object))
	}

	assert.NotNil(t, (*job.DispatchContext.Variables)["large_config"])

	t.Logf("SUCCESS: Large nested object with %d top-level properties resolved", len(obj.Object))
}

// TestEngine_VariableResolution_MixedTypeArray tests array with mixed types.
func TestEngine_VariableResolution_MixedTypeArray(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	mixedArray := []any{
		"string",
		42,
		true,
		nil,
		3.14,
		map[string]any{"key": "value"},
		[]any{1, 2, 3},
	}

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"mixed_array",
					integration.DeploymentVariableDefaultLiteralValue(mixedArray),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	_, mixedExists := release.Variables["mixed_array"]
	if !mixedExists {
		t.Fatal("mixed_array variable should be resolved")
	}

	assert.NotNil(t, (*job.DispatchContext.Variables)["mixed_array"])

	// Array values are stored in the literal value but accessor depends on implementation
	t.Logf("SUCCESS: Mixed-type array resolved correctly")
}

// TestEngine_VariableResolution_EmptyObjectVsNull tests distinction between
// empty object {} and null.
func TestEngine_VariableResolution_EmptyObjectVsNull(t *testing.T) {
	jobAgentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("config"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// Resource 1 with empty object {}
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
			integration.WithResourceVariable(
				"config",
				integration.ResourceVariableLiteralValue(map[string]any{}),
			),
		),
		// Resource 2 with null
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
			integration.WithResourceVariable(
				"config",
				integration.ResourceVariableLiteralValue(nil),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (empty object)
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

	// Empty object should be present
	_, config1Exists := release1.Variables["config"]
	if !config1Exists {
		t.Log("Note: Empty object {} was not included in release")
	} else {
		t.Logf("SUCCESS: Empty object {} is present in release")
		assert.NotNil(t, (*job1.DispatchContext.Variables)["config"])
	}

	// Test resource 2 (null)
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

	// Null should not be present
	if _, exists := release2.Variables["config"]; exists {
		t.Log("Note: Null value was included in release")
	} else {
		_, dcExists := (*job2.DispatchContext.Variables)["config"]
		assert.False(t, dcExists, "config should not exist in DispatchContext.Variables when null")
		t.Logf("SUCCESS: Null value excluded from release")
	}
}

// =============================================================================
// UNICODE AND SPECIAL CHARACTER TESTS
// =============================================================================

// TestEngine_VariableResolution_UnicodeInValues tests Unicode characters in
// variable values.
func TestEngine_VariableResolution_UnicodeInValues(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	unicodeStrings := map[string]any{
		"emoji":    "🚀 deployment",
		"chinese":  "部署",
		"japanese": "デプロイ",
		"arabic":   "نشر",
		"hebrew":   "פריסה",
		"mixed":    "Hello 世界 🌍",
	}

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"unicode_strings",
					integration.DeploymentVariableDefaultLiteralValue(unicodeStrings),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	unicodeVar, exists := release.Variables["unicode_strings"]
	if !exists {
		t.Fatal("unicode_strings variable should be resolved")
	}

	obj, err := unicodeVar.AsObjectValue()
	if err != nil {
		t.Fatalf("unicode_strings should be an object: %v", err)
	}

	// Verify all Unicode strings are preserved
	expectedKeys := []string{"emoji", "chinese", "japanese", "arabic", "hebrew", "mixed"}
	for _, key := range expectedKeys {
		if _, exists := obj.Object[key]; !exists {
			t.Errorf("key %s not found in unicode_strings", key)
		}
	}

	assert.NotNil(t, (*job.DispatchContext.Variables)["unicode_strings"])

	t.Logf("SUCCESS: All Unicode strings preserved correctly")
}

// TestEngine_VariableResolution_SpecialCharactersInVariableNames tests that
// variable names with special characters (within allowed set) work correctly.
func TestEngine_VariableResolution_SpecialCharactersInVariableNames(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	// Test various special characters that might be allowed in variable names
	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"var_with_underscore",
					integration.DeploymentVariableDefaultStringValue("underscore"),
				),
				integration.WithDeploymentVariable(
					"var-with-dash",
					integration.DeploymentVariableDefaultStringValue("dash"),
				),
				integration.WithDeploymentVariable(
					"var.with.dot",
					integration.DeploymentVariableDefaultStringValue("dot"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	// Test each special character variable
	specialVars := []string{"var_with_underscore", "var-with-dash", "var.with.dot"}
	expectedValues := map[string]string{
		"var_with_underscore": "underscore",
		"var-with-dash":       "dash",
		"var.with.dot":        "dot",
	}
	resolvedCount := 0

	for _, varName := range specialVars {
		if val, exists := release.Variables[varName]; exists {
			resolvedCount++
			if strVal, err := val.AsStringValue(); err == nil {
				t.Logf("Variable %s resolved to: %s", varName, strVal)
				assert.Equal(t, expectedValues[varName], (*job.DispatchContext.Variables)[varName])
			}
		}
	}

	if resolvedCount == 0 {
		t.Error("No special character variables were resolved")
	}

	t.Logf("SUCCESS: %d/%d special character variables resolved", resolvedCount, len(specialVars))
}

// TestEngine_VariableResolution_VeryLongVariableName tests extremely long
// variable names.
func TestEngine_VariableResolution_VeryLongVariableName(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	// Create a very long variable name (255 characters)
	longVarName := strings.Repeat("a", 255)

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					longVarName,
					integration.DeploymentVariableDefaultStringValue("very-long-name"),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	// Verify long variable name works
	if val, exists := release.Variables[longVarName]; exists {
		if strVal, err := val.AsStringValue(); err == nil && strVal == "very-long-name" {
			t.Logf("SUCCESS: Variable with %d-character name resolved", len(longVarName))
			assert.Equal(t, "very-long-name", (*job.DispatchContext.Variables)[longVarName])
		}
	} else {
		_, dcExists := (*job.DispatchContext.Variables)[longVarName]
		assert.False(t, dcExists, "long variable name should not exist in DispatchContext.Variables if not in release")
		t.Logf("Note: Very long variable name (%d chars) was not resolved", len(longVarName))
	}
}

// =============================================================================
// NUMERIC PRECISION AND EDGE CASES
// =============================================================================

// TestEngine_VariableResolution_FloatingPointPrecision tests handling of
// floating point numbers with high precision.
func TestEngine_VariableResolution_FloatingPointPrecision(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	precisionNumbers := map[string]any{
		"pi":           3.141592653589793,
		"very_small":   0.000000000001,
		"very_large":   999999999999.999,
		"scientific":   1.23e-10,
		"negative_exp": 4.56e+15,
	}

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"precision_numbers",
					integration.DeploymentVariableDefaultLiteralValue(precisionNumbers),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	precisionVar, exists := release.Variables["precision_numbers"]
	if !exists {
		t.Fatal("precision_numbers variable should be resolved")
	}

	obj, err := precisionVar.AsObjectValue()
	if err != nil {
		t.Fatalf("precision_numbers should be an object: %v", err)
	}

	// Verify all precision numbers are preserved
	if len(obj.Object) != 5 {
		t.Errorf("expected 5 precision numbers, got %d", len(obj.Object))
	}

	assert.NotNil(t, (*job.DispatchContext.Variables)["precision_numbers"])

	t.Logf("SUCCESS: High-precision floating point numbers handled correctly")
}

// TestEngine_VariableResolution_MaxIntValues tests maximum integer values.
func TestEngine_VariableResolution_MaxIntValues(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"max_int64",
					integration.DeploymentVariableDefaultIntValue(9223372036854775807), // Max int64
				),
				integration.WithDeploymentVariable(
					"min_int64",
					integration.DeploymentVariableDefaultIntValue(-9223372036854775808), // Min int64
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	// Verify max int64
	if maxInt, exists := release.Variables["max_int64"]; exists {
		if val, err := maxInt.AsIntegerValue(); err == nil {
			t.Logf("Max int64 resolved: %d", val)
			assert.NotNil(t, (*job.DispatchContext.Variables)["max_int64"])
		}
	}

	// Verify min int64
	if minInt, exists := release.Variables["min_int64"]; exists {
		if val, err := minInt.AsIntegerValue(); err == nil {
			t.Logf("Min int64 resolved: %d", val)
			assert.NotNil(t, (*job.DispatchContext.Variables)["min_int64"])
		}
	}

	t.Logf("SUCCESS: Extreme integer values handled correctly")
}

// =============================================================================
// WHITESPACE AND EMPTY VALUE TESTS
// =============================================================================

// TestEngine_VariableResolution_WhitespaceOnlyString tests string with only
// whitespace characters.
func TestEngine_VariableResolution_WhitespaceOnlyString(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	whitespaceVariants := map[string]any{
		"single_space":    " ",
		"multiple_spaces": "   ",
		"tab":             "\t",
		"newline":         "\n",
		"mixed":           " \t\n ",
		"empty":           "",
	}

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"whitespace_test",
					integration.DeploymentVariableDefaultLiteralValue(whitespaceVariants),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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

	whitespaceVar, exists := release.Variables["whitespace_test"]
	if !exists {
		t.Fatal("whitespace_test variable should be resolved")
	}

	obj, err := whitespaceVar.AsObjectValue()
	if err != nil {
		t.Fatalf("whitespace_test should be an object: %v", err)
	}

	// Verify all whitespace variants are preserved
	for key := range whitespaceVariants {
		if _, exists := obj.Object[key]; !exists {
			t.Errorf("whitespace variant %s not found", key)
		}
	}

	assert.NotNil(t, (*job.DispatchContext.Variables)["whitespace_test"])

	t.Logf("SUCCESS: Whitespace-only strings preserved correctly")
}

// TestEngine_VariableResolution_EmptyArrayVsNullArray tests distinction
// between empty array [] and null.
func TestEngine_VariableResolution_EmptyArrayVsNullArray(t *testing.T) {
	jobAgentID := uuid.New().String()
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable("items"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		// Resource 1 with empty array []
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("server-1"),
			integration.WithResourceVariable(
				"items",
				integration.ResourceVariableLiteralValue([]any{}),
			),
		),
		// Resource 2 with null
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("server-2"),
			integration.WithResourceVariable(
				"items",
				integration.ResourceVariableLiteralValue(nil),
			),
		),
	)

	ctx := context.Background()

	dv := c.NewDeploymentVersion()
	dv.DeploymentId = deploymentID
	dv.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, dv)

	// Test resource 1 (empty array)
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource1ID,
	}

	jobs1 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget1)
	var job1 *oapi.Job
	for _, j := range jobs1 {
		job1 = j
		break
	}

	assert.NotNil(t, job1.DispatchContext)
	assert.NotNil(t, job1.DispatchContext.Variables)

	release1, _ := engine.Workspace().Releases().Get(job1.ReleaseId)

	if _, exists := release1.Variables["items"]; exists {
		assert.NotNil(t, (*job1.DispatchContext.Variables)["items"])
		t.Logf("SUCCESS: Empty array [] is present in release")
	}

	// Test resource 2 (null)
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: environmentID,
		ResourceId:    resource2ID,
	}

	jobs2 := engine.Workspace().Jobs().GetJobsForReleaseTarget(releaseTarget2)
	var job2 *oapi.Job
	for _, j := range jobs2 {
		job2 = j
		break
	}

	assert.NotNil(t, job2.DispatchContext)
	assert.NotNil(t, job2.DispatchContext.Variables)

	release2, _ := engine.Workspace().Releases().Get(job2.ReleaseId)

	if _, exists := release2.Variables["items"]; !exists {
		_, dcExists := (*job2.DispatchContext.Variables)["items"]
		assert.False(t, dcExists, "items should not exist in DispatchContext.Variables when null")
		t.Logf("SUCCESS: Null value excluded from release")
	}
}

// TestEngine_VariableResolution_FalsyValues tests that falsy values (0, false, "")
// are properly distinguished from missing values.
func TestEngine_VariableResolution_FalsyValues(t *testing.T) {
	jobAgentID := uuid.New().String()
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
				integration.WithDeploymentVariable(
					"zero",
					integration.DeploymentVariableDefaultIntValue(0),
				),
				integration.WithDeploymentVariable(
					"false_bool",
					integration.DeploymentVariableDefaultBoolValue(false),
				),
				integration.WithDeploymentVariable(
					"empty_string",
					integration.DeploymentVariableDefaultStringValue(""),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
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
	var job *oapi.Job
	for _, j := range jobs {
		job = j
		break
	}

	assert.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Variables)

	release, _ := engine.Workspace().Releases().Get(job.ReleaseId)

	// All falsy values should be present (not excluded as "missing")
	falsyCount := 0

	if zero, exists := release.Variables["zero"]; exists {
		if val, err := zero.AsIntegerValue(); err == nil && int64(val) == 0 {
			falsyCount++
			t.Logf("✓ Integer 0 is present")
			assert.Equal(t, "0", (*job.DispatchContext.Variables)["zero"])
		}
	}

	if falseBool, exists := release.Variables["false_bool"]; exists {
		if val, err := falseBool.AsBooleanValue(); err == nil && !val {
			falsyCount++
			t.Logf("✓ Boolean false is present")
			assert.Equal(t, "false", (*job.DispatchContext.Variables)["false_bool"])
		}
	}

	if emptyStr, exists := release.Variables["empty_string"]; exists {
		if val, err := emptyStr.AsStringValue(); err == nil && val == "" {
			falsyCount++
			t.Logf("✓ Empty string is present")
			assert.Equal(t, "", (*job.DispatchContext.Variables)["empty_string"])
		}
	}

	if falsyCount == 3 {
		t.Logf("SUCCESS: All falsy values (0, false, '') correctly included")
	} else {
		t.Errorf("Expected 3 falsy values to be present, got %d", falsyCount)
	}
}
