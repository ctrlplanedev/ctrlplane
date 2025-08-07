package exhaustive_test

import (
	"workspace-engine/pkg/model"
)

type ExhaustiveTestFixture struct {
	entities  []model.MatchableEntity
	selectors []model.SelectorEntity

	expectedMatches map[string]map[string]bool
}
