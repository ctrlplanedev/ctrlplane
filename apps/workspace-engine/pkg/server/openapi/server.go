package openapi

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/deployments"
	"workspace-engine/pkg/server/openapi/environments"
	"workspace-engine/pkg/server/openapi/policies"
	"workspace-engine/pkg/server/openapi/releasetargets"

	"github.com/gin-gonic/gin"
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

// EvaluateReleaseTarget implements oapi.ServerInterface.
// Subtle: this method shadows the method (ReleaseTargets).EvaluateReleaseTarget of Server.ReleaseTargets.
func (s *Server) EvaluateReleaseTarget(c *gin.Context, workspaceId oapi.WorkspaceId) {
	panic("unimplemented")
}

// GetDeploymentResources implements oapi.ServerInterface.
// Subtle: this method shadows the method (Deployments).GetDeploymentResources of Server.Deployments.
func (s *Server) GetDeploymentResources(c *gin.Context, workspaceId oapi.WorkspaceId, deploymentId oapi.DeploymentId) {
	panic("unimplemented")
}

// GetEnvironmentResources implements oapi.ServerInterface.
// Subtle: this method shadows the method (Environments).GetEnvironmentResources of Server.Environments.
func (s *Server) GetEnvironmentResources(c *gin.Context, workspaceId oapi.WorkspaceId, environmentId oapi.EnvironmentId) {
	panic("unimplemented")
}

// GetPoliciesForReleaseTarget implements oapi.ServerInterface.
// Subtle: this method shadows the method (ReleaseTargets).GetPoliciesForReleaseTarget of Server.ReleaseTargets.
func (s *Server) GetPoliciesForReleaseTarget(c *gin.Context, workspaceId oapi.WorkspaceId, releaseTargetId oapi.ReleaseTargetId) {
	panic("unimplemented")
}

// GetRelatedEntities implements oapi.ServerInterface.
func (s *Server) GetRelatedEntities(c *gin.Context, workspaceId oapi.WorkspaceId, entityType oapi.GetRelatedEntitiesParamsEntityType, entityId oapi.EntityId) {
	panic("unimplemented")
}

// GetReleaseTargetsForPolicy implements oapi.ServerInterface.
// Subtle: this method shadows the method (Policies).GetReleaseTargetsForPolicy of Server.Policies.
func (s *Server) GetReleaseTargetsForPolicy(c *gin.Context, workspaceId oapi.WorkspaceId, policyId oapi.PolicyId) {
	panic("unimplemented")
}
