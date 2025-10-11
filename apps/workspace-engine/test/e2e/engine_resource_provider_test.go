package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"
)

func TestEngine_ResourceProviderCreation(t *testing.T) {
	providerID := "provider-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("aws-provider"),
			integration.ProviderMetadata(map[string]string{
				"region": "us-east-1",
				"type":   "aws",
			}),
		),
	)

	// Verify the resource provider exists
	provider, exists := engine.Workspace().ResourceProviders().Get(providerID)
	if !exists {
		t.Fatalf("resource provider not found")
	}

	if provider.Name != "aws-provider" {
		t.Fatalf("provider name is %s, want aws-provider", provider.Name)
	}

	if provider.Metadata["region"] != "us-east-1" {
		t.Fatalf("provider metadata region is %s, want us-east-1", provider.Metadata["region"])
	}

	if provider.Metadata["type"] != "aws" {
		t.Fatalf("provider metadata type is %s, want aws", provider.Metadata["type"])
	}
}

func TestEngine_ResourceProviderUpdate(t *testing.T) {
	providerID := "provider-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("aws-provider"),
		),
	)

	// Verify initial state
	provider, exists := engine.Workspace().ResourceProviders().Get(providerID)
	if !exists {
		t.Fatalf("resource provider not found")
	}

	if provider.Name != "aws-provider" {
		t.Fatalf("initial provider name is %s, want aws-provider", provider.Name)
	}

	// Update the provider
	ctx := context.Background()
	updatedProvider := c.NewResourceProvider(engine.Workspace().ID)
	updatedProvider.Id = providerID
	updatedProvider.Name = "azure-provider"
	updatedProvider.Metadata = map[string]string{
		"region": "eastus",
		"type":   "azure",
	}
	engine.PushEvent(ctx, handler.ResourceProviderUpdate, updatedProvider)

	// Verify updated state
	provider, exists = engine.Workspace().ResourceProviders().Get(providerID)
	if !exists {
		t.Fatalf("resource provider not found after update")
	}

	if provider.Name != "azure-provider" {
		t.Fatalf("updated provider name is %s, want azure-provider", provider.Name)
	}

	if provider.Metadata["region"] != "eastus" {
		t.Fatalf("updated provider metadata region is %s, want eastus", provider.Metadata["region"])
	}
}

func TestEngine_ResourceProviderDelete(t *testing.T) {
	providerID := "provider-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("aws-provider"),
		),
	)

	// Verify the provider exists
	_, exists := engine.Workspace().ResourceProviders().Get(providerID)
	if !exists {
		t.Fatalf("resource provider not found")
	}

	// Delete the provider
	ctx := context.Background()
	providerToDelete := c.NewResourceProvider(engine.Workspace().ID)
	providerToDelete.Id = providerID
	engine.PushEvent(ctx, handler.ResourceProviderDelete, providerToDelete)

	// Verify the provider no longer exists
	_, exists = engine.Workspace().ResourceProviders().Get(providerID)
	if exists {
		t.Fatalf("resource provider should have been deleted")
	}
}

func TestEngine_ResourceProviderDelete_NullsResourceProviderID(t *testing.T) {
	providerID := "provider-1"
	resource1ID := "resource-1"
	resource2ID := "resource-2"
	resource3ID := "resource-3"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("aws-provider"),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("resource-with-provider"),
			integration.ResourceProviderID(providerID),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("resource-with-provider-2"),
			integration.ResourceProviderID(providerID),
		),
		integration.WithResource(
			integration.ResourceID(resource3ID),
			integration.ResourceName("resource-without-provider"),
		),
	)

	// Verify resources exist with correct provider ID
	resource1, exists := engine.Workspace().Resources().Get(resource1ID)
	if !exists {
		t.Fatalf("resource 1 not found")
	}
	if resource1.ProviderId == nil || *resource1.ProviderId != providerID {
		t.Fatalf("resource 1 provider ID is incorrect")
	}

	resource2, exists := engine.Workspace().Resources().Get(resource2ID)
	if !exists {
		t.Fatalf("resource 2 not found")
	}
	if resource2.ProviderId == nil || *resource2.ProviderId != providerID {
		t.Fatalf("resource 2 provider ID is incorrect")
	}

	resource3, exists := engine.Workspace().Resources().Get(resource3ID)
	if !exists {
		t.Fatalf("resource 3 not found")
	}
	if resource3.ProviderId != nil {
		t.Fatalf("resource 3 should not have a provider ID")
	}

	// Delete the provider
	ctx := context.Background()
	providerToDelete := c.NewResourceProvider(engine.Workspace().ID)
	providerToDelete.Id = providerID
	engine.PushEvent(ctx, handler.ResourceProviderDelete, providerToDelete)

	// Verify the provider no longer exists
	_, exists = engine.Workspace().ResourceProviders().Get(providerID)
	if exists {
		t.Fatalf("resource provider should have been deleted")
	}

	// Verify resources' provider IDs are now nil
	resource1, exists = engine.Workspace().Resources().Get(resource1ID)
	if !exists {
		t.Fatalf("resource 1 not found after provider delete")
	}
	if resource1.ProviderId != nil {
		t.Fatalf("resource 1 provider ID should be nil after provider delete, got %s", *resource1.ProviderId)
	}

	resource2, exists = engine.Workspace().Resources().Get(resource2ID)
	if !exists {
		t.Fatalf("resource 2 not found after provider delete")
	}
	if resource2.ProviderId != nil {
		t.Fatalf("resource 2 provider ID should be nil after provider delete, got %s", *resource2.ProviderId)
	}

	resource3, exists = engine.Workspace().Resources().Get(resource3ID)
	if !exists {
		t.Fatalf("resource 3 not found after provider delete")
	}
	if resource3.ProviderId != nil {
		t.Fatalf("resource 3 provider ID should still be nil after provider delete")
	}
}

func TestEngine_ResourceProviderItems(t *testing.T) {
	provider1ID := "provider-1"
	provider2ID := "provider-2"
	provider3ID := "provider-3"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(provider1ID),
			integration.ProviderName("aws-provider"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider2ID),
			integration.ProviderName("azure-provider"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider3ID),
			integration.ProviderName("gcp-provider"),
		),
	)

	// Get all providers
	providers := engine.Workspace().ResourceProviders().Items()

	if len(providers) != 3 {
		t.Fatalf("expected 3 resource providers, got %d", len(providers))
	}

	// Verify all providers exist
	if _, exists := providers[provider1ID]; !exists {
		t.Fatalf("provider 1 not found in items")
	}

	if _, exists := providers[provider2ID]; !exists {
		t.Fatalf("provider 2 not found in items")
	}

	if _, exists := providers[provider3ID]; !exists {
		t.Fatalf("provider 3 not found in items")
	}

	// Verify provider names
	if providers[provider1ID].Name != "aws-provider" {
		t.Fatalf("provider 1 name is %s, want aws-provider", providers[provider1ID].Name)
	}

	if providers[provider2ID].Name != "azure-provider" {
		t.Fatalf("provider 2 name is %s, want azure-provider", providers[provider2ID].Name)
	}

	if providers[provider3ID].Name != "gcp-provider" {
		t.Fatalf("provider 3 name is %s, want gcp-provider", providers[provider3ID].Name)
	}
}

func TestEngine_ResourceProviderMultipleDeletes(t *testing.T) {
	provider1ID := "provider-1"
	provider2ID := "provider-2"
	resource1ID := "resource-1"
	resource2ID := "resource-2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(provider1ID),
			integration.ProviderName("aws-provider"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider2ID),
			integration.ProviderName("azure-provider"),
		),
		integration.WithResource(
			integration.ResourceID(resource1ID),
			integration.ResourceName("resource-with-provider-1"),
			integration.ResourceProviderID(provider1ID),
		),
		integration.WithResource(
			integration.ResourceID(resource2ID),
			integration.ResourceName("resource-with-provider-2"),
			integration.ResourceProviderID(provider2ID),
		),
	)

	// Verify initial state
	providers := engine.Workspace().ResourceProviders().Items()
	if len(providers) != 2 {
		t.Fatalf("expected 2 resource providers initially, got %d", len(providers))
	}

	ctx := context.Background()

	// Delete provider 1
	provider1ToDelete := c.NewResourceProvider(engine.Workspace().ID)
	provider1ToDelete.Id = provider1ID
	engine.PushEvent(ctx, handler.ResourceProviderDelete, provider1ToDelete)

	// Verify provider 1 is deleted
	providers = engine.Workspace().ResourceProviders().Items()
	if len(providers) != 1 {
		t.Fatalf("expected 1 resource provider after first delete, got %d", len(providers))
	}

	// Verify resource 1 has no provider ID
	resource1, exists := engine.Workspace().Resources().Get(resource1ID)
	if !exists {
		t.Fatalf("resource 1 not found after provider 1 delete")
	}
	if resource1.ProviderId != nil {
		t.Fatalf("resource 1 provider ID should be nil after provider 1 delete")
	}

	// Verify resource 2 still has provider 2 ID
	resource2, exists := engine.Workspace().Resources().Get(resource2ID)
	if !exists {
		t.Fatalf("resource 2 not found after provider 1 delete")
	}
	if resource2.ProviderId == nil || *resource2.ProviderId != provider2ID {
		t.Fatalf("resource 2 should still have provider 2 ID")
	}

	// Delete provider 2
	provider2ToDelete := c.NewResourceProvider(engine.Workspace().ID)
	provider2ToDelete.Id = provider2ID
	engine.PushEvent(ctx, handler.ResourceProviderDelete, provider2ToDelete)

	// Verify all providers are deleted
	providers = engine.Workspace().ResourceProviders().Items()
	if len(providers) != 0 {
		t.Fatalf("expected 0 resource providers after all deletes, got %d", len(providers))
	}

	// Verify resource 2 now has no provider ID
	resource2, exists = engine.Workspace().Resources().Get(resource2ID)
	if !exists {
		t.Fatalf("resource 2 not found after provider 2 delete")
	}
	if resource2.ProviderId != nil {
		t.Fatalf("resource 2 provider ID should be nil after provider 2 delete")
	}
}
