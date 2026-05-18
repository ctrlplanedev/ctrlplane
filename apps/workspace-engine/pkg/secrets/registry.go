package secrets

import "fmt"

// Registry is a string-keyed lookup of ProviderFactory by secret_provider.type.
// Provider packages register themselves at init time, mirroring the
// jobagents/registry.go pattern.
type Registry struct {
	factories map[string]ProviderFactory
}

func NewRegistry() *Registry {
	return &Registry{factories: make(map[string]ProviderFactory)}
}

// Register attaches a factory under the given provider type. A second call
// with the same type overwrites the prior registration; callers should treat
// re-registration as a programming error and avoid it.
func (r *Registry) Register(providerType string, factory ProviderFactory) {
	r.factories[providerType] = factory
}

// Build constructs a Provider from a decrypted ProviderConfig. Returns an
// error if no factory is registered for the config's type.
func (r *Registry) Build(cfg *ProviderConfig) (Provider, error) {
	factory, ok := r.factories[cfg.Type]
	if !ok {
		return nil, fmt.Errorf("secrets: no provider factory registered for type %q", cfg.Type)
	}
	return factory(cfg.Config)
}

// Types returns the registered provider types in undefined order. Primarily
// useful for diagnostics and startup logging.
func (r *Registry) Types() []string {
	types := make([]string, 0, len(r.factories))
	for t := range r.factories {
		types = append(types, t)
	}
	return types
}
