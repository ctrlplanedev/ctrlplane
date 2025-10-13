package changeset

import (
	"context"
)

// contextKey is an unexported type for keys defined in this package.
type contextKey struct{}

var changesetKey = &contextKey{}

// WithChangeSet returns a new context with the provided ChangeSet attached.
func WithChangeSet(ctx context.Context, cs *ChangeSet) context.Context {
	return context.WithValue(ctx, changesetKey, cs)
}

// FromContext retrieves the ChangeSet from the context, if it exists.
// The returned boolean is true if a ChangeSet was found in the context.
func FromContext(ctx context.Context) (*ChangeSet, bool) {
	cs, ok := ctx.Value(changesetKey).(*ChangeSet)
	return cs, ok
}
