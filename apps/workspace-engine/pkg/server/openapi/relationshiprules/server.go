package relationshiprules

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/server/openapi/utils"
)

type RelationshipRules struct{}

func New() *RelationshipRules {
	return &RelationshipRules{}
}

func (s *RelationshipRules) ListRelationshipRules(c *gin.Context, workspaceId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	// Access the repository directly to get all relationship rules
	relationshipRulesMap := ws.RelationshipRules().Items()
	relationshipRulesList := make([]*oapi.RelationshipRule, 0, len(relationshipRulesMap))
	for _, rule := range relationshipRulesMap {
		relationshipRulesList = append(relationshipRulesList, rule)
	}
	c.JSON(http.StatusOK, gin.H{
		"relationshipRules": relationshipRulesList,
	})
}

func (s *RelationshipRules) GetRelationshipRule(c *gin.Context, workspaceId string, ruleId string) {
	ws := utils.GetWorkspace(c, workspaceId)
	if ws == nil {
		return
	}

	rule, ok := ws.RelationshipRules().Get(ruleId)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Relationship rule not found",
		})
		return
	}

	c.JSON(http.StatusOK, rule)
}
