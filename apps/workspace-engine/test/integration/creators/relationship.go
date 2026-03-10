package creators

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

// NewRelationshipRule creates a new RelationshipRule with default values.
func NewRelationshipRule(workspaceID string) *oapi.RelationshipRule {
	return &oapi.RelationshipRule{
		Id:               uuid.New().String(),
		Name:             fmt.Sprintf("relationship-rule-%d", time.Now().UnixNano()),
		Reference:        fmt.Sprintf("ref-%d", time.Now().UnixNano()),
		FromType:         "resource",
		ToType:           "resource",
		RelationshipType: "default",
		Metadata:         make(map[string]string),
		Matcher:          oapi.RelationshipRule_Matcher{},
	}
}

// NewPropertyMatcher creates a new PropertyMatcher.
func NewPropertyMatcher(fromProperty []string, toProperty []string) *oapi.PropertyMatcher {
	return &oapi.PropertyMatcher{
		FromProperty: fromProperty,
		ToProperty:   toProperty,
		Operator:     oapi.Equals,
	}
}
