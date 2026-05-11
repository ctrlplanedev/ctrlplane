// Package env implements a secrets.Provider that reads from the
// workspace-engine process environment. Every workspace using this provider
// must list the permitted env var names explicitly in allowedKeys to prevent
// a tenant from reading arbitrary process state.
package env

import (
	"context"
	"fmt"
	"os"

	"workspace-engine/pkg/secrets"
)

const Type = "env"

type Provider struct {
	allowed map[string]struct{}
	lookup  func(string) (string, bool)
}

// Factory matches secrets.ProviderFactory. The config must contain an
// allowedKeys array with at least one entry; the API and Drizzle validators
// enforce the shape, the factory enforces it again defensively.
func Factory(cfg map[string]any) (secrets.Provider, error) {
	raw, ok := cfg["allowedKeys"]
	if !ok {
		return nil, fmt.Errorf("env provider: missing allowedKeys in config")
	}
	list, ok := raw.([]any)
	if !ok {
		return nil, fmt.Errorf("env provider: allowedKeys must be a JSON array, got %T", raw)
	}
	if len(list) == 0 {
		return nil, fmt.Errorf("env provider: allowedKeys is empty")
	}
	allowed := make(map[string]struct{}, len(list))
	for _, v := range list {
		s, ok := v.(string)
		if !ok || s == "" {
			return nil, fmt.Errorf(
				"env provider: allowedKeys entries must be non-empty strings, got %T",
				v,
			)
		}
		allowed[s] = struct{}{}
	}
	return &Provider{allowed: allowed, lookup: os.LookupEnv}, nil
}

func (*Provider) Type() string { return Type }

func (p *Provider) Resolve(_ context.Context, ref secrets.SecretReference) (string, error) {
	if _, ok := p.allowed[ref.Key]; !ok {
		return "", fmt.Errorf("env provider: key %q not in allowlist", ref.Key)
	}
	v, ok := p.lookup(ref.Key)
	if !ok {
		return "", fmt.Errorf("env provider: env var %q is not set", ref.Key)
	}
	return v, nil
}
