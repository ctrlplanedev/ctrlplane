package relationships

import "workspace-engine/pkg/oapi"

func NewDeploymentEntity(deployment *oapi.Deployment) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	_ = entity.FromDeployment(*deployment)
	return entity
}

func NewEnvironmentEntity(environment *oapi.Environment) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	_ = entity.FromEnvironment(*environment)
	return entity
}

func NewResourceEntity(resource *oapi.Resource) *oapi.RelatableEntity {
	entity := &oapi.RelatableEntity{}
	_ = entity.FromResource(*resource)
	return entity
}
