package argo

import (
	"context"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"
)

var _ types.Dispatchable = &ArgoApplication{}

type ArgoApplication struct {
	store *store.Store
}

func NewArgoApplication(store *store.Store) *ArgoApplication {
	return &ArgoApplication{store: store}
}

func (a *ArgoApplication) Type() string {
	return "argo-application"
}

func (a *ArgoApplication) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: false,
	}
}

func (a *ArgoApplication) Dispatch(ctx context.Context, context types.RenderContext) error {
	panic("unimplemented")
}
