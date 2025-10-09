package relationships

import (
	"workspace-engine/pkg/pb"
)

type Entity struct {
	deployment *pb.Deployment
	environment *pb.Environment
	resource *pb.Resource
}

func (e *Entity) GetType() string {
	if e.deployment != nil {
		return "deployment"
	}
	if e.environment != nil {
		return "environment"
	}
	if e.resource != nil {
		return "resource"
	}
	return ""
}

func (e *Entity) GetDeployment() *pb.Deployment {
	return e.deployment
}

func (e *Entity) GetEnvironment() *pb.Environment {
	return e.environment
}

func (e *Entity) GetResource() *pb.Resource {
	return e.resource
}

func (e *Entity) GetID() string {
	switch e.GetType() {
	case "deployment":
		return e.deployment.Id
	case "environment":
		return e.environment.Id
	case "resource":
		return e.resource.Id
	}
	return ""
}

func (e *Entity) Item() any {
	switch e.GetType() {
	case "deployment":
		return e.deployment
	case "environment":
		return e.environment
	case "resource":
		return e.resource
	}
	return nil
}

func NewDeploymentEntity(deployment *pb.Deployment) *Entity {
	return &Entity{deployment: deployment}
}

func NewEnvironmentEntity(environment *pb.Environment) *Entity {
	return &Entity{environment: environment}
}

func NewResourceEntity(resource *pb.Resource) *Entity {
	return &Entity{resource: resource}
}
