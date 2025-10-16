package openapi

import (
	"net/http"
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

// GetRelatedEntities implements oapi.ServerInterface.
func (s *Server) GetRelatedEntities(c *gin.Context, workspaceId oapi.WorkspaceId, entityType oapi.GetRelatedEntitiesParamsEntityType, entityId oapi.EntityId) {
	c.JSON(http.StatusInternalServerError, gin.H{
		"error": "Not implemented",
	})
}
