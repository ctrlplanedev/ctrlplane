package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/deployments"
	"workspace-engine/pkg/server/openapi/deploymentversions"
	"workspace-engine/pkg/server/openapi/environments"
	"workspace-engine/pkg/server/openapi/policies"
	"workspace-engine/pkg/server/openapi/relations"
	"workspace-engine/pkg/server/openapi/releasetargets"
	"workspace-engine/pkg/server/openapi/resources"
	"workspace-engine/pkg/server/openapi/systems"
)

func New() *Server {
	return &Server{}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	deployments.Deployments
	deploymentversions.DeploymentVersions
	environments.Environments
	releasetargets.ReleaseTargets
	policies.Policies
	relations.Relations
	resources.Resources
	systems.Systems
}
