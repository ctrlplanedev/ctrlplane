// Package providers wires the built-in secret provider implementations into
// a secrets.Registry. main.go calls RegisterAll once during startup; new
// provider types are added here.
package providers

import (
	"workspace-engine/pkg/secrets"
	"workspace-engine/pkg/secrets/awssm"
	"workspace-engine/pkg/secrets/doppler"
	"workspace-engine/pkg/secrets/env"
)

// RegisterAll registers every provider implementation shipped with
// workspace-engine. Callers may add additional registrations afterward.
func RegisterAll(r *secrets.Registry) {
	r.Register(awssm.Type, awssm.Factory)
	r.Register(doppler.Type, doppler.Factory)
	r.Register(env.Type, env.Factory)
}

// NewDefaultRegistry constructs a Registry pre-populated with the built-in
// providers. Convenience for tests and main.go.
func NewDefaultRegistry() *secrets.Registry {
	r := secrets.NewRegistry()
	RegisterAll(r)
	return r
}
