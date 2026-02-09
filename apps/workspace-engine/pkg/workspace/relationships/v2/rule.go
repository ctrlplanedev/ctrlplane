package v2

import (
	"workspace-engine/pkg/celutil"
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

func (r *RelationshipRule) Match(from *oapi.RelatableEntity, to *oapi.RelatableEntity) (bool, error) {
	matcher, err := relationships.NewCelMatcher(&r.Matcher)
	if err != nil {
		return false, err
	}

	fromMap, _ := celutil.EntityToMap(from.Item())
	fromMap["type"] = from.GetType()

	toMap, _ := celutil.EntityToMap(to.Item())
	toMap["type"] = to.GetType()

	return matcher.Evaluate(fromMap, toMap), nil
}
