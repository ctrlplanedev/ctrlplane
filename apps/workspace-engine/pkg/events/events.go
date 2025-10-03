package events

import (
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/events/handler/deploymentversion"
)

func NewEventHandler() *handler.EventListener {
	handlers := handler.HandlerRegistry{
		handler.DeploymentVersionCreated: deploymentversion.HandleDeploymentVersionCreated,
	}

	return handler.NewEventListener(handlers)
}