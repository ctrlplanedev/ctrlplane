package secrets

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace-engine/pkg/secrets")

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
//
// Observability: every call opens a "secrets.Resolve" span with non-sensitive
// reference metadata (provider/path/key — never the plaintext) and emits a
// structured slog record on each terminal outcome. Cache hits are recorded as
// span events so traces show which layer absorbed the call.
func (r *Resolver) Resolve(
	ctx context.Context,
	workspaceID uuid.UUID,
	ref SecretReference,
) (string, error) {
	ctx, span := tracer.Start(ctx, "secrets.Resolve")
	defer span.End()
	span.SetAttributes(
		attribute.String("workspace.id", workspaceID.String()),
		attribute.String("secret.provider", ref.Provider),
		attribute.String("secret.path", ref.Path),
		attribute.String("secret.key", ref.Key),
	)

	if ref.Provider == "" {
		err := fmt.Errorf("secrets: empty provider name in reference")
		r.recordFailure(ctx, span, workspaceID, ref, "", "validation", err)
		return "", err
	}
	// Per-provider Key semantics are validated by the Provider impl: awssm
	// treats an empty Key as "return the raw SecretString", while Doppler
	// and env require a non-empty Key.

	if r.cache != nil {
		if v, ok := r.cache.Get(workspaceID, ref); ok {
			span.AddEvent("value_cache.hit")
			span.SetAttributes(
				attribute.Bool("secret.value_cache_hit", true),
				attribute.Int("secret.value.length", len(v)),
			)
			slog.DebugContext(ctx, "secret resolved (value cache hit)",
				"workspace_id", workspaceID.String(),
				"provider", ref.Provider,
				"path", ref.Path,
				"key", ref.Key,
			)
			return v, nil
		}
	}

	provider, providerType, providerCacheHit, err := r.lookupProvider(
		ctx,
		workspaceID,
		ref.Provider,
	)
	if err != nil {
		r.recordFailure(ctx, span, workspaceID, ref, "", "provider_lookup", err)
		return "", err
	}
	span.SetAttributes(
		attribute.String("secret.provider_type", providerType),
		attribute.Bool("secret.provider_cache_hit", providerCacheHit),
	)
	if providerCacheHit {
		span.AddEvent("provider_cache.hit")
	}

	value, err := provider.Resolve(ctx, ref)
	if err != nil {
		wrapped := fmt.Errorf(
			"secrets: provider %q (%s) resolve: %w",
			ref.Provider,
			providerType,
			err,
		)
		r.recordFailure(ctx, span, workspaceID, ref, providerType, "upstream", wrapped)
		return "", wrapped
	}

	if r.cache != nil {
		r.cache.Set(workspaceID, ref, value)
	}

	span.SetAttributes(attribute.Int("secret.value.length", len(value)))
	span.SetStatus(codes.Ok, "")
	slog.InfoContext(ctx, "secret resolved",
		"workspace_id", workspaceID.String(),
		"provider", ref.Provider,
		"provider_type", providerType,
		"path", ref.Path,
		"key", ref.Key,
		"provider_cache_hit", providerCacheHit,
		"value_length", len(value),
	)
	return value, nil
}

// recordFailure attaches the error to the span and emits a structured
// warning log. The plaintext is never recorded; only the reference metadata
// and a coarse error class.
func (r *Resolver) recordFailure(
	ctx context.Context,
	span trace.Span,
	workspaceID uuid.UUID,
	ref SecretReference,
	providerType string,
	errorClass string,
	err error,
) {
	span.RecordError(err)
	span.SetStatus(codes.Error, err.Error())
	span.SetAttributes(attribute.String("secret.error_class", errorClass))
	slog.WarnContext(ctx, "secret resolve failed",
		"workspace_id", workspaceID.String(),
		"provider", ref.Provider,
		"provider_type", providerType,
		"path", ref.Path,
		"key", ref.Key,
		"error_class", errorClass,
		"error", err.Error(),
	)
}

// lookupProvider returns the Provider for the named secret_provider row in
// the workspace. The provider-instance cache is checked first; on a miss the
// config is loaded + decrypted via the store and constructed via the
// registry, then memoized. The boolean indicates whether the result came
// from the cache.
func (r *Resolver) lookupProvider(
	ctx context.Context,
	workspaceID uuid.UUID,
	providerName string,
) (Provider, string, bool, error) {
	if r.providerCache != nil {
		if p, ok := r.providerCache.Get(workspaceID, providerName); ok {
			return p, p.Type(), true, nil
		}
	}

	cfg, err := r.store.Get(ctx, workspaceID, providerName)
	if err != nil {
		return nil, "", false, err
	}

	provider, err := r.registry.Build(cfg)
	if err != nil {
		return nil, "", false, err
	}

	if r.providerCache != nil {
		r.providerCache.Set(workspaceID, providerName, provider)
	}
	return provider, cfg.Type, false, nil
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
