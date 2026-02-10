package v2

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
)

type RelationshipRule struct {
	ID          string
	Name        string
	Description string
	Reference   string
	Matcher     oapi.CelMatcher
}

func (r *RelationshipRule) Match(from map[string]any, to map[string]any) (bool, error) {
	matcher, err := relationships.NewCelMatcher(&r.Matcher)
	if err != nil {
		return false, err
	}
	return matcher.Evaluate(from, to), nil
}
