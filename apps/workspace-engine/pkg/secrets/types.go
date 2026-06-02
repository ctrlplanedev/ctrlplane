// Package secrets resolves variable_value rows of kind = secret_ref by
// looking up the workspace's secret_provider entity, decrypting its
// configuration, and dispatching to a provider implementation (Doppler, AWS
// Secrets Manager, env, ...). The Resolver is constructed once at startup and
// injected into the variableresolver.
package secrets

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// SecretReference identifies a single secret value within a workspace.
type SecretReference struct {
	// Provider is the workspace-unique name of the secret_provider row.
	Provider string
	// Path is provider-specific; may be empty.
	Path string
	// Key identifies the secret within Path. Some providers ignore Path and
	// use Key alone (e.g. env).
	Key string
	// Version optionally pins to a specific provider-side version. Empty
	// means "latest" — awssm reads AWSCURRENT, Doppler the latest published
	// version. When set: awssm uses VersionId (uuid form) or VersionStage
	// (AWSCURRENT/AWSPREVIOUS), Doppler uses accept_secret_version.
	Version string
}

// Provider resolves a SecretReference against an external secret store.
// Implementations are constructed by a ProviderFactory from a decrypted
// ProviderConfig and are safe to reuse across resolutions for the lifetime of
// a single ProviderConfig row (TTL cache governs reuse).
type Provider interface {
	// Type matches secret_provider.type. Used for registry lookups.
	Type() string
	// Resolve fetches the secret value. Returning a non-nil error blocks the
	// downstream release dispatch.
	Resolve(ctx context.Context, ref SecretReference) (string, error)
}

// ProviderConfig is the decrypted view of a secret_provider row. Config is
// the raw decrypted JSON payload; each provider's factory unmarshals it into
// a typed struct that lives next to the provider implementation.
type ProviderConfig struct {
	ID          uuid.UUID
	WorkspaceID uuid.UUID
	Name        string
	Type        string
	Config      json.RawMessage
}

// ProviderFactory constructs a Provider from the decrypted config payload.
type ProviderFactory func(cfg json.RawMessage) (Provider, error)

// ProviderConfigStore loads and decrypts secret_provider rows.
type ProviderConfigStore interface {
	Get(ctx context.Context, workspaceID uuid.UUID, providerName string) (*ProviderConfig, error)
	List(ctx context.Context, workspaceID uuid.UUID) ([]*ProviderConfig, error)
}
