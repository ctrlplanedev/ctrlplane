package env

import (
	"context"
	"encoding/json"
	"testing"

	"workspace-engine/pkg/secrets"
)

func newTestProvider(t *testing.T, cfg Config, envVars map[string]string) *Provider {
	t.Helper()
	raw, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	p, err := Factory(raw)
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
		Config{AllowedKeys: []string{"FOO", "BAR"}},
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
		Config{AllowedKeys: []string{"FOO"}},
		map[string]string{"FOO": "x", "BAR": "y"},
	)
	if _, err := p.Resolve(context.Background(), secrets.SecretReference{Key: "BAR"}); err == nil {
		t.Fatal("expected allowlist rejection")
	}
}

func TestResolveMissingEnvVar(t *testing.T) {
	p := newTestProvider(t,
		Config{AllowedKeys: []string{"FOO"}},
		map[string]string{},
	)
	if _, err := p.Resolve(context.Background(), secrets.SecretReference{Key: "FOO"}); err == nil {
		t.Fatal("expected error for unset env var")
	}
}

func TestFactoryRejectsBadConfigs(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{"not json", `not-json`},
		{"missing", `{}`},
		{"wrong type", `{"allowedKeys":"FOO"}`},
		{"empty list", `{"allowedKeys":[]}`},
		{"empty string entry", `{"allowedKeys":[""]}`},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Factory([]byte(c.raw)); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
