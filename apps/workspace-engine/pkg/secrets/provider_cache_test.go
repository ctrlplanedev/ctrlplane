package secrets

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
)

type stubProviderInst struct {
	typ string
}

func (s *stubProviderInst) Type() string { return s.typ }
func (s *stubProviderInst) Resolve(_ context.Context, _ SecretReference) (string, error) {
	return "", nil
}

func TestProviderCacheHitMiss(t *testing.T) {
	c := NewProviderCache(time.Minute)
	ws := uuid.New()

	if _, ok := c.Get(ws, "doppler-prod"); ok {
		t.Fatal("expected miss on empty cache")
	}

	want := &stubProviderInst{typ: "doppler"}
	c.Set(ws, "doppler-prod", want)

	got, ok := c.Get(ws, "doppler-prod")
	if !ok {
		t.Fatal("expected hit after Set")
	}
	if got != want {
		t.Fatalf("got %p want %p", got, want)
	}
}

func TestProviderCacheExpiry(t *testing.T) {
	c := NewProviderCache(time.Minute)
	now := time.Unix(1_700_000_000, 0)
	c.now = func() time.Time { return now }
	ws := uuid.New()

	c.Set(ws, "doppler-prod", &stubProviderInst{typ: "doppler"})
	if _, ok := c.Get(ws, "doppler-prod"); !ok {
		t.Fatal("expected hit immediately after Set")
	}

	now = now.Add(time.Minute + time.Second)
	if _, ok := c.Get(ws, "doppler-prod"); ok {
		t.Fatal("expected miss after TTL expiry")
	}
}

func TestProviderCacheDisabledWhenTTLZero(t *testing.T) {
	c := NewProviderCache(0)
	ws := uuid.New()

	c.Set(ws, "doppler-prod", &stubProviderInst{typ: "doppler"})
	if _, ok := c.Get(ws, "doppler-prod"); ok {
		t.Fatal("zero TTL must disable caching")
	}
	if c.Size() != 0 {
		t.Fatalf("zero TTL must not store entries, got %d", c.Size())
	}
}

func TestProviderCacheInvalidate(t *testing.T) {
	c := NewProviderCache(time.Minute)
	wsA := uuid.New()
	wsB := uuid.New()

	c.Set(wsA, "doppler-prod", &stubProviderInst{typ: "doppler"})
	c.Set(wsA, "aws-prod", &stubProviderInst{typ: "aws_secrets_manager"})
	c.Set(wsB, "doppler-prod", &stubProviderInst{typ: "doppler"})

	c.Invalidate(wsA, "doppler-prod")

	if _, ok := c.Get(wsA, "doppler-prod"); ok {
		t.Fatal("expected wsA/doppler-prod evicted")
	}
	if _, ok := c.Get(wsA, "aws-prod"); !ok {
		t.Fatal("expected wsA/aws-prod retained")
	}
	if _, ok := c.Get(wsB, "doppler-prod"); !ok {
		t.Fatal("expected wsB/doppler-prod retained (different workspace)")
	}
}

func TestProviderCacheInvalidateAll(t *testing.T) {
	c := NewProviderCache(time.Minute)
	ws := uuid.New()
	c.Set(ws, "doppler-prod", &stubProviderInst{typ: "doppler"})
	c.Set(ws, "aws-prod", &stubProviderInst{typ: "aws_secrets_manager"})

	c.InvalidateAll()

	if c.Size() != 0 {
		t.Fatalf("InvalidateAll: size %d, want 0", c.Size())
	}
}
