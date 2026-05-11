package secrets

import (
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestCacheHitMiss(t *testing.T) {
	c := NewCache(time.Minute)
	ws := uuid.New()
	ref := SecretReference{Provider: "doppler-prod", Path: "backend/prod", Key: "TOKEN"}

	if _, ok := c.Get(ws, ref); ok {
		t.Fatal("expected miss on empty cache")
	}

	c.Set(ws, ref, "secret-value")

	v, ok := c.Get(ws, ref)
	if !ok || v != "secret-value" {
		t.Fatalf("expected hit with value=%q, got ok=%v value=%q", "secret-value", ok, v)
	}
}

func TestCacheExpiry(t *testing.T) {
	c := NewCache(time.Minute)
	now := time.Unix(1_700_000_000, 0)
	c.now = func() time.Time { return now }

	ws := uuid.New()
	ref := SecretReference{Provider: "p", Key: "K"}

	c.Set(ws, ref, "v1")

	if _, ok := c.Get(ws, ref); !ok {
		t.Fatal("expected hit immediately after Set")
	}

	now = now.Add(time.Minute + time.Second)
	if _, ok := c.Get(ws, ref); ok {
		t.Fatal("expected miss after TTL expiry")
	}
}

func TestCacheDisabledWhenTTLZero(t *testing.T) {
	c := NewCache(0)
	ws := uuid.New()
	ref := SecretReference{Provider: "p", Key: "K"}

	c.Set(ws, ref, "v1")
	if _, ok := c.Get(ws, ref); ok {
		t.Fatal("zero TTL must disable caching")
	}
	if c.Size() != 0 {
		t.Fatalf("zero TTL must not store entries, got %d", c.Size())
	}
}

func TestCacheInvalidateProvider(t *testing.T) {
	c := NewCache(time.Minute)
	wsA := uuid.New()
	wsB := uuid.New()

	c.Set(wsA, SecretReference{Provider: "doppler-prod", Key: "K1"}, "a")
	c.Set(wsA, SecretReference{Provider: "doppler-prod", Key: "K2"}, "b")
	c.Set(wsA, SecretReference{Provider: "aws-prod", Key: "K3"}, "c")
	c.Set(wsB, SecretReference{Provider: "doppler-prod", Key: "K1"}, "d")

	c.InvalidateProvider(wsA, "doppler-prod")

	if _, ok := c.Get(wsA, SecretReference{Provider: "doppler-prod", Key: "K1"}); ok {
		t.Fatal("expected wsA/doppler-prod/K1 evicted")
	}
	if _, ok := c.Get(wsA, SecretReference{Provider: "doppler-prod", Key: "K2"}); ok {
		t.Fatal("expected wsA/doppler-prod/K2 evicted")
	}
	if _, ok := c.Get(wsA, SecretReference{Provider: "aws-prod", Key: "K3"}); !ok {
		t.Fatal("expected wsA/aws-prod/K3 retained")
	}
	if _, ok := c.Get(wsB, SecretReference{Provider: "doppler-prod", Key: "K1"}); !ok {
		t.Fatal("expected wsB/doppler-prod/K1 retained (different workspace)")
	}
}

func TestCacheKeysDistinguishPaths(t *testing.T) {
	c := NewCache(time.Minute)
	ws := uuid.New()

	c.Set(ws, SecretReference{Provider: "p", Path: "a", Key: "K"}, "value-a")
	c.Set(ws, SecretReference{Provider: "p", Path: "b", Key: "K"}, "value-b")

	v, _ := c.Get(ws, SecretReference{Provider: "p", Path: "a", Key: "K"})
	if v != "value-a" {
		t.Fatalf("path a: want value-a, got %q", v)
	}
	v, _ = c.Get(ws, SecretReference{Provider: "p", Path: "b", Key: "K"})
	if v != "value-b" {
		t.Fatalf("path b: want value-b, got %q", v)
	}
}
