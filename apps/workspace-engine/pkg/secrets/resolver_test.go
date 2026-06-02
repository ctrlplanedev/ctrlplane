package secrets

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
)

type mockStore struct {
	configs    map[string]*ProviderConfig
	getErr     error
	getCalls   atomic.Int32
	lastLookup string
}

func (m *mockStore) Get(
	_ context.Context,
	_ uuid.UUID,
	providerName string,
) (*ProviderConfig, error) {
	m.getCalls.Add(1)
	m.lastLookup = providerName
	if m.getErr != nil {
		return nil, m.getErr
	}
	cfg, ok := m.configs[providerName]
	if !ok {
		return nil, errors.New("not found")
	}
	return cfg, nil
}

func (m *mockStore) List(
	_ context.Context,
	_ uuid.UUID,
) ([]*ProviderConfig, error) {
	out := make([]*ProviderConfig, 0, len(m.configs))
	for _, cfg := range m.configs {
		out = append(out, cfg)
	}
	return out, nil
}

type mockProvider struct {
	t           string
	resolveErr  error
	resolveVal  string
	resolveRefs []SecretReference
}

func (p *mockProvider) Type() string { return p.t }

func (p *mockProvider) Resolve(_ context.Context, ref SecretReference) (string, error) {
	p.resolveRefs = append(p.resolveRefs, ref)
	if p.resolveErr != nil {
		return "", p.resolveErr
	}
	return p.resolveVal, nil
}

func newResolver(t *testing.T, store ProviderConfigStore, provider Provider) *Resolver {
	t.Helper()
	reg := NewRegistry()
	reg.Register(
		provider.Type(),
		func(_ json.RawMessage) (Provider, error) { return provider, nil },
	)
	return NewResolver(store, reg, NewCache(time.Minute), NewProviderCache(time.Minute))
}

func TestResolverHappyPath(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"doppler-prod": {
				WorkspaceID: ws,
				Name:        "doppler-prod",
				Type:        "doppler",
				Config:      json.RawMessage(`{"serviceToken":"dp.st.test"}`),
			},
		},
	}
	provider := &mockProvider{t: "doppler", resolveVal: "abc123"}
	r := newResolver(t, store, provider)

	got, err := r.Resolve(context.Background(), ws, SecretReference{
		Provider: "doppler-prod",
		Path:     "backend/prod",
		Key:      "TOKEN",
	})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "abc123" {
		t.Fatalf("expected abc123, got %q", got)
	}
	if len(provider.resolveRefs) != 1 {
		t.Fatalf("provider.Resolve called %d times, want 1", len(provider.resolveRefs))
	}
}

func TestResolverCacheHitsSkipStore(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"doppler-prod": {
				WorkspaceID: ws,
				Name:        "doppler-prod",
				Type:        "doppler",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	provider := &mockProvider{t: "doppler", resolveVal: "abc123"}
	r := newResolver(t, store, provider)
	ref := SecretReference{Provider: "doppler-prod", Key: "TOKEN"}

	if _, err := r.Resolve(context.Background(), ws, ref); err != nil {
		t.Fatalf("first Resolve: %v", err)
	}
	if _, err := r.Resolve(context.Background(), ws, ref); err != nil {
		t.Fatalf("second Resolve: %v", err)
	}

	if got := store.getCalls.Load(); got != 1 {
		t.Fatalf("store.Get called %d times, want 1 (second should be cache hit)", got)
	}
	if got := len(provider.resolveRefs); got != 1 {
		t.Fatalf("provider.Resolve called %d times, want 1", got)
	}
}

func TestResolverInvalidationForcesRefetch(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"doppler-prod": {
				WorkspaceID: ws,
				Name:        "doppler-prod",
				Type:        "doppler",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	provider := &mockProvider{t: "doppler", resolveVal: "abc"}
	r := newResolver(t, store, provider)
	ref := SecretReference{Provider: "doppler-prod", Key: "TOKEN"}

	if _, err := r.Resolve(context.Background(), ws, ref); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	r.InvalidateProvider(ws, "doppler-prod")
	if _, err := r.Resolve(context.Background(), ws, ref); err != nil {
		t.Fatalf("Resolve: %v", err)
	}

	if got := store.getCalls.Load(); got != 2 {
		t.Fatalf("store.Get called %d times, want 2 after invalidation", got)
	}
}

func TestResolverProviderInstanceCachedAcrossRefs(t *testing.T) {
	// Two distinct SecretReferences sharing a provider should construct the
	// Provider once. With only the value cache (and no provider cache),
	// every distinct ref would re-decrypt and re-build.
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"aws-prod": {
				WorkspaceID: ws,
				Name:        "aws-prod",
				Type:        "aws_secrets_manager",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	provider := &mockProvider{t: "aws_secrets_manager", resolveVal: "x"}
	factoryCalls := 0
	reg := NewRegistry()
	reg.Register("aws_secrets_manager", func(_ json.RawMessage) (Provider, error) {
		factoryCalls++
		return provider, nil
	})
	r := NewResolver(store, reg, NewCache(time.Minute), NewProviderCache(time.Minute))

	refA := SecretReference{Provider: "aws-prod", Path: "prod/db", Key: "password"}
	refB := SecretReference{Provider: "aws-prod", Path: "prod/db", Key: "username"}
	if _, err := r.Resolve(context.Background(), ws, refA); err != nil {
		t.Fatalf("Resolve A: %v", err)
	}
	if _, err := r.Resolve(context.Background(), ws, refB); err != nil {
		t.Fatalf("Resolve B: %v", err)
	}

	if got := store.getCalls.Load(); got != 1 {
		t.Fatalf("store.Get called %d times, want 1 (second ref should reuse cached provider)", got)
	}
	if factoryCalls != 1 {
		t.Fatalf("factory called %d times, want 1", factoryCalls)
	}
	if got := len(provider.resolveRefs); got != 2 {
		t.Fatalf("provider.Resolve called %d times, want 2 (one per distinct value ref)", got)
	}
}

func TestResolverInvalidationDropsProviderInstance(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"aws-prod": {
				WorkspaceID: ws,
				Name:        "aws-prod",
				Type:        "aws_secrets_manager",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	provider := &mockProvider{t: "aws_secrets_manager", resolveVal: "x"}
	factoryCalls := 0
	reg := NewRegistry()
	reg.Register("aws_secrets_manager", func(_ json.RawMessage) (Provider, error) {
		factoryCalls++
		return provider, nil
	})
	r := NewResolver(store, reg, NewCache(time.Minute), NewProviderCache(time.Minute))

	ref := SecretReference{Provider: "aws-prod", Path: "prod/db", Key: "password"}
	if _, err := r.Resolve(context.Background(), ws, ref); err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	r.InvalidateProvider(ws, "aws-prod")
	if _, err := r.Resolve(context.Background(), ws, ref); err != nil {
		t.Fatalf("Resolve after invalidation: %v", err)
	}

	if got := store.getCalls.Load(); got != 2 {
		t.Fatalf(
			"store.Get called %d times, want 2 (invalidation forces re-decrypt)",
			got,
		)
	}
	if factoryCalls != 2 {
		t.Fatalf("factory called %d times, want 2 after invalidation", factoryCalls)
	}
}

func TestResolverProviderCacheDisabledWhenNil(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"aws-prod": {
				WorkspaceID: ws,
				Name:        "aws-prod",
				Type:        "aws_secrets_manager",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	provider := &mockProvider{t: "aws_secrets_manager", resolveVal: "x"}
	factoryCalls := 0
	reg := NewRegistry()
	reg.Register("aws_secrets_manager", func(_ json.RawMessage) (Provider, error) {
		factoryCalls++
		return provider, nil
	})
	// Disable both caches: every Resolve must hit store + factory.
	r := NewResolver(store, reg, nil, nil)

	refA := SecretReference{Provider: "aws-prod", Path: "prod/db", Key: "password"}
	refB := SecretReference{Provider: "aws-prod", Path: "prod/db", Key: "username"}
	if _, err := r.Resolve(context.Background(), ws, refA); err != nil {
		t.Fatalf("Resolve A: %v", err)
	}
	if _, err := r.Resolve(context.Background(), ws, refB); err != nil {
		t.Fatalf("Resolve B: %v", err)
	}

	if got := store.getCalls.Load(); got != 2 {
		t.Fatalf("store.Get called %d times, want 2 with caches off", got)
	}
	if factoryCalls != 2 {
		t.Fatalf("factory called %d times, want 2 with caches off", factoryCalls)
	}
}

func TestResolverRejectsEmptyProvider(t *testing.T) {
	// Empty Provider is always invalid — there's nothing to look up. Empty
	// Key is provider-specific (awssm treats it as "return raw") and is
	// validated inside the Provider impl, not at the Resolver level.
	store := &mockStore{}
	provider := &mockProvider{t: "doppler"}
	r := newResolver(t, store, provider)

	if _, err := r.Resolve(
		context.Background(),
		uuid.New(),
		SecretReference{Provider: "", Key: "K"},
	); err == nil {
		t.Fatal("expected error for empty Provider")
	}
	if got := store.getCalls.Load(); got != 0 {
		t.Fatalf("store should not be hit for invalid refs, got %d calls", got)
	}
}

func TestResolverNoFactoryRegistered(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"unknown": {
				WorkspaceID: ws,
				Name:        "unknown",
				Type:        "vault",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	r := NewResolver(store, NewRegistry(), NewCache(time.Minute), NewProviderCache(time.Minute))

	_, err := r.Resolve(context.Background(), ws, SecretReference{Provider: "unknown", Key: "K"})
	if err == nil {
		t.Fatal("expected error for unregistered provider type")
	}
}

func TestResolverProviderErrorPropagates(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{
		configs: map[string]*ProviderConfig{
			"doppler-prod": {
				WorkspaceID: ws,
				Name:        "doppler-prod",
				Type:        "doppler",
				Config:      json.RawMessage(`{}`),
			},
		},
	}
	provider := &mockProvider{t: "doppler", resolveErr: errors.New("upstream 500")}
	r := newResolver(t, store, provider)

	_, err := r.Resolve(
		context.Background(),
		ws,
		SecretReference{Provider: "doppler-prod", Key: "K"},
	)
	if err == nil {
		t.Fatal("expected error from provider to propagate")
	}
}

func TestResolverStoreErrorPropagates(t *testing.T) {
	ws := uuid.New()
	store := &mockStore{getErr: errors.New("db is sad")}
	provider := &mockProvider{t: "doppler"}
	r := newResolver(t, store, provider)

	_, err := r.Resolve(
		context.Background(),
		ws,
		SecretReference{Provider: "doppler-prod", Key: "K"},
	)
	if err == nil {
		t.Fatal("expected error from store to propagate")
	}
}
