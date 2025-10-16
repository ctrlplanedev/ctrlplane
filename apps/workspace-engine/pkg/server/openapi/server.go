package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/deployments"
	"workspace-engine/pkg/server/openapi/environments"
	"workspace-engine/pkg/server/openapi/policies"
	"workspace-engine/pkg/server/openapi/releasetargets"
)

func New() *Server {
	return &Server{}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	deployments.Deployments
	environments.Environments
	releasetargets.ReleaseTargets
	policies.Policies
}
