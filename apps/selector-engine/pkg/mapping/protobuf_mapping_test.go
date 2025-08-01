package mapping

import (
	"testing"
	"time"

	pb "github.com/ctrlplanedev/selector-engine/pkg/pb/proto"
	"google.golang.org/protobuf/types/known/timestamppb"
)

func TestResourceMappings(t *testing.T) {
	now := time.Now()

	// Test protobuf Resource
	protoResource := &pb.Resource{
		Id:          "test-id",
		WorkspaceId: "workspace-1",
		Identifier:  "test-identifier",
		Name:        "Test Resource",
		Kind:        "test-kind",
		Version:     "1.0.0",
		CreatedAt:   timestamppb.New(now),
		LastSync:    timestamppb.New(now),
		Metadata: map[string]string{
			"key1": "value1",
			"key2": "value2",
		},
	}

	t.Run("FromProtoResource", func(t *testing.T) {
		mod := FromProtoResource(protoResource)
		if mod.ID != protoResource.GetId() {
			t.Errorf("Expected ID %s, got %s", protoResource.GetId(), mod.ID)
		}
		if mod.Name != protoResource.GetName() {
			t.Errorf("Expected Name %s, got %s", protoResource.GetName(), mod.Name)
		}
		if len(mod.Metadata) != len(protoResource.GetMetadata()) {
			t.Errorf("Expected metadata length %d, got %d", len(protoResource.GetMetadata()), len(mod.Metadata))
		}
	})

	t.Run("ToProtoResource", func(t *testing.T) {
		mod := FromProtoResource(protoResource)
		backToProto := ToProtoResource(mod)
		if backToProto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if backToProto.GetId() != protoResource.GetId() {
			t.Errorf("Expected ID %s, got %s", protoResource.GetId(), backToProto.GetId())
		}
		if backToProto.GetName() != protoResource.GetName() {
			t.Errorf("Expected Name %s, got %s", protoResource.GetName(), backToProto.GetName())
		}
	})

}

func TestResourceSelectorMappings(t *testing.T) {
	protoSelector := &pb.ResourceSelector{
		Id:          "selector-1",
		WorkspaceId: "workspace-1",
		EntityType:  "deployment",
		Condition:   nil, // No selector for simplicity
	}

	t.Run("FromProtoResourceSelector", func(t *testing.T) {
		mod, err := FromProtoResourceSelector(protoSelector)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if mod.ID != protoSelector.GetId() {
			t.Errorf("Expected ID %s, got %s", protoSelector.GetId(), mod.ID)
		}
		if string(mod.EntityType) != protoSelector.GetEntityType() {
			t.Errorf("Expected EntityType %s, got %s", protoSelector.GetEntityType(), mod.EntityType)
		}
	})

}

func TestMatchMappings(t *testing.T) {
	protoMatch := &pb.Match{
		Error:      false,
		Message:    "Test match",
		SelectorId: "selector-1",
		ResourceId: "resource-1",
		Resource: &pb.Resource{
			Id:   "resource-1",
			Name: "Test Resource",
		},
		Selector: &pb.ResourceSelector{
			Id:         "selector-1",
			EntityType: "deployment",
		},
	}

	t.Run("FromProtoMatch", func(t *testing.T) {
		mod, err := FromProtoMatch(protoMatch)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		if mod.Error != protoMatch.GetError() {
			t.Errorf("Expected Error %v, got %v", protoMatch.GetError(), mod.Error)
		}
		if mod.Message != protoMatch.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoMatch.GetMessage(), mod.Message)
		}
		if mod.Resource == nil {
			t.Error("Expected non-nil Resource")
		}
		if mod.Selector == nil {
			t.Error("Expected non-nil Selector")
		}
	})

	t.Run("ToProtoMatch", func(t *testing.T) {
		mod, err := FromProtoMatch(protoMatch)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}
		backToProto := ToProtoMatch(mod)
		if backToProto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if backToProto.GetError() != protoMatch.GetError() {
			t.Errorf("Expected Error %v, got %v", protoMatch.GetError(), backToProto.GetError())
		}
		if backToProto.GetMessage() != protoMatch.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoMatch.GetMessage(), backToProto.GetMessage())
		}
	})
}

func TestStatusMappings(t *testing.T) {
	protoStatus := &pb.Status{
		Error:   false,
		Message: "Operation successful",
	}

	t.Run("FromProtoStatus", func(t *testing.T) {
		mod := FromProtoStatus(protoStatus)
		if mod.Error != protoStatus.GetError() {
			t.Errorf("Expected Error %v, got %v", protoStatus.GetError(), mod.Error)
		}
		if mod.Message != protoStatus.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoStatus.GetMessage(), mod.Message)
		}
	})

	t.Run("ToProtoStatus", func(t *testing.T) {
		mod := FromProtoStatus(protoStatus)
		backToProto := ToProtoStatus(mod)
		if backToProto == nil {
			t.Fatal("Expected non-nil proto")
		}
		if backToProto.GetError() != protoStatus.GetError() {
			t.Errorf("Expected Error %v, got %v", protoStatus.GetError(), backToProto.GetError())
		}
		if backToProto.GetMessage() != protoStatus.GetMessage() {
			t.Errorf("Expected Message %s, got %s", protoStatus.GetMessage(), backToProto.GetMessage())
		}
	})
}

func TestResourceRefMappings(t *testing.T) {
	protoRef := &pb.ResourceRef{
		Id: "resource-ref-1",
	}

	t.Run("FromProtoResourceRef", func(t *testing.T) {
		mod := FromProtoResourceRef(protoRef)
		if mod.ID != protoRef.GetId() {
			t.Errorf("Expected %s, got %s", protoRef.GetId(), mod.ID)
		}
		if mod.WorkspaceID != protoRef.GetWorkspaceId() {
			t.Errorf("Expected %s, got %s", protoRef.GetWorkspaceId(), mod.WorkspaceID)
		}
	})
}

func TestResourceSelectorRefMappings(t *testing.T) {
	protoRef := &pb.ResourceSelectorRef{
		Id: "selector-ref-1",
	}

	t.Run("FromProtoResourceSelectorRef", func(t *testing.T) {
		mod := FromProtoResourceSelectorRef(protoRef)
		if mod.ID != protoRef.GetId() {
			t.Errorf("Expected %s, got %s", protoRef.GetId(), mod.ID)
		}
		if mod.WorkspaceID != protoRef.GetWorkspaceId() {
			t.Errorf("Expected %s, got %s", protoRef.GetWorkspaceId(), mod.WorkspaceID)
		}
		if string(mod.EntityType) != protoRef.GetEntityType() {
			t.Errorf("Expected %s, got %s", protoRef.GetEntityType(), mod.EntityType)
		}
	})
}

func TestNilHandling(t *testing.T) {
	t.Run("Nil protobuf inputs", func(t *testing.T) {
		// FromProtoResource returns a zero value for nil input
		mod := FromProtoResource(nil)
		if mod.ID != "" || mod.Name != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoResourceSelector returns a zero value for nil input
		result, err := FromProtoResourceSelector(nil)
		if err != nil {
			t.Errorf("Unexpected error for nil input: %v", err)
		}
		if result.ID != "" || result.WorkspaceID != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoMatch returns a zero value for nil input
		resultMatch, errMatch := FromProtoMatch(nil)
		if errMatch != nil {
			t.Errorf("Unexpected error for nil input: %v", errMatch)
		}
		if resultMatch.Error || resultMatch.Message != "" {
			t.Error("Expected zero value for nil input")
		}
		// FromProtoStatus returns a zero value for nil input
		status := FromProtoStatus(nil)
		if status.Error || status.Message != "" {
			t.Error("Expected zero value for nil input")
		}
	})
}
