package secrets

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// Resolver glues the ProviderConfigStore (lookup + decrypt), the Registry
// (factory dispatch), the value cache (TTL'd resolved plaintexts), and the
// provider cache (TTL'd constructed Provider instances). One Resolver is
// constructed at startup and shared by all reconciliation goroutines.
type Resolver struct {
	store         ProviderConfigStore
	registry      *Registry
	cache         *Cache
	providerCache *ProviderCache
}

// NewResolver builds a Resolver. A nil cache or providerCache disables that
// layer of caching while leaving the rest of the lookup chain intact.
func NewResolver(
	store ProviderConfigStore,
	registry *Registry,
	cache *Cache,
	providerCache *ProviderCache,
) *Resolver {
	return &Resolver{
		store:         store,
		registry:      registry,
		cache:         cache,
		providerCache: providerCache,
	}
}

// Resolve fetches the secret value identified by ref. Lookups proceed:
//
//  1. value cache (if configured)
//  2. provider-instance cache (skips store + factory on hit)
//  3. ProviderConfigStore.Get to load + decrypt the provider config
//  4. Registry.Build to construct a Provider from the config
//  5. Provider.Resolve to hit the upstream secret store
//
// Any error in steps 3-5 propagates; release dispatch is expected to block.
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

	provider, providerType, err := r.lookupProvider(ctx, workspaceID, ref.Provider)
	if err != nil {
		return "", err
	}

	value, err := provider.Resolve(ctx, ref)
	if err != nil {
		return "", fmt.Errorf(
			"secrets: provider %q (%s) resolve: %w",
			ref.Provider,
			providerType,
			err,
		)
	}

	if r.cache != nil {
		r.cache.Set(workspaceID, ref, value)
	}
	return value, nil
}

// lookupProvider returns the Provider for the named secret_provider row in
// the workspace. The provider-instance cache is checked first; on a miss the
// config is loaded + decrypted via the store and constructed via the
// registry, then memoized.
func (r *Resolver) lookupProvider(
	ctx context.Context,
	workspaceID uuid.UUID,
	providerName string,
) (Provider, string, error) {
	if r.providerCache != nil {
		if p, ok := r.providerCache.Get(workspaceID, providerName); ok {
			return p, p.Type(), nil
		}
	}

	cfg, err := r.store.Get(ctx, workspaceID, providerName)
	if err != nil {
		return nil, "", err
	}

	provider, err := r.registry.Build(cfg)
	if err != nil {
		return nil, "", err
	}

	if r.providerCache != nil {
		r.providerCache.Set(workspaceID, providerName, provider)
	}
	return provider, cfg.Type, nil
}

// InvalidateProvider drops cached resolved values and the cached Provider
// instance for the named provider. Wire to the LISTEN/NOTIFY consumer on
// the `secret_provider_invalidate` channel so an api-side update flushes
// every workspace-engine pod.
func (r *Resolver) InvalidateProvider(workspaceID uuid.UUID, providerName string) {
	if r.cache != nil {
		r.cache.InvalidateProvider(workspaceID, providerName)
	}
	if r.providerCache != nil {
		r.providerCache.Invalidate(workspaceID, providerName)
	}
}
