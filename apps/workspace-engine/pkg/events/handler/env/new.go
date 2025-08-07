package env

import (
	"context"
	"workspace-engine/pkg/engine"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/model/environment"
)

type NewResourceHandler struct {
	handler.Handler
}

func NewNewResourceHandler() *NewResourceHandler {
	return &NewResourceHandler{}
}

func (h *NewResourceHandler) Handle(ctx context.Context, engine *engine.WorkspaceEngine, event handler.RawEvent) error {
	environment := environment.Environment{}

	environmentSelectors := engine.Selectors.EnvironmentResources.UpsertSelector(ctx, environment)

	return nil

}
