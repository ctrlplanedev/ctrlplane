package relations

import (
	"fmt"
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"

	"github.com/gin-gonic/gin"
)

type Relations struct{}

func (s *Relations) GetRelatedEntities(c *gin.Context, workspaceId string, entityType oapi.EntityType, entityId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	item, err := s.getEntityByType(ws, entityType, entityId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	relatedEntities, err := ws.RelationshipRules().GetRelatedEntities(c.Request.Context(), item)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"relationships": relatedEntities})
}

func (s *Relations) getEntityByType(ws *workspace.Workspace, entityType oapi.EntityType, entityId string) (*oapi.RelatableEntity, error) {
	switch entityType {
	case oapi.RelatableEntityTypeDeployment:
		if entity, ok := ws.Deployments().Get(entityId); ok {
			return relationships.NewDeploymentEntity(entity), nil
		}
		return nil, fmt.Errorf("deployment not found")
	case oapi.RelatableEntityTypeEnvironment:
		if entity, ok := ws.Environments().Get(entityId); ok {
			return relationships.NewEnvironmentEntity(entity), nil
		}
		return nil, fmt.Errorf("environment not found")
	case oapi.RelatableEntityTypeResource:
		if entity, ok := ws.Resources().Get(entityId); ok {
			return relationships.NewResourceEntity(entity), nil
		}
		return nil, fmt.Errorf("resource not found")
	default:
		return nil, fmt.Errorf("invalid entity type: %s", entityType)
	}
}
