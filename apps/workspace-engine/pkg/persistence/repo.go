package persistence

import (
	"context"
)

// Repository defines CRUD operations for a specific entity type
type Repository[E any] interface {
	Set(ctx context.Context, entity E) error
	Unset(ctx context.Context, entity E) error
}
