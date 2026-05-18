package harness

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/secrets"
	"workspace-engine/svc/controllers/desiredrelease/variableresolver"
)

// FakeSecretResolver satisfies variableresolver.SecretResolver with a
// canned in-memory map keyed by (provider, path, key). Use
// FailingSecretResolver to assert error propagation.
type FakeSecretResolver struct {
	Entries      map[string]string
	Calls        []secrets.SecretReference
	WorkspaceIDs []uuid.UUID
}

func fakeRefKey(provider, path, key string) string {
	return provider + "|" + path + "|" + key
}

// NewFakeSecretResolver constructs a resolver with no canned entries. Use
// Set to populate.
func NewFakeSecretResolver() *FakeSecretResolver {
	return &FakeSecretResolver{Entries: make(map[string]string)}
}

// Set seeds the resolver with a canned value for the given ref.
func (f *FakeSecretResolver) Set(provider, path, key, value string) {
	f.Entries[fakeRefKey(provider, path, key)] = value
}

// Resolve implements variableresolver.SecretResolver.
func (f *FakeSecretResolver) Resolve(
	_ context.Context,
	workspaceID uuid.UUID,
	ref secrets.SecretReference,
) (string, error) {
	f.Calls = append(f.Calls, ref)
	f.WorkspaceIDs = append(f.WorkspaceIDs, workspaceID)
	v, ok := f.Entries[fakeRefKey(ref.Provider, ref.Path, ref.Key)]
	if !ok {
		return "", fmt.Errorf(
			"fake secret resolver: no entry for %s/%s/%s",
			ref.Provider,
			ref.Path,
			ref.Key,
		)
	}
	return v, nil
}

var _ variableresolver.SecretResolver = (*FakeSecretResolver)(nil)

// FailingSecretResolver returns the same error for every Resolve call. Use it
// in tests asserting how the reconciler handles secret resolution failures.
type FailingSecretResolver struct {
	Err   error
	Calls []secrets.SecretReference
}

// Resolve implements variableresolver.SecretResolver.
func (f *FailingSecretResolver) Resolve(
	_ context.Context,
	_ uuid.UUID,
	ref secrets.SecretReference,
) (string, error) {
	f.Calls = append(f.Calls, ref)
	return "", f.Err
}

var _ variableresolver.SecretResolver = (*FailingSecretResolver)(nil)

// WithSecretResolver injects a SecretResolver into the pipeline so the
// desired-release controller can resolve variable_value rows of kind
// secret_ref. The resolver is consumed by ResolveValue during
// variableresolver.Resolve.
func WithSecretResolver(r variableresolver.SecretResolver) PipelineOption {
	return func(sc *ScenarioState) {
		sc.SecretResolver = r
	}
}

// SecretRefValue builds an oapi.Value carrying a SecretReferenceValue. Path
// is optional; pass zero or more components.
func SecretRefValue(provider, key string, path ...string) oapi.Value {
	srv := oapi.SecretReferenceValue{
		SecretProvider: provider,
		SecretKey:      key,
	}
	if len(path) > 0 {
		p := append([]string(nil), path...)
		srv.SecretPath = &p
	}
	v := oapi.Value{}
	_ = v.FromSecretReferenceValue(srv)
	return v
}
