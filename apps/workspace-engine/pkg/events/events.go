package events

import (
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/events/handler/deployment"
	"workspace-engine/pkg/events/handler/deploymentversion"
	"workspace-engine/pkg/events/handler/environment"
	"workspace-engine/pkg/events/handler/resources"
	"workspace-engine/pkg/events/handler/system"
)

var handlers = handler.HandlerRegistry{
	handler.DeploymentVersionCreate: deploymentversion.HandleDeploymentVersionCreated,

	handler.ResourceCreate: resources.HandleResourceCreated,
	handler.ResourceUpdate: resources.HandleResourceUpdated,
	handler.ResourceDelete: resources.HandleResourceDeleted,

	handler.DeploymentCreate: deployment.HandleDeploymentCreated,
	handler.DeploymentUpdate: deployment.HandleDeploymentUpdated,
	handler.DeploymentDelete: deployment.HandleDeploymentDeleted,

	handler.SystemCreate: system.HandleSystemCreated,
	handler.SystemUpdate: system.HandleSystemUpdated,
	handler.SystemDelete: system.HandleSystemDeleted,

	handler.EnvironmentCreate: environment.HandleEnvironmentCreated,
	handler.EnvironmentUpdate: environment.HandleEnvironmentUpdated,
	handler.EnvironmentDelete: environment.HandleEnvironmentDeleted,
}

func NewEventHandler() *handler.EventListener {
	return handler.NewEventListener(handlers)
}
