package variable

import (
	"context"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
)

type Variable interface {
	GetID() string
	GetKey() string
	ResolveValue(ctx context.Context, releaseTarget *rt.ReleaseTarget) (string, error)
}
