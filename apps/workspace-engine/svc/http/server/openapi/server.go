package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/svc/http/server/openapi/deployments"
	"workspace-engine/svc/http/server/openapi/deploymentvariables"
	"workspace-engine/svc/http/server/openapi/deploymentversions"
	"workspace-engine/svc/http/server/openapi/environments"
	"workspace-engine/svc/http/server/openapi/githubentities"
	"workspace-engine/svc/http/server/openapi/jobagents"
	"workspace-engine/svc/http/server/openapi/jobs"
	"workspace-engine/svc/http/server/openapi/policies"
	"workspace-engine/svc/http/server/openapi/policyskips"
	"workspace-engine/svc/http/server/openapi/relations"
	"workspace-engine/svc/http/server/openapi/releases"
	"workspace-engine/svc/http/server/openapi/releasetargets"
	"workspace-engine/svc/http/server/openapi/resourceproviders"
	"workspace-engine/svc/http/server/openapi/resources"
	"workspace-engine/svc/http/server/openapi/systems"
	"workspace-engine/svc/http/server/openapi/validators"
	"workspace-engine/svc/http/server/openapi/workflows"
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
	deploymentvariables.DeploymentVariables
	environments.Environments
	releasetargets.ReleaseTargets
	policies.Policies
	policyskips.PolicySkips
	relations.Relations
	resources.Resources
	systems.Systems
	validators.Validator
	resourceproviders.ResourceProviders
	githubentities.GithubEntities
	releases.Releases
	workflows.Workflows
}
