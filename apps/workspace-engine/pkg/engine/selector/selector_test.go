package selector_test

import (
	"context"
	"fmt"
	"testing"
	sel "workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/engine/selector/exhaustive"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
)

type entity struct {
	ID   string
	Name string
}

func (e entity) GetID() string {
	return e.ID
}

type selector struct {
	ID         string
	conditions conditions.JSONCondition
}

func (s selector) GetID() string {
	return s.ID
}

func (s selector) Selector(e model.MatchableEntity) (*conditions.JSONCondition, error) {
	return &s.conditions, nil
}

func (s selector) MatchAllIfNullSelector(e model.MatchableEntity) bool {
	return false
}

func nameCondition(name string) conditions.JSONCondition {
	return conditions.JSONCondition{
		ConditionType: conditions.ConditionTypeName,
		Operator:      string(conditions.StringConditionOperatorEquals),
		Value:         name,
	}
}

func alwaysTrueCondition() conditions.JSONCondition {
	return conditions.JSONCondition{
		ConditionType: conditions.ConditionTypeID,
		Operator:      string(conditions.StringConditionOperatorStartsWith),
		Value:         "",
	}
}

func alwaysFalseCondition() conditions.JSONCondition {
	return conditions.JSONCondition{
		ConditionType: conditions.ConditionTypeID,
		Operator:      string(conditions.StringConditionOperatorContains),
		Value:         ";;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;",
	}
}

type SelectorTestStep struct {
	upsertEntity   *entity
	upsertSelector *selector

	removeEntity   *entity
	removeSelector *selector

	expectedState map[string]map[string]bool
}

type SelectorTest struct {
	name  string
	steps []SelectorTestStep
}

type TestStepBundle struct {
	t         *testing.T
	ctx       context.Context
	engine    sel.SelectorEngine[entity, selector]
	step      SelectorTestStep
	entities  map[string]entity
	selectors map[string]selector
	message   string
}

func (b *TestStepBundle) executeStep() {
	if b.step.upsertEntity != nil {
		for range b.engine.UpsertEntity(b.ctx, *b.step.upsertEntity) {
		}
		b.entities[b.step.upsertEntity.ID] = *b.step.upsertEntity
		b.message += fmt.Sprintf("upserted entity %s; ", b.step.upsertEntity.ID)
	}

	if b.step.upsertSelector != nil {
		for range b.engine.UpsertSelector(b.ctx, *b.step.upsertSelector) {
		}
		b.selectors[b.step.upsertSelector.ID] = *b.step.upsertSelector
		b.message += fmt.Sprintf("upserted selector %s; ", b.step.upsertSelector.ID)
	}

	if b.step.removeEntity != nil {
		for range b.engine.RemoveEntity(b.ctx, *b.step.removeEntity) {
		}
		delete(b.entities, b.step.removeEntity.ID)
		b.message += fmt.Sprintf("removed entity %s; ", b.step.removeEntity.ID)
	}

	if b.step.removeSelector != nil {
		for range b.engine.RemoveSelector(b.ctx, *b.step.removeSelector) {
		}
		delete(b.selectors, b.step.removeSelector.ID)
		b.message += fmt.Sprintf("removed selector %s; ", b.step.removeSelector.ID)
	}
}

func (b *TestStepBundle) validateExpectedState() {
	for entityID := range b.step.expectedState {
		for selectorID := range b.step.expectedState[entityID] {
			expectedValue := b.step.expectedState[entityID][selectorID]
			entity, ok := b.entities[entityID]
			if !ok {
				b.t.Fatalf("entity not found: %s -- %s", entityID, b.message)
			}
			selector, ok := b.selectors[selectorID]
			if !ok {
				b.t.Fatalf("selector not found: %s -- %s", selectorID, b.message)
			}

			actualValue, err := b.engine.IsMatch(b.ctx, entity, selector)
			if err != nil {
				b.t.Fatalf("error checking match: %v -- %s", err, b.message)
			}

			if actualValue != expectedValue {
				b.t.Fatalf("for entity %s and selector %s expected match to be %v, got %v -- %s", entityID, selectorID, expectedValue, actualValue, b.message)
			}
		}
	}
}

func (b *TestStepBundle) testSelectorRemoved() {
	if b.step.removeSelector == nil {
		return
	}

	for _, entity := range b.entities {
		actualSelectorMatches, err := b.engine.GetSelectorsForEntity(b.ctx, entity)
		if err != nil {
			b.t.Fatalf("error getting selectors for entity %s: %v -- %s", entity.ID, err, b.message)
		}

		for _, actualSelector := range actualSelectorMatches {
			if actualSelector.ID == b.step.removeSelector.ID {
				b.t.Fatalf("removed selector %s should not be matched to entity %s -- %s", b.step.removeSelector.ID, entity.ID, b.message)
			}
		}
	}

	actualEntityMatches, err := b.engine.GetEntitiesForSelector(b.ctx, *b.step.removeSelector)
	if err != nil {
		b.t.Fatalf("error getting entities for selector %s: %v -- %s", b.step.removeSelector.ID, err, b.message)
	}

	if len(actualEntityMatches) > 0 {
		b.t.Fatalf("removed selector %s should not be matched to any entities -- %s", b.step.removeSelector.ID, b.message)
	}
}

func (b *TestStepBundle) testEntityRemoved() {
	if b.step.removeEntity == nil {
		return
	}

	for _, selector := range b.selectors {
		actualEntityMatches, err := b.engine.GetEntitiesForSelector(b.ctx, selector)
		if err != nil {
			b.t.Fatalf("error getting entities for selector %s: %v -- %s", selector.ID, err, b.message)
		}

		for _, actualEntity := range actualEntityMatches {
			if actualEntity.ID == b.step.removeEntity.ID {
				b.t.Fatalf("removed entity %s should not be matched to selector %s -- %s", b.step.removeEntity.ID, selector.ID, b.message)
			}
		}
	}

	actualSelectorMatches, err := b.engine.GetSelectorsForEntity(b.ctx, *b.step.removeEntity)
	if err != nil {
		b.t.Fatalf("error getting selectors for entity %s: %v -- %s", b.step.removeEntity.ID, err, b.message)
	}

	if len(actualSelectorMatches) > 0 {
		b.t.Fatalf("removed entity %s should not be matched to any selectors -- %s", b.step.removeEntity.ID, b.message)
	}
}

func TestSelectorTestCaseBasic(t *testing.T) {
	upsertEntityThenSelector := SelectorTest{
		name: "should match when an entity is upserted then a selector is upserted",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysTrueCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
		},
	}

	upsertSelectorThenEntity := SelectorTest{
		name: "should match when a selector is upserted then an entity is upserted",
		steps: []SelectorTestStep{
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysTrueCondition(),
				},
			},
			{
				upsertEntity: &entity{ID: "1"},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
		},
	}

	removeEntityBasic := SelectorTest{
		name: "should not match when an entity is removed",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysTrueCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
			{
				removeEntity:  &entity{ID: "1"},
				expectedState: map[string]map[string]bool{},
			},
		},
	}

	removeSelectorBasic := SelectorTest{
		name: "should not match when a selector is removed",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysTrueCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
			{
				upsertSelector: &selector{
					ID:         "2",
					conditions: alwaysTrueCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true, "2": true},
				},
			},
		},
	}

	matchMultipleEntities := SelectorTest{
		name: "should match when multiple entities are upserted then a selector is upserted",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1"}},
			{upsertEntity: &entity{ID: "2"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysTrueCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
					"2": {"1": true},
				},
			},
		},
	}

	matchMultipleSelectors := SelectorTest{
		name: "should match when multiple selectors are upserted then an entity is upserted",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1"}},
			{upsertEntity: &entity{ID: "2"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysTrueCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
					"2": {"1": true},
				},
			},
		},
	}

	newEntityShouldNotMatchSelector := SelectorTest{
		name: "should not match when a new entity is upserted that does not match the selector's conditions",
		steps: []SelectorTestStep{
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysFalseCondition(),
				},
			},
			{
				upsertEntity: &entity{ID: "1"},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
		},
	}

	newSelectorShouldNotMatchEntity := SelectorTest{
		name: "should not match when a new selector is upserted and its conditions do not match the entity",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: alwaysFalseCondition(),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
		},
	}

	shouldMatchWhenEntityChangesToMatchSelector := SelectorTest{
		name: "should newly match when an entity is updated and its attributes now match the selector's conditions",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1", Name: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("2"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
			{
				upsertEntity: &entity{ID: "1", Name: "2"},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
		},
	}

	shouldMatchWhenSelectorChangesToMatchEntity := SelectorTest{
		name: "should newly match when a selector is updated and its conditions now select the entity",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1", Name: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("2"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("1"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
		},
	}

	shouldUnmatchWhenEntityChangesToNotMatchSelector := SelectorTest{
		name: "should no longer match when an entity is updated and its attributes no longer match the selector's conditions",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1", Name: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("1"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
			{
				upsertEntity: &entity{ID: "1", Name: "2"},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
		},
	}

	shouldUnmatchWhenSelectorChangesToNotSelectEntity := SelectorTest{
		name: "should no longer match when a selector is updated and its conditions no longer select the entity",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1", Name: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("1"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("2"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
		},
	}

	shouldHandleDuplicateEntityUpsert := SelectorTest{
		name: "should handle duplicate entity upsert",
		steps: []SelectorTestStep{
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("1"),
				},
			},
			{upsertEntity: &entity{ID: "1", Name: "1"}, expectedState: map[string]map[string]bool{
				"1": {"1": true},
			}},
			{upsertEntity: &entity{ID: "1", Name: "1"}, expectedState: map[string]map[string]bool{
				"1": {"1": true},
			}},
		},
	}

	shouldHandleDuplicateSelectorUpsert := SelectorTest{
		name: "should handle duplicate selector upsert",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1", Name: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("1"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: nameCondition("1"),
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": true},
				},
			},
		},
	}

	shouldHandleEmptySelectorUpsert := SelectorTest{
		name: "should handle empty selector upsert",
		steps: []SelectorTestStep{
			{upsertEntity: &entity{ID: "1", Name: "1"}},
			{
				upsertSelector: &selector{
					ID:         "1",
					conditions: conditions.JSONCondition{},
				},
				expectedState: map[string]map[string]bool{
					"1": {"1": false},
				},
			},
		},
	}

	tests := []SelectorTest{
		upsertEntityThenSelector,
		upsertSelectorThenEntity,
		removeEntityBasic,
		removeSelectorBasic,
		matchMultipleEntities,
		matchMultipleSelectors,
		newEntityShouldNotMatchSelector,
		newSelectorShouldNotMatchEntity,
		shouldMatchWhenEntityChangesToMatchSelector,
		shouldMatchWhenSelectorChangesToMatchEntity,
		shouldUnmatchWhenEntityChangesToNotMatchSelector,
		shouldUnmatchWhenSelectorChangesToNotSelectEntity,
		shouldHandleDuplicateEntityUpsert,
		shouldHandleDuplicateSelectorUpsert,
		shouldHandleEmptySelectorUpsert,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			engine := exhaustive.NewExhaustive[entity, selector]()
			ctx := context.Background()

			entities := make(map[string]entity)
			selectors := make(map[string]selector)

			for _, step := range test.steps {
				bundle := TestStepBundle{
					t:         t,
					ctx:       ctx,
					engine:    engine,
					step:      step,
					entities:  entities,
					selectors: selectors,
					message:   "",
				}

				bundle.executeStep()
				bundle.validateExpectedState()
				bundle.testSelectorRemoved()
				bundle.testEntityRemoved()
			}
		})
	}
}
