package terraformcloud

import (
	"context"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"
)

var _ types.Dispatchable = &TFE{}

type TFE struct {
	store *store.Store
}

func NewTFE(store *store.Store) *TFE {
	return &TFE{store: store}
}

func (t *TFE) Type() string {
	return "tfe"
}

func (t *TFE) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   false,
		Deployments: true,
	}
}

func (t *TFE) Dispatch(ctx context.Context, context types.DispatchContext) error {
	panic("unimplemented")
}
