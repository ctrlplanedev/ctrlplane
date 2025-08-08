package resource

import (
	"context"
	"workspace-engine/pkg/engine/workspace"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/resource"
)

type NewResourceHandler struct {
	handler.Handler
}

func NewNewResourceHandler() *NewResourceHandler {
	return &NewResourceHandler{}
}

func (h *NewResourceHandler) Handle(ctx context.Context, engine *workspace.WorkspaceEngine, event handler.RawEvent) error {
	resource := resource.Resource{}

	err := engine.UpsertResource(ctx, resource).
		UpdateSelectors().
		GetReleaseTargetChanges().
		GetMatchingPolicies().
		EvaulatePolicies().
		CreateHookDispatchRequests().
		CreateDeploymentDispatchRequests().
		Dispatch()

	return err
}
