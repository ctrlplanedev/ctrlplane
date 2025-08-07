package policy

import (
	"context"
	"workspace-engine/pkg/model"
)

type Repository[T model.Entity] interface {
	GetAll(ctx context.Context) []*T
	Get(ctx context.Context, entityID string) *T
	Create(ctx context.Context, entity *T) error
	Update(ctx context.Context, entity *T) error
	Delete(ctx context.Context, entityID string) error
	Exists(ctx context.Context, entityID string) bool
}
