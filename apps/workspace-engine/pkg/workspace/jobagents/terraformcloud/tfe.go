package terraformcloud

import (
	"context"
	"workspace-engine/pkg/oapi"
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

func (t *TFE) Dispatch(ctx context.Context, job *oapi.Job) error {
	return nil
}
