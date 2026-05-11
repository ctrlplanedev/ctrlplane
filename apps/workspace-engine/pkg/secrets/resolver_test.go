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
	return NewResolver(store, reg, NewCache(time.Minute))
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

func TestResolverRejectsEmptyRefFields(t *testing.T) {
	store := &mockStore{}
	provider := &mockProvider{t: "doppler"}
	r := newResolver(t, store, provider)

	cases := []SecretReference{
		{Provider: "", Key: "K"},
		{Provider: "p", Key: ""},
	}
	for _, c := range cases {
		if _, err := r.Resolve(context.Background(), uuid.New(), c); err == nil {
			t.Fatalf("expected error for ref %+v", c)
		}
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
	r := NewResolver(store, NewRegistry(), NewCache(time.Minute))

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
