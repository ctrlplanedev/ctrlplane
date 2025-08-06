package resource

import (
	"context"
	"workspace-engine/pkg/events/handler"
)

type NewResourceHandler struct {
	handler.Handler
}

func NewNewResourceHandler() *NewResourceHandler {
	return &NewResourceHandler{}
}

func (h *NewResourceHandler) Handle(ctx context.Context, event handler.RawEvent) error {
	return nil
}