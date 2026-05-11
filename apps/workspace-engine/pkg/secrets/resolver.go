package secrets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Resolver glues the ProviderConfigStore (lookup + decrypt), the Registry
// (factory dispatch), and the Cache (TTL'd resolved values). One Resolver is
// constructed at startup and shared by all reconciliation goroutines.
type Resolver struct {
	store    ProviderConfigStore
	registry *Registry
	cache    *Cache
}

// NewResolver builds a Resolver. A nil cache disables caching.
func NewResolver(store ProviderConfigStore, registry *Registry, cache *Cache) *Resolver {
	return &Resolver{store: store, registry: registry, cache: cache}
}

// Resolve fetches the secret value identified by ref. Lookups proceed:
//
//  1. cache (if configured)
//  2. ProviderConfigStore.Get to load + decrypt the provider config
//  3. Registry.Build to construct a Provider from the config
//  4. Provider.Resolve to hit the upstream secret store
//
// Any error in steps 2-4 propagates; release dispatch is expected to block.
func (r *Resolver) Resolve(
	ctx context.Context,
	workspaceID uuid.UUID,
	ref SecretReference,
) (string, error) {
	if ref.Provider == "" {
		return "", fmt.Errorf("secrets: empty provider name in reference")
	}
	if ref.Key == "" {
		return "", fmt.Errorf("secrets: empty key in reference")
	}

	if r.cache != nil {
		if v, ok := r.cache.Get(workspaceID, ref); ok {
			return v, nil
		}
	}

	cfg, err := r.store.Get(ctx, workspaceID, ref.Provider)
	if err != nil {
		return "", err
	}

	provider, err := r.registry.Build(cfg)
	if err != nil {
		return "", err
	}

	value, err := provider.Resolve(ctx, ref)
	if err != nil {
		return "", fmt.Errorf("secrets: provider %q (%s) resolve: %w", cfg.Name, cfg.Type, err)
	}

	if r.cache != nil {
		r.cache.Set(workspaceID, ref, value)
	}
	return value, nil
}

// InvalidateProvider drops cached entries for the named provider. Wire to the
// LISTEN/NOTIFY consumer on the `secret_provider_invalidate` channel.
func (r *Resolver) InvalidateProvider(workspaceID uuid.UUID, providerName string) {
	if r.cache != nil {
		r.cache.InvalidateProvider(workspaceID, providerName)
	}
}
