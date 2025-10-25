package persistence

import (
	"context"
)

// Repository defines CRUD operations for a specific entity type
type Repository[E any] interface {
	Create(ctx context.Context, entity E) error
	Update(ctx context.Context, entity E) error
	Delete(ctx context.Context, entity E) error
}
