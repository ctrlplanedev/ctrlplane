package resource

import (
	"context"
	"log"
	"workspace-engine/pkg/events/handler"
)

type NewResourceHandler struct {
	log *log.Logger

	handler.Handler
}

func NewNewResourceHandler(logger *log.Logger) *NewResourceHandler {
	return &NewResourceHandler{
		log: logger,
	}
}

func (h *NewResourceHandler) Handle(ctx context.Context, event handler.RawEvent) error {
	return nil
}