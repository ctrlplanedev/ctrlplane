package operations

import (
	"testing"
	"time"
	"workspace-engine/pkg/model/conditions"
)

func TestDateCondition_ConditionTypeDate(t *testing.T) {
	condAfter := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  conditions.DateOperatorAfter,
		Value:     now,
	}
	condBefore := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  conditions.DateOperatorBefore,
		Value:     now,
	}
	condBeforeOrOn := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  conditions.DateOperatorBeforeOrOn,
		Value:     now,
	}
	condAfterOrOn := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  conditions.DateOperatorAfterOrOn,
		Value:     now,
	}

	tests := []struct {
		name         string
		cond         DateCondition[*matchableEntity]
		entityOffset time.Duration
		wantMatch    bool
		wantErr      bool
	}{
		{
			name:         "entity created-at after condition-value with After operator",
			cond:         condAfter,
			entityOffset: 24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity created-at equal to condition-value with After operator",
			cond:         condAfter,
			entityOffset: 0,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity created-at before condition-value with After operator",
			cond:         condAfter,
			entityOffset: -24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity created-at after condition-value with AfterOrOn operator",
			cond:         condAfterOrOn,
			entityOffset: 24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity created-at equal to condition-value with AfterOrOn operator",
			cond:         condAfterOrOn,
			entityOffset: 0,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity created-at before condition-value with AfterOrOn operator",
			cond:         condAfterOrOn,
			entityOffset: -24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity created-at after condition-value with Before operator",
			cond:         condBefore,
			entityOffset: 24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity created-at equal to condition-value with Before operator",
			cond:         condBefore,
			entityOffset: 0,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity created-at before condition-value with Before operator",
			cond:         condBefore,
			entityOffset: -24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity created-at after condition-value with BeforeOrOn operator",
			cond:         condBeforeOrOn,
			entityOffset: 24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity created-at equal to condition-value with BeforeOrOn operator",
			cond:         condBeforeOrOn,
			entityOffset: 0,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity created-at before condition-value with BeforeOrOn operator",
			cond:         condBeforeOrOn,
			entityOffset: -24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entity := newEntityBuilder().createdAt(tt.cond.Value.Add(tt.entityOffset)).build()
			matched, err := tt.cond.Matches(entity)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if matched != tt.wantMatch {
				t.Errorf("Matches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}

func TestDateCondition_ConditionTypeUpdatedAt(t *testing.T) {
	condAfter := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeUpdatedAt,
		Operator:  conditions.DateOperatorAfter,
		Value:     now,
	}
	condBefore := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeUpdatedAt,
		Operator:  conditions.DateOperatorBefore,
		Value:     now,
	}
	condBeforeOrOn := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeUpdatedAt,
		Operator:  conditions.DateOperatorBeforeOrOn,
		Value:     now,
	}
	condAfterOrOn := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeUpdatedAt,
		Operator:  conditions.DateOperatorAfterOrOn,
		Value:     now,
	}

	tests := []struct {
		name         string
		cond         DateCondition[*matchableEntity]
		entityOffset time.Duration
		wantMatch    bool
		wantErr      bool
	}{
		{
			name:         "entity updated-at after condition-value with After operator",
			cond:         condAfter,
			entityOffset: 24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity updated-at equal to condition-value with After operator",
			cond:         condAfter,
			entityOffset: 0,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity updated-at before condition-value with After operator",
			cond:         condAfter,
			entityOffset: -24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity updated-at after condition-value with AfterOrOn operator",
			cond:         condAfterOrOn,
			entityOffset: 24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity updated-at equal to condition-value with AfterOrOn operator",
			cond:         condAfterOrOn,
			entityOffset: 0,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity updated-at before condition-value with AfterOrOn operator",
			cond:         condAfterOrOn,
			entityOffset: -24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity updated-at after condition-value with Before operator",
			cond:         condBefore,
			entityOffset: 24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity updated-at equal to condition-value with Before operator",
			cond:         condBefore,
			entityOffset: 0,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity updated-at before condition-value with Before operator",
			cond:         condBefore,
			entityOffset: -24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity updated-at after condition-value with BeforeOrOn operator",
			cond:         condBeforeOrOn,
			entityOffset: 24 * time.Hour,
			wantMatch:    false,
			wantErr:      false,
		},
		{
			name:         "entity updated-at equal to condition-value with BeforeOrOn operator",
			cond:         condBeforeOrOn,
			entityOffset: 0,
			wantMatch:    true,
			wantErr:      false,
		},
		{
			name:         "entity updated-at before condition-value with BeforeOrOn operator",
			cond:         condBeforeOrOn,
			entityOffset: -24 * time.Hour,
			wantMatch:    true,
			wantErr:      false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			entity := newEntityBuilder().updatedAt(tt.cond.Value.Add(tt.entityOffset)).build()
			matched, err := tt.cond.Matches(entity)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if matched != tt.wantMatch {
				t.Errorf("Matches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}

func TestDateCondition_InvalidField(t *testing.T) {
	entity := &matchableEntity{
		ID:   "test-123",
		Name: "Test Entity",
		// Missing CreatedAt and UpdatedAt fields
	}

	cond := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  conditions.DateOperatorAfter,
		Value:     now,
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for missing field, got nil")
	}
}

func TestDateCondition_InvalidDateFormat(t *testing.T) {
	entity := &matchableEntity{
		ID:        "test-123",
		Name:      "Test Entity",
		CreatedAt: "not-a-valid-date",
		UpdatedAt: "also-not-valid",
	}

	cond := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  conditions.DateOperatorAfter,
		Value:     now,
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for invalid date format, got nil")
	}
}

func TestDateCondition_InvalidOperator(t *testing.T) {
	entity := newEntityBuilder().build()

	cond := DateCondition[*matchableEntity]{
		TypeField: conditions.ConditionTypeDate,
		Operator:  "equals", // Invalid operator
		Value:     now,
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for invalid date format, got nil")
	}
}

func TestDateCondition_timeTruncation(t *testing.T) {
	nowTruncated := time.Now().Truncate(time.Second)
	nowWithMillis := nowTruncated.Add(500 * time.Millisecond)
	tests := []struct {
		name       string
		condTime   time.Time
		entityTime time.Time
		operator   conditions.DateOperator
		wantMatch  bool
	}{
		{
			name:       "truncated condTime with After operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   conditions.DateOperatorAfter,
			wantMatch:  false,
		},
		{
			name:       "truncated entityTime with After operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorAfter,
			wantMatch:  false,
		},
		{
			name:       "truncated both with After operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorAfter,
			wantMatch:  false,
		},
		{
			name:       "truncated condTime with AfterOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   conditions.DateOperatorAfterOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated entityTime with AfterOrOn operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorAfterOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated both with AfterOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorAfterOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated condTime with Before operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   conditions.DateOperatorBefore,
			wantMatch:  false,
		},
		{
			name:       "truncated entityTime with Before operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorBefore,
			wantMatch:  false,
		},
		{
			name:       "truncated both with Before operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorBefore,
			wantMatch:  false,
		},
		{
			name:       "truncated condTime with BeforeOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   conditions.DateOperatorBeforeOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated entityTime with BeforeOrOn operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorBeforeOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated both with BeforeOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   conditions.DateOperatorBeforeOrOn,
			wantMatch:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cond := DateCondition[*matchableEntity]{
				TypeField: conditions.ConditionTypeDate,
				Operator:  tt.operator,
				Value:     tt.condTime,
			}

			entity := newEntityBuilder().createdAt(tt.entityTime).build()
			matched, err := cond.Matches(entity)
			if err != nil {
				t.Errorf("Matches() error = %v", err)
				return
			}
			if matched != tt.wantMatch {
				t.Errorf("Expected match %v, got %v", tt.wantMatch, matched)
			}
		})
	}
}

func TestDateConditionMatches(t *testing.T) {
	now := time.Now()
	nowRfc3339 := now.Format(time.RFC3339)
	laterRfc3339 := now.Add(24 * time.Hour).Format(time.RFC3339)
	earlierRfc3339 := now.Add(-24 * time.Hour).Format(time.RFC3339)

	entity := newEntityBuilder().createdAt(now).build()

	tests := []struct {
		name      string
		entity    any
		operator  conditions.DateOperator
		aField    string
		bValue    string
		wantMatch bool
		wantErr   bool
	}{
		// Success cases
		{
			name:      "created-at after bValue with After operator",
			entity:    entity,
			operator:  conditions.DateOperatorAfter,
			aField:    "created-at",
			bValue:    earlierRfc3339,
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "created-at before bValue with After operator",
			entity:    entity,
			operator:  conditions.DateOperatorAfter,
			aField:    "created-at",
			bValue:    laterRfc3339,
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:      "created-at equal to bValue with After operator",
			entity:    entity,
			operator:  conditions.DateOperatorAfter,
			aField:    "created-at",
			bValue:    nowRfc3339,
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:      "created-at before bValue with Before operator",
			entity:    entity,
			operator:  conditions.DateOperatorBefore,
			aField:    "created-at",
			bValue:    laterRfc3339,
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "created-at after bValue with Before operator",
			entity:    entity,
			operator:  conditions.DateOperatorBefore,
			aField:    "created-at",
			bValue:    earlierRfc3339,
			wantMatch: false,
			wantErr:   false,
		},
		{
			name:      "created-at equal to bValue with BeforeOrOn operator",
			entity:    entity,
			operator:  conditions.DateOperatorBeforeOrOn,
			aField:    "created-at",
			bValue:    nowRfc3339,
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:      "created-at equal to bValue with AfterOrOn operator",
			entity:    entity,
			operator:  conditions.DateOperatorAfterOrOn,
			aField:    "created-at",
			bValue:    nowRfc3339,
			wantMatch: true,
			wantErr:   false,
		},

		// Error cases
		{
			name:     "invalid aField",
			entity:   entity,
			operator: conditions.DateOperatorAfter,
			aField:   "non_existent_field",
			bValue:   nowRfc3339,
			wantErr:  true,
		},
		{
			name:     "invalid bValue format",
			entity:   entity,
			operator: conditions.DateOperatorAfter,
			aField:   "created-at",
			bValue:   "not-a-date",
			wantErr:  true,
		},
		{
			name: "field is not a date",
			entity: &matchableEntity{
				ID:   "test-123",
				Name: "not a date field",
			},
			operator: conditions.DateOperatorAfter,
			aField:   "name",
			bValue:   nowRfc3339,
			wantErr:  true,
		},
		{
			name:     "invalid operator",
			entity:   entity,
			operator: "equals",
			aField:   "created-at",
			bValue:   nowRfc3339,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, err := DateConditionMatches(tt.entity, tt.operator, tt.aField, tt.bValue)
			if (err != nil) != tt.wantErr {
				t.Errorf("DateConditionMatches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if matched != tt.wantMatch {
				t.Errorf("DateConditionMatches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}
