package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/bypasses"
	"workspace-engine/pkg/server/openapi/deployments"
	"workspace-engine/pkg/server/openapi/deploymentversions"
	"workspace-engine/pkg/server/openapi/environments"
	"workspace-engine/pkg/server/openapi/githubentities"
	"workspace-engine/pkg/server/openapi/jobagents"
	"workspace-engine/pkg/server/openapi/jobs"
	"workspace-engine/pkg/server/openapi/policies"
	"workspace-engine/pkg/server/openapi/relations"
	"workspace-engine/pkg/server/openapi/releases"
	"workspace-engine/pkg/server/openapi/releasetargets"
	"workspace-engine/pkg/server/openapi/resourceproviders"
	"workspace-engine/pkg/server/openapi/resources"
	"workspace-engine/pkg/server/openapi/systems"
	"workspace-engine/pkg/server/openapi/validators"
)

func New() *Server {
	return &Server{}
}

var _ oapi.ServerInterface = &Server{}

type Server struct {
	jobagents.JobAgents
	jobs.Jobs
	deployments.Deployments
	deploymentversions.DeploymentVersions
	environments.Environments
	releasetargets.ReleaseTargets
	policies.Policies
	bypasses.Bypasses
	relations.Relations
	resources.Resources
	systems.Systems
	validators.Validator
	resourceproviders.ResourceProviders
	githubentities.GithubEntities
	releases.Releases
}
