package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/deployments"
	"workspace-engine/pkg/server/openapi/environments"
	"workspace-engine/pkg/server/openapi/jobagents"
	"workspace-engine/pkg/server/openapi/jobs"
	"workspace-engine/pkg/server/openapi/policies"
	"workspace-engine/pkg/server/openapi/relationshiprules"
	"workspace-engine/pkg/server/openapi/releases"
	"workspace-engine/pkg/server/openapi/resources"
	"workspace-engine/pkg/server/openapi/systems"
)

func New() *Server {
	return &Server{}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	releases.Releases
	deployments.Deployments
	resources.Resources
	systems.Systems
	environments.Environments
	jobs.Jobs
	jobagents.JobAgents
	policies.Policies
	relationshiprules.RelationshipRules
}
