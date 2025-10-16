package relationships

import "workspace-engine/pkg/oapi"

func NewDeploymentEntity(deployment *oapi.Deployment) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	entity.FromDeployment(*deployment)
	return entity
}

func NewEnvironmentEntity(environment *oapi.Environment) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	entity.FromEnvironment(*environment)
	return entity
}

func NewResourceEntity(resource *oapi.Resource) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	entity.FromResource(*resource)
	return entity
}
