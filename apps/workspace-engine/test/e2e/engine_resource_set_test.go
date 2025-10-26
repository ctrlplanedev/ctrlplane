package e2e

import (
	"context"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	integration "workspace-engine/test/integration"

	"github.com/stretchr/testify/require"
)

func TestEngine_ResourceProviderSetResources(t *testing.T) {
	providerID := "test-provider"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Test Provider"),
		),
	)

	// Create initial resources via SET
	resource1 := &oapi.Resource{
		Id:         "resource-1",
		Identifier: "res-1",
		Name:       "Resource 1",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	resource2 := &oapi.Resource{
		Id:         "resource-2",
		Identifier: "res-2",
		Name:       "Resource 2",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	// Initial SET with resources 1 and 2
	setResourcesPayload := map[string]interface{}{
		"providerId": providerID,
		"resources":  []*oapi.Resource{resource1, resource2},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResourcesPayload)

	// Verify both resources exist
	ws := engine.Workspace()
	r1, exists := ws.Resources().Get("resource-1")
	require.True(t, exists, "resource-1 should exist")
	require.NotNil(t, r1.ProviderId, "resource-1 should have a providerId")
	require.Equal(t, providerID, *r1.ProviderId, "resource-1 should have correct providerId")

	r2, exists := ws.Resources().Get("resource-2")
	require.True(t, exists, "resource-2 should exist")
	require.NotNil(t, r2.ProviderId, "resource-2 should have a providerId")
	require.Equal(t, providerID, *r2.ProviderId, "resource-2 should have correct providerId")

	// Now SET with only resource 2 and a new resource 3
	resource3 := &oapi.Resource{
		Id:         "resource-3",
		Identifier: "res-3",
		Name:       "Resource 3",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	setResourcesPayload2 := map[string]interface{}{
		"providerId": providerID,
		"resources":  []*oapi.Resource{resource2, resource3},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResourcesPayload2)

	// Verify resource 1 was deleted
	_, exists = ws.Resources().Get("resource-1")
	require.False(t, exists, "resource-1 should have been deleted")

	// Verify resource 2 still exists
	_, exists = ws.Resources().Get("resource-2")
	require.True(t, exists, "resource-2 should still exist")

	// Verify resource 3 was created
	r3, exists := ws.Resources().Get("resource-3")
	require.True(t, exists, "resource-3 should exist")
	require.NotNil(t, r3.ProviderId, "resource-3 should have a providerId")
	require.Equal(t, providerID, *r3.ProviderId, "resource-3 should have correct providerId")
}

func TestEngine_ResourceProviderSetResources_OnlyDeletesProviderResources(t *testing.T) {
	provider1ID := "provider-1"
	provider2ID := "provider-2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(provider1ID),
			integration.ProviderName("Provider 1"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider2ID),
			integration.ProviderName("Provider 2"),
		),
	)

	// Create resources for both providers
	provider1Resource := &oapi.Resource{
		Id:         "p1-resource-1",
		Identifier: "p1-res-1",
		Name:       "Provider 1 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	provider2Resource := &oapi.Resource{
		Id:         "p2-resource-1",
		Identifier: "p2-res-1",
		Name:       "Provider 2 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	setResources1 := map[string]interface{}{
		"providerId": provider1ID,
		"resources":  []*oapi.Resource{provider1Resource},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResources1)

	setResources2 := map[string]interface{}{
		"providerId": provider2ID,
		"resources":  []*oapi.Resource{provider2Resource},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResources2)

	// Verify both exist
	ws := engine.Workspace()
	_, exists := ws.Resources().Get("p1-resource-1")
	require.True(t, exists, "p1-resource-1 should exist")
	
	_, exists = ws.Resources().Get("p2-resource-1")
	require.True(t, exists, "p2-resource-1 should exist")

	// SET provider1 with empty list
	setResources3 := map[string]interface{}{
		"providerId": provider1ID,
		"resources":  []*oapi.Resource{},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResources3)

	// Verify provider1's resource was deleted
	_, exists = ws.Resources().Get("p1-resource-1")
	require.False(t, exists, "p1-resource-1 should have been deleted")

	// Verify provider2's resource still exists (not affected)
	_, exists = ws.Resources().Get("p2-resource-1")
	require.True(t, exists, "p2-resource-1 should still exist")
}

func TestEngine_ResourceProviderSetResources_CannotStealFromOtherProvider(t *testing.T) {
	provider1ID := "provider-1"
	provider2ID := "provider-2"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(provider1ID),
			integration.ProviderName("Provider 1"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider2ID),
			integration.ProviderName("Provider 2"),
		),
	)

	// Provider 1 creates a resource with identifier "shared-resource"
	provider1Resource := &oapi.Resource{
		Id:         "p1-res-1",
		Identifier: "shared-resource",
		Name:       "Provider 1 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	setResources1 := map[string]interface{}{
		"providerId": provider1ID,
		"resources":  []*oapi.Resource{provider1Resource},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResources1)

	ws := engine.Workspace()
	res, exists := ws.Resources().Get("p1-res-1")
	require.True(t, exists, "p1-res-1 should exist")
	require.NotNil(t, res.ProviderId, "resource should have a providerId")
	require.Equal(t, provider1ID, *res.ProviderId, "resource should belong to provider1")

	// Provider 2 tries to create a resource with the same identifier
	// This should be ignored because the resource already belongs to provider1
	provider2Resource := &oapi.Resource{
		Id:         "p2-res-1", // Different ID
		Identifier: "shared-resource", // Same identifier
		Name:       "Provider 2 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	setResources2 := map[string]interface{}{
		"providerId": provider2ID,
		"resources":  []*oapi.Resource{provider2Resource},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResources2)

	// Verify the original resource still belongs to provider1
	res, exists = ws.Resources().Get("p1-res-1")
	require.True(t, exists, "p1-res-1 should still exist")
	require.NotNil(t, res.ProviderId, "resource should have a providerId")
	require.Equal(t, provider1ID, *res.ProviderId, "resource should still belong to provider1")
	require.Equal(t, "Provider 1 Resource", res.Name, "resource name should not have changed")

	// Verify provider2's resource was NOT created
	_, exists = ws.Resources().Get("p2-res-1")
	require.False(t, exists, "p2-res-1 should not exist (provider 2 cannot steal from provider 1)")
}

func TestEngine_ResourceProviderSetResources_CanClaimUnownedResources(t *testing.T) {
	providerID := "provider-1"

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Provider 1"),
		),
		integration.WithResource(
			integration.ResourceID("unowned-res"),
			integration.ResourceIdentifier("unowned-resource"),
			integration.ResourceName("Unowned Resource"),
		),
	)

	ws := engine.Workspace()
	
	// Verify the resource exists but has no provider
	unownedRes, exists := ws.Resources().Get("unowned-res")
	require.True(t, exists, "unowned-res should exist")
	require.Nil(t, unownedRes.ProviderId, "resource should have no provider")

	// Provider claims the resource by using the same identifier in SET
	claimedResource := &oapi.Resource{
		Id:         "claimed-res", // Different ID initially
		Identifier: "unowned-resource", // Same identifier
		Name:       "Now Owned Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	setResources := map[string]interface{}{
		"providerId": providerID,
		"resources":  []*oapi.Resource{claimedResource},
	}
	engine.PushEvent(context.Background(), handler.ResourceProviderSetResources, setResources)

	// Verify the original resource is now owned by the provider
	claimedRes, exists := ws.Resources().Get("unowned-res")
	require.True(t, exists, "unowned-res should still exist (with same ID)")
	require.NotNil(t, claimedRes.ProviderId, "resource should now have a providerId")
	require.Equal(t, providerID, *claimedRes.ProviderId, "resource should now belong to provider")
	require.Equal(t, "Now Owned Resource", claimedRes.Name, "resource name should be updated")
}

