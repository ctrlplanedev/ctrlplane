package variable

import (
	"context"
	"workspace-engine/pkg/model/resource"
)

type VariableValue interface {
	GetID() string
	GetKey() string
	Resolve(ctx context.Context, resource *resource.Resource) (string, error)
}
