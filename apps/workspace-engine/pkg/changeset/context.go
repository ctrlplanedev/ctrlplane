package changeset

import (
	"context"
)

// contextKey is an unexported type for keys defined in this package.
type contextKey[T any] struct{}

var changesetKey = &contextKey[any]{}

// WithChangeSet returns a new context with the provided ChangeSet attached.
func WithChangeSet[T any](ctx context.Context, cs *ChangeSet[T]) context.Context {
	return context.WithValue(ctx, changesetKey, cs)
}

// FromContext retrieves the ChangeSet from the context, if it exists.
// The returned boolean is true if a ChangeSet was found in the context.
func FromContext[T any](ctx context.Context) (*ChangeSet[T], bool) {
	cs, ok := ctx.Value(changesetKey).(*ChangeSet[T])
	return cs, ok
}
