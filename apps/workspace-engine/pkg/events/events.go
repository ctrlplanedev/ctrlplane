package events

import (
	"workspace-engine/pkg/events/handler"
	deploymentversion "workspace-engine/pkg/events/handler/deployment-version"
	"workspace-engine/pkg/events/handler/resource"
)

func NewEventHandler() *handler.EventListener {
	handlers := handler.HandlerRegistry{
		handler.ResourceCreated:          resource.NewNewResourceHandler(),
		handler.DeploymentVersionCreated: deploymentversion.NewNewDeploymentVersionHandler(),
		handler.DeploymentVersionDeleted: deploymentversion.NewDeleteDeploymentVersionHandler(),
	}

	return handler.NewEventListener(handlers)
}
