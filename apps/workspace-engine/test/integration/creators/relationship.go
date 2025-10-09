package creators

import (
	"fmt"
	"time"
	"workspace-engine/pkg/pb"

	"github.com/google/uuid"
)

// NewRelationshipRule creates a new RelationshipRule with default values
func NewRelationshipRule(workspaceID string) *pb.RelationshipRule {
	return &pb.RelationshipRule{
		Id:        uuid.New().String(),
		Name:      fmt.Sprintf("relationship-rule-%d", time.Now().UnixNano()),
		Reference: fmt.Sprintf("ref-%d", time.Now().UnixNano()),
	}
}

// NewPropertyMatcher creates a new PropertyMatcher
func NewPropertyMatcher(fromProperty []string, toProperty []string) *pb.PropertyMatcher {
	return &pb.PropertyMatcher{
		FromProperty: fromProperty,
		ToProperty:   toProperty,
	}
}

