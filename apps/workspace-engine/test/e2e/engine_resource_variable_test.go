package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_ResourceVariableCreation(t *testing.T) {
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
		),
		integration.WithResourceVariable(
			resourceID,
			"env",
			integration.ResourceVariableStringValue("production"),
		),
		integration.WithResourceVariable(
			resourceID,
			"replicas",
			integration.ResourceVariableIntValue(3),
		),
		integration.WithResourceVariable(
			resourceID,
			"enabled",
			integration.ResourceVariableBoolValue(true),
		),
	)

	// Verify the resource exists
	resource, exists := engine.Workspace().Resources().Get(resourceID)
	if !exists {
		t.Fatalf("resource not found")
	}

	if resource.Name != "my-resource" {
		t.Fatalf("resource name is %s, want my-resource", resource.Name)
	}

	// Verify the resource variables were created
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 3 {
		t.Fatalf("resource variables count is %d, want 3", len(variables))
	}

	// Check env variable
	envVar, exists := variables["env"]
	if !exists {
		t.Fatalf("env variable not found")
	}

	if envVar.GetValue().GetLiteral().GetString_() != "production" {
		t.Fatalf("env variable value is %s, want production", envVar.GetValue().GetLiteral().GetString_())
	}

	// Check replicas variable
	replicasVar, exists := variables["replicas"]
	if !exists {
		t.Fatalf("replicas variable not found")
	}

	if replicasVar.GetValue().GetLiteral().GetInt64() != 3 {
		t.Fatalf("replicas variable value is %d, want 3", replicasVar.GetValue().GetLiteral().GetInt64())
	}

	// Check enabled variable
	enabledVar, exists := variables["enabled"]
	if !exists {
		t.Fatalf("enabled variable not found")
	}

	if !enabledVar.GetValue().GetLiteral().GetBool() {
		t.Fatalf("enabled variable value is %v, want true", enabledVar.GetValue().GetLiteral().GetBool())
	}
}

func TestEngine_ResourceVariableReferenceValue(t *testing.T) {
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
		),
		integration.WithResourceVariable(
			resourceID,
			"vpc_id",
			integration.ResourceVariableReferenceValue("vpc-relationship", []string{"id"}),
		),
	)

	// Verify the resource variable was created with reference
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 1 {
		t.Fatalf("resource variables count is %d, want 1", len(variables))
	}

	vpcVar, exists := variables["vpc_id"]
	if !exists {
		t.Fatalf("vpc_id variable not found")
	}

	refValue := vpcVar.GetValue().GetReference()
	if refValue == nil {
		t.Fatalf("reference value is nil")
	}

	if refValue.Reference != "vpc-relationship" {
		t.Fatalf("reference value is %s, want vpc-relationship", refValue.Reference)
	}

	if len(refValue.Path) != 1 || refValue.Path[0] != "id" {
		t.Fatalf("reference path is %v, want [id]", refValue.Path)
	}
}

func TestEngine_ResourceVariableUpdate(t *testing.T) {
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
		),
		integration.WithResourceVariable(
			resourceID,
			"env",
			integration.ResourceVariableStringValue("staging"),
		),
	)

	// Verify initial value
	variables := engine.Workspace().Resources().Variables(resourceID)
	envVar := variables["env"]

	if envVar.GetValue().GetLiteral().GetString_() != "staging" {
		t.Fatalf("initial env value is %s, want staging", envVar.GetValue().GetLiteral().GetString_())
	}

	// Update the variable
	ctx := context.Background()
	updatedVar := c.NewResourceVariable(resourceID, "env")
	updatedVar.Value = c.NewValueFromString("production")
	engine.PushEvent(ctx, handler.ResourceVariableUpdate, updatedVar)

	// Verify updated value
	variables = engine.Workspace().Resources().Variables(resourceID)
	envVar = variables["env"]

	if envVar.GetValue().GetLiteral().GetString_() != "production" {
		t.Fatalf("updated env value is %s, want production", envVar.GetValue().GetLiteral().GetString_())
	}
}

func TestEngine_ResourceVariableDelete(t *testing.T) {
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
		),
		integration.WithResourceVariable(
			resourceID,
			"env",
			integration.ResourceVariableStringValue("production"),
		),
		integration.WithResourceVariable(
			resourceID,
			"replicas",
			integration.ResourceVariableIntValue(3),
		),
	)

	// Verify both variables exist
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 2 {
		t.Fatalf("resource variables count is %d, want 2", len(variables))
	}

	// Delete one variable
	ctx := context.Background()
	varToDelete := c.NewResourceVariable(resourceID, "env")
	engine.PushEvent(ctx, handler.ResourceVariableDelete, varToDelete)

	// Verify only one variable remains
	variables = engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 1 {
		t.Fatalf("resource variables count after delete is %d, want 1", len(variables))
	}

	// Verify the remaining variable is replicas
	_, envExists := variables["env"]
	if envExists {
		t.Fatalf("env variable should have been deleted")
	}

	_, replicasExists := variables["replicas"]
	if !replicasExists {
		t.Fatalf("replicas variable should still exist")
	}
}

func TestEngine_ResourceVariableLiteralValue(t *testing.T) {
	resourceID := "resource-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResource(
			integration.ResourceID(resourceID),
			integration.ResourceName("my-resource"),
		),
		integration.WithResourceVariable(
			resourceID,
			"config",
			integration.ResourceVariableLiteralValue(map[string]any{
				"nested": map[string]any{
					"key": "value",
				},
				"number": 42,
			}),
		),
	)

	// Verify the resource variable was created with object value
	variables := engine.Workspace().Resources().Variables(resourceID)

	if len(variables) != 1 {
		t.Fatalf("resource variables count is %d, want 1", len(variables))
	}

	configVar, exists := variables["config"]
	if !exists {
		t.Fatalf("config variable not found")
	}

	objValue := configVar.GetValue().GetLiteral().GetObject()
	if objValue == nil {
		t.Fatalf("object value is nil")
	}

	nestedField := objValue.Fields["nested"]
	if nestedField == nil {
		t.Fatalf("nested field not found")
	}
}

