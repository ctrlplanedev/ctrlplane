// Package env implements a secrets.Provider that reads from the
// workspace-engine process environment. Every workspace using this provider
// must list the permitted env var names explicitly in AllowedKeys to prevent
// a tenant from reading arbitrary process state.
package env

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"slices"

	"workspace-engine/pkg/secrets"
)

const Type = "env"

// Config is the decrypted config payload for an env provider row.
type Config struct {
	AllowedKeys []string `json:"allowedKeys"`
}

func (c Config) validate() error {
	if len(c.AllowedKeys) == 0 {
		return fmt.Errorf("env provider: allowedKeys is empty")
	}
	if slices.Contains(c.AllowedKeys, "") {
		return fmt.Errorf("env provider: allowedKeys entries must be non-empty strings")
	}
	return nil
}

type Provider struct {
	allowed map[string]struct{}
	lookup  func(string) (string, bool)
}

// Factory matches secrets.ProviderFactory.
func Factory(raw json.RawMessage) (secrets.Provider, error) {
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("env provider: parse config: %w", err)
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	allowed := make(map[string]struct{}, len(cfg.AllowedKeys))
	for _, k := range cfg.AllowedKeys {
		allowed[k] = struct{}{}
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
