package github

import (
	"context"
	"workspace-engine/pkg/workspace/jobagents/types"
	"workspace-engine/pkg/workspace/store"
)

var _ types.Dispatchable = &GithubAction{}

type GithubAction struct {
	store *store.Store
}

func NewGithubAction(store *store.Store) *GithubAction {
	return &GithubAction{store: store}
}

func (a *GithubAction) Type() string {
	return "github-action"
}

func (a *GithubAction) Supports() types.Capabilities {
	return types.Capabilities{
		Workflows:   true,
		Deployments: false,
	}
}

// Dispatch implements types.Dispatchable.
func (a *GithubAction) Dispatch(ctx context.Context, context types.RenderContext) error {
	panic("unimplemented")
}
