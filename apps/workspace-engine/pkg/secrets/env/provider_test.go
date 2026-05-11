package env

import (
	"context"
	"testing"

	"workspace-engine/pkg/secrets"
)

func newTestProvider(t *testing.T, cfg map[string]any, envVars map[string]string) *Provider {
	t.Helper()
	p, err := Factory(cfg)
	if err != nil {
		t.Fatalf("Factory: %v", err)
	}
	prov := p.(*Provider)
	prov.lookup = func(k string) (string, bool) {
		v, ok := envVars[k]
		return v, ok
	}
	return prov
}

func TestResolveHappyPath(t *testing.T) {
	p := newTestProvider(t,
		map[string]any{"allowedKeys": []any{"FOO", "BAR"}},
		map[string]string{"FOO": "value-foo"},
	)
	got, err := p.Resolve(context.Background(), secrets.SecretReference{Key: "FOO"})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "value-foo" {
		t.Fatalf("got %q want value-foo", got)
	}
}

func TestResolveRejectsNotInAllowlist(t *testing.T) {
	p := newTestProvider(t,
		map[string]any{"allowedKeys": []any{"FOO"}},
		map[string]string{"FOO": "x", "BAR": "y"},
	)
	if _, err := p.Resolve(context.Background(), secrets.SecretReference{Key: "BAR"}); err == nil {
		t.Fatal("expected allowlist rejection")
	}
}

func TestResolveMissingEnvVar(t *testing.T) {
	p := newTestProvider(t,
		map[string]any{"allowedKeys": []any{"FOO"}},
		map[string]string{},
	)
	if _, err := p.Resolve(context.Background(), secrets.SecretReference{Key: "FOO"}); err == nil {
		t.Fatal("expected error for unset env var")
	}
}

func TestFactoryRejectsBadConfigs(t *testing.T) {
	cases := []struct {
		name string
		cfg  map[string]any
	}{
		{"missing", map[string]any{}},
		{"wrong type", map[string]any{"allowedKeys": "FOO"}},
		{"empty list", map[string]any{"allowedKeys": []any{}}},
		{"non-string entry", map[string]any{"allowedKeys": []any{"FOO", 42}}},
		{"empty string entry", map[string]any{"allowedKeys": []any{""}}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Factory(c.cfg); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
