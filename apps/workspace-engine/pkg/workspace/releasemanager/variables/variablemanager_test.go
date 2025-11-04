package variables

import (
	"context"
	"encoding/json"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

// Helper function to create a test store with a resource
func setupStoreWithResource(resourceID string, metadata map[string]string) *store.Store {
	cs := statechange.NewChangeSet[any]()
	st := store.New(cs)
	ctx := context.Background()

	resource := &oapi.Resource{
		Id:         resourceID,
		Name:       "test-resource",
		Kind:       "server",
		Identifier: resourceID,
		Config:     map[string]any{},
		Metadata:   metadata,
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}

	if _, err := st.Resources.Upsert(ctx, resource); err != nil {
		panic(err)
	}
	return st
}

// Helper function to create a test store with a deployment
func setupStoreWithDeployment(deploymentID string) *store.Store {
	cs := statechange.NewChangeSet[any]()
	st := store.New(cs)
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}

	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		panic(err)
	}
	return st
}

// Helper function to add a deployment variable to a store
func addDeploymentVariable(st *store.Store, deploymentID, key string, defaultValue *oapi.LiteralValue) string {
	ctx := context.Background()
	varID := uuid.New().String()

	dv := &oapi.DeploymentVariable{
		Id:           varID,
		Key:          key,
		DeploymentId: deploymentID,
		DefaultValue: defaultValue,
	}

	st.DeploymentVariables.Upsert(ctx, varID, dv)
	return varID
}

// Helper function to add a deployment variable value to a store
func addDeploymentVariableValue(st *store.Store, deploymentVariableID string, priority int64, selector *oapi.Selector, value *oapi.Value) {
	ctx := context.Background()
	valueID := uuid.New().String()

	dvv := &oapi.DeploymentVariableValue{
		Id:                   valueID,
		DeploymentVariableId: deploymentVariableID,
		Priority:             priority,
		ResourceSelector:     selector,
		Value:                *value,
	}

	st.DeploymentVariableValues.Upsert(ctx, valueID, dvv)
}

// Helper function to add a resource variable to a store
func addResourceVariable(st *store.Store, resourceID, key string, value *oapi.Value) {
	ctx := context.Background()

	rv := &oapi.ResourceVariable{
		ResourceId: resourceID,
		Key:        key,
		Value:      *value,
	}

	st.ResourceVariables.Upsert(ctx, rv)
}

// Helper function to create a CEL selector
func mustCreateSelector(celExpression string) *oapi.Selector {
	selector := &oapi.Selector{}
	if err := selector.FromCelSelector(oapi.CelSelector{Cel: celExpression}); err != nil {
		panic(err)
	}
	return selector
}

// Helper function to create a literal value from a Go value
func mustCreateLiteralValue(value interface{}) *oapi.LiteralValue {
	lv := &oapi.LiteralValue{}
	switch v := value.(type) {
	case string:
		if err := lv.FromStringValue(v); err != nil {
			panic(err)
		}
	case int:
		if err := lv.FromIntegerValue(v); err != nil {
			panic(err)
		}
	case int64:
		if err := lv.FromIntegerValue(int(v)); err != nil {
			panic(err)
		}
	case float32:
		if err := lv.FromNumberValue(v); err != nil {
			panic(err)
		}
	case float64:
		if err := lv.FromNumberValue(float32(v)); err != nil {
			panic(err)
		}
	case bool:
		if err := lv.FromBooleanValue(v); err != nil {
			panic(err)
		}
	case map[string]any:
		if err := lv.FromObjectValue(oapi.ObjectValue{Object: v}); err != nil {
			panic(err)
		}
	default:
		// Fallback to JSON marshal/unmarshal for other types
		data, err := json.Marshal(value)
		if err != nil {
			panic(err)
		}
		if err := json.Unmarshal(data, &lv); err != nil {
			panic(err)
		}
	}
	return lv
}

// Helper function to create a Value with a literal
func mustCreateValueFromLiteral(value interface{}) *oapi.Value {
	v := &oapi.Value{}
	lv := mustCreateLiteralValue(value)
	if err := v.FromLiteralValue(*lv); err != nil {
		panic(err)
	}
	return v
}

// Helper function to create a Value with a reference
func mustCreateValueFromReference(reference string, path []string) *oapi.Value {
	v := &oapi.Value{}
	rv := oapi.ReferenceValue{
		Reference: reference,
		Path:      path,
	}
	if err := v.FromReferenceValue(rv); err != nil {
		panic(err)
	}
	return v
}

// TestVariableManager_OnlyDeploymentKeysReturned tests that only variables
// defined in the deployment are returned, even if resource has more variables
func TestVariableManager_OnlyDeploymentKeysReturned(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	// Create store with both resource and deployment
	st := setupStoreWithResource(resourceID, map[string]string{})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Resource has variables a, b, c
	addResourceVariable(st, resourceID, "a", mustCreateValueFromLiteral("value-a"))
	addResourceVariable(st, resourceID, "b", mustCreateValueFromLiteral("value-b"))
	addResourceVariable(st, resourceID, "c", mustCreateValueFromLiteral("value-c"))

	// Deployment only defines variables a, b
	addDeploymentVariable(st, deploymentID, "a", nil)
	addDeploymentVariable(st, deploymentID, "b", nil)

	// Evaluate
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	// Should only contain a and b, not c
	if len(result) != 2 {
		t.Errorf("expected 2 variables, got %d", len(result))
	}

	if _, exists := result["a"]; !exists {
		t.Error("expected variable 'a' to exist")
	}

	if _, exists := result["b"]; !exists {
		t.Error("expected variable 'b' to exist")
	}

	if _, exists := result["c"]; exists {
		t.Error("expected variable 'c' to not exist (not defined in deployment)")
	}
}

// TestVariableManager_ResourceVariableTakesPrecedence tests that resource
// variables take precedence over deployment variables
func TestVariableManager_ResourceVariableTakesPrecedence(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Resource has replicas = 5
	addResourceVariable(st, resourceID, "replicas", mustCreateValueFromLiteral(5))

	// Deployment has replicas with value = 3
	varID := addDeploymentVariable(st, deploymentID, "replicas", nil)
	selector := mustCreateSelector("true") // matches all resources
	addDeploymentVariableValue(st, varID, 10, selector, mustCreateValueFromLiteral(3))

	// Evaluate
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	replicas, exists := result["replicas"]
	if !exists {
		t.Fatal("expected variable 'replicas' to exist")
	}

	// Should get resource value (5), not deployment value (3)
	replicasInt, err := replicas.AsIntegerValue()
	if err != nil {
		t.Fatalf("failed to get integer value: %v", err)
	}

	if int(replicasInt) != 5 {
		t.Errorf("expected replicas = 5 (resource value), got %d", replicasInt)
	}
}

// TestVariableManager_DeploymentVariablePriority tests that when multiple
// deployment variable values match, the one with highest priority wins
func TestVariableManager_DeploymentVariablePriority(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Deployment variable with multiple values
	varID := addDeploymentVariable(st, deploymentID, "env", nil)
	selector := mustCreateSelector("true") // both match

	// Add high priority value
	addDeploymentVariableValue(st, varID, 10, selector, mustCreateValueFromLiteral("high-priority"))
	// Add low priority value
	addDeploymentVariableValue(st, varID, 5, selector, mustCreateValueFromLiteral("low-priority"))

	// Evaluate
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	env, exists := result["env"]
	if !exists {
		t.Fatal("expected variable 'env' to exist")
	}

	envStr, err := env.AsStringValue()
	if err != nil {
		t.Fatalf("failed to get string value: %v", err)
	}

	if envStr != "high-priority" {
		t.Errorf("expected env = 'high-priority', got '%s'", envStr)
	}
}

// TestVariableManager_FallbackToDefault tests that when no deployment variable
// values match, the default value is used
func TestVariableManager_FallbackToDefault(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{"env": "dev"})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Deployment variable with selector that doesn't match and a default value
	defaultValue := mustCreateLiteralValue("default-value")
	varID := addDeploymentVariable(st, deploymentID, "config", defaultValue)

	// Selector only matches prod resources
	selector := mustCreateSelector("resource.metadata.env == 'prod'")
	addDeploymentVariableValue(st, varID, 10, selector, mustCreateValueFromLiteral("prod-config"))

	// Evaluate (resource has env=dev, so selector won't match)
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	config, exists := result["config"]
	if !exists {
		t.Fatal("expected variable 'config' to exist")
	}

	configStr, err := config.AsStringValue()
	if err != nil {
		t.Fatalf("failed to get string value: %v", err)
	}

	if configStr != "default-value" {
		t.Errorf("expected config = 'default-value', got '%s'", configStr)
	}
}

// TestVariableManager_NoDefaultNotIncluded tests that when no values match
// and there's no default, the variable is not included in the result
func TestVariableManager_NoDefaultNotIncluded(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{"env": "dev"})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Deployment variable with selector that doesn't match and NO default value
	varID := addDeploymentVariable(st, deploymentID, "config", nil)

	// Selector only matches prod resources
	selector := mustCreateSelector("resource.metadata.env == 'prod'")
	addDeploymentVariableValue(st, varID, 10, selector, mustCreateValueFromLiteral("prod-config"))

	// Evaluate (resource has env=dev, so selector won't match)
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	// Variable should not be in result
	if _, exists := result["config"]; exists {
		t.Error("expected variable 'config' to not exist (no match and no default)")
	}
}

// TestVariableManager_SelectorFiltering tests that deployment variable values
// are correctly filtered by resource selectors
func TestVariableManager_SelectorFiltering(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{"region": "us-east-1"})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Deployment variable with region-specific values
	varID := addDeploymentVariable(st, deploymentID, "endpoint", nil)

	// East coast value
	eastSelector := mustCreateSelector("resource.metadata.region == 'us-east-1'")
	addDeploymentVariableValue(st, varID, 10, eastSelector, mustCreateValueFromLiteral("east.example.com"))

	// West coast value
	westSelector := mustCreateSelector("resource.metadata.region == 'us-west-1'")
	addDeploymentVariableValue(st, varID, 10, westSelector, mustCreateValueFromLiteral("west.example.com"))

	// Evaluate (resource has region=us-east-1)
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	endpoint, exists := result["endpoint"]
	if !exists {
		t.Fatal("expected variable 'endpoint' to exist")
	}

	endpointStr, err := endpoint.AsStringValue()
	if err != nil {
		t.Fatalf("failed to get string value: %v", err)
	}

	if endpointStr != "east.example.com" {
		t.Errorf("expected endpoint = 'east.example.com', got '%s'", endpointStr)
	}
}

// TestVariableManager_NoSelectorMatches tests that when all selectors fail
// to match, it falls back to default or excludes the variable
func TestVariableManager_NoSelectorMatches(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{"region": "eu-central-1"})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Deployment variable with default
	defaultValue := mustCreateLiteralValue("default.example.com")
	varID := addDeploymentVariable(st, deploymentID, "endpoint", defaultValue)

	// Only US selectors
	eastSelector := mustCreateSelector("resource.metadata.region == 'us-east-1'")
	addDeploymentVariableValue(st, varID, 10, eastSelector, mustCreateValueFromLiteral("east.example.com"))

	westSelector := mustCreateSelector("resource.metadata.region == 'us-west-1'")
	addDeploymentVariableValue(st, varID, 10, westSelector, mustCreateValueFromLiteral("west.example.com"))

	// Evaluate (resource has region=eu-central-1, no selector matches)
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	endpoint, exists := result["endpoint"]
	if !exists {
		t.Fatal("expected variable 'endpoint' to exist")
	}

	endpointStr, err := endpoint.AsStringValue()
	if err != nil {
		t.Fatalf("failed to get string value: %v", err)
	}

	if endpointStr != "default.example.com" {
		t.Errorf("expected endpoint = 'default.example.com', got '%s'", endpointStr)
	}
}

// TestVariableManager_ResourceNotFound tests that an error is returned
// when the resource doesn't exist
func TestVariableManager_ResourceNotFound(t *testing.T) {
	deploymentID := uuid.New().String()
	nonExistentResourceID := uuid.New().String()

	st := setupStoreWithDeployment(deploymentID)
	ctx := context.Background()

	// Evaluate with non-existent resource
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    nonExistentResourceID,
	}

	_, err := mgr.Evaluate(ctx, releaseTarget)
	if err == nil {
		t.Fatal("expected error for non-existent resource, got nil")
	}
}

// TestVariableManager_EmptyDeploymentVariables tests that evaluating
// a deployment with no variables returns an empty map
func TestVariableManager_EmptyDeploymentVariables(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// No deployment variables added

	// Evaluate
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	if len(result) != 0 {
		t.Errorf("expected empty result, got %d variables", len(result))
	}
}

// TestVariableManager_ComplexVariableTypes tests resolving complex
// object and array values
func TestVariableManager_ComplexVariableTypes(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Complex object value
	complexValue := map[string]any{
		"host":     "db.example.com",
		"port":     5432,
		"ssl":      true,
		"database": "production",
		"pool": map[string]any{
			"min": 5,
			"max": 20,
		},
	}

	// Add as resource variable
	addResourceVariable(st, resourceID, "db_config", mustCreateValueFromLiteral(complexValue))
	addDeploymentVariable(st, deploymentID, "db_config", nil)

	// Evaluate
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	dbConfig, exists := result["db_config"]
	if !exists {
		t.Fatal("expected variable 'db_config' to exist")
	}

	// Verify it's an object
	objValue, err := dbConfig.AsObjectValue()
	if err != nil {
		t.Fatalf("failed to get object value: %v", err)
	}

	// Check some fields
	if host, ok := objValue.Object["host"].(string); !ok || host != "db.example.com" {
		t.Errorf("expected host = 'db.example.com', got %v", objValue.Object["host"])
	}

	if port, ok := objValue.Object["port"].(float64); !ok || int(port) != 5432 {
		t.Errorf("expected port = 5432, got %v", objValue.Object["port"])
	}
}

// TestVariableManager_MixedPriorities tests a scenario with mixed
// resolution priorities (resource vars, deployment values, defaults)
func TestVariableManager_MixedPriorities(t *testing.T) {
	resourceID := uuid.New().String()
	deploymentID := uuid.New().String()

	st := setupStoreWithResource(resourceID, map[string]string{"tier": "premium"})
	ctx := context.Background()

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// var1: resolved from resource variable
	addResourceVariable(st, resourceID, "var1", mustCreateValueFromLiteral("from-resource"))
	varID1 := addDeploymentVariable(st, deploymentID, "var1", mustCreateLiteralValue("default1"))
	addDeploymentVariableValue(st, varID1, 10, mustCreateSelector("true"), mustCreateValueFromLiteral("from-deployment"))

	// var2: resolved from deployment variable value (no resource var)
	varID2 := addDeploymentVariable(st, deploymentID, "var2", mustCreateLiteralValue("default2"))
	premiumSelector := mustCreateSelector("resource.metadata.tier == 'premium'")
	addDeploymentVariableValue(st, varID2, 10, premiumSelector, mustCreateValueFromLiteral("from-deployment-value"))

	// var3: resolved from default (selector doesn't match)
	varID3 := addDeploymentVariable(st, deploymentID, "var3", mustCreateLiteralValue("default3"))
	basicSelector := mustCreateSelector("resource.metadata.tier == 'basic'")
	addDeploymentVariableValue(st, varID3, 10, basicSelector, mustCreateValueFromLiteral("from-deployment-value-basic"))

	// var4: not included (no match, no default)
	varID4 := addDeploymentVariable(st, deploymentID, "var4", nil)
	addDeploymentVariableValue(st, varID4, 10, basicSelector, mustCreateValueFromLiteral("basic-only"))

	// Evaluate
	mgr := New(st)
	releaseTarget := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resourceID,
	}

	result, err := mgr.Evaluate(ctx, releaseTarget)
	if err != nil {
		t.Fatalf("Evaluate failed: %v", err)
	}

	// Check var1 (resource variable)
	var1, exists := result["var1"]
	if !exists {
		t.Fatal("expected variable 'var1' to exist")
	}
	var1Str, _ := var1.AsStringValue()
	if var1Str != "from-resource" {
		t.Errorf("expected var1 = 'from-resource', got '%s'", var1Str)
	}

	// Check var2 (deployment value)
	var2, exists := result["var2"]
	if !exists {
		t.Fatal("expected variable 'var2' to exist")
	}
	var2Str, _ := var2.AsStringValue()
	if var2Str != "from-deployment-value" {
		t.Errorf("expected var2 = 'from-deployment-value', got '%s'", var2Str)
	}

	// Check var3 (default)
	var3, exists := result["var3"]
	if !exists {
		t.Fatal("expected variable 'var3' to exist")
	}
	var3Str, _ := var3.AsStringValue()
	if var3Str != "default3" {
		t.Errorf("expected var3 = 'default3', got '%s'", var3Str)
	}

	// Check var4 (not included)
	if _, exists := result["var4"]; exists {
		t.Error("expected variable 'var4' to not exist")
	}
}

// TestVariableManager_MultipleResources tests that different resources
// get different variable values based on their metadata
func TestVariableManager_MultipleResources(t *testing.T) {
	resource1ID := uuid.New().String()
	resource2ID := uuid.New().String()
	deploymentID := uuid.New().String()

	// Create store with first resource
	st := setupStoreWithResource(resource1ID, map[string]string{"env": "production"})
	ctx := context.Background()

	// Add second resource
	resource2 := &oapi.Resource{
		Id:         resource2ID,
		Name:       "test-resource-2",
		Kind:       "server",
		Identifier: resource2ID,
		Config:     map[string]any{},
		Metadata:   map[string]string{"env": "staging"},
		Version:    "v1",
		CreatedAt:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	}
	if _, err := st.Resources.Upsert(ctx, resource2); err != nil {
		t.Fatalf("failed to upsert resource2: %v", err)
	}

	deployment := &oapi.Deployment{
		Id:             deploymentID,
		Name:           "test-deployment",
		Slug:           "test-deployment",
		SystemId:       uuid.New().String(),
		JobAgentConfig: map[string]any{},
	}
	if err := st.Deployments.Upsert(ctx, deployment); err != nil {
		t.Fatalf("failed to upsert deployment: %v", err)
	}

	// Deployment variable with env-specific values
	varID := addDeploymentVariable(st, deploymentID, "replicas", mustCreateLiteralValue(1))

	prodSelector := mustCreateSelector("resource.metadata.env == 'production'")
	addDeploymentVariableValue(st, varID, 10, prodSelector, mustCreateValueFromLiteral(10))

	stagingSelector := mustCreateSelector("resource.metadata.env == 'staging'")
	addDeploymentVariableValue(st, varID, 10, stagingSelector, mustCreateValueFromLiteral(3))

	mgr := New(st)

	// Evaluate for resource1 (production)
	releaseTarget1 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resource1ID,
	}

	result1, err := mgr.Evaluate(ctx, releaseTarget1)
	if err != nil {
		t.Fatalf("Evaluate failed for resource1: %v", err)
	}

	replicas1 := result1["replicas"]
	replicas1Int, _ := replicas1.AsIntegerValue()
	if int(replicas1Int) != 10 {
		t.Errorf("expected replicas for production = 10, got %d", replicas1Int)
	}

	// Evaluate for resource2 (staging)
	releaseTarget2 := &oapi.ReleaseTarget{
		DeploymentId:  deploymentID,
		EnvironmentId: uuid.New().String(),
		ResourceId:    resource2ID,
	}

	result2, err := mgr.Evaluate(ctx, releaseTarget2)
	if err != nil {
		t.Fatalf("Evaluate failed for resource2: %v", err)
	}

	replicas2 := result2["replicas"]
	replicas2Int, _ := replicas2.AsIntegerValue()
	if int(replicas2Int) != 3 {
		t.Errorf("expected replicas for staging = 3, got %d", replicas2Int)
	}
}
