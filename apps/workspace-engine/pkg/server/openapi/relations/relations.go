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

func (s *Relations) GetRelatedEntities(c *gin.Context, workspaceId string, entityType oapi.RelatableEntityType, entityId string) {
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

	c.JSON(http.StatusOK, gin.H{"relations": relatedEntities})
}

func (s *Relations) getEntityByType(ws *workspace.Workspace, entityType oapi.RelatableEntityType, entityId string) (*oapi.RelatableEntity, error) {
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

func (s *Relations) GetRelationshipRules(c *gin.Context, workspaceId string, params oapi.GetRelationshipRulesParams) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	relationshipRules := ws.RelationshipRules().Items()
	relationshipRulesList := make([]*oapi.RelationshipRule, 0, len(relationshipRules))
	for _, relationshipRule := range relationshipRules {
		relationshipRulesList = append(relationshipRulesList, relationshipRule)
	}

	limit := 50
	if params.Limit != nil {
		limit = *params.Limit
	}
	offset := 0
	if params.Offset != nil {
		offset = *params.Offset
	}
	if offset < 0 {
		offset = 0
	}

	total := len(relationshipRules)
	start := min(offset, total)
	end := min(start+limit, total)
	paginatedRelationshipRules := relationshipRulesList[start:end]

	c.JSON(http.StatusOK, gin.H{
		"total":  total,
		"offset": offset,
		"limit":  limit,
		"items":  paginatedRelationshipRules,
	})
}

func (s *Relations) GetRelationshipRule(c *gin.Context, workspaceId string, relationshipRuleId string) {
	ws, err := utils.GetWorkspace(c, workspaceId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	relationshipRule, ok := ws.RelationshipRules().Get(relationshipRuleId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "relationship rule not found"})
		return
	}

	c.JSON(http.StatusOK, relationshipRule)
}
