package events

import (
	"workspace-engine/pkg/events/handler"
)

func NewEventHandler() *handler.EventListener {
	handlers := handler.HandlerRegistry{
	}

	return handler.NewEventListener(handlers)
}