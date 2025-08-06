package events

import (
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/events/handler/resource"
)

func NewEventHandler() *handler.EventListener {
	handlers := handler.HandlerRegistry{
		handler.ResourceCreated: resource.NewNewResourceHandler(),
	}

	return handler.NewEventListener(handlers)
}