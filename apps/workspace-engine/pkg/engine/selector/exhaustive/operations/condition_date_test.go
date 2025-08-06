package operations

import (
	"testing"
	"time"
	"workspace-engine/pkg/engine/selector"
)

func TestDateCondition(t *testing.T) {
	entity := newEntityBuilder().
		createdAt(yesterday).
		updatedAt(now).
		build()

	tests := []struct {
		name      string
		cond      DateCondition
		wantMatch bool
		wantErr   bool
	}{
		// CreatedAt field tests (created-at = yesterday)
		{
			name: "created-at after two days ago should match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfter,
				Value:     twoDaysAgo,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "created-at before today should match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBefore,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "created-at after tomorrow should not match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfter,
				Value:     tomorrow,
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "created-at before two days ago should not match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBefore,
				Value:     twoDaysAgo,
			},
			wantMatch: false,
			wantErr:   false,
		},
		{
			name: "created-at after-or-on yesterday should match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfterOrOn,
				Value:     yesterday,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "created-at after-or-on two days ago should match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfterOrOn,
				Value:     twoDaysAgo,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "created-at before-or-on today should match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBeforeOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "created-at before-or-on yesterday should match",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBeforeOrOn,
				Value:     yesterday,
			},
			wantMatch: true,
			wantErr:   false,
		},
		// UpdatedAt field tests (updated-at = now)
		{
			name: "updated-at after yesterday should match",
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorAfter,
				Value:     yesterday,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "updated-at after half day ago should match",
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorAfter,
				Value:     halfDayAgo,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "updated-at before tomorrow should match",
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorBefore,
				Value:     tomorrow,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "updated-at after-or-on now should match",
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorAfterOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "updated-at before-or-on now should match",
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorBeforeOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		// Invalid operator test
		{
			name: "invalid operator should error",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  "equals",
				Value:     now,
			},
			wantMatch: false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, err := tt.cond.Matches(entity)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err == nil && matched != tt.wantMatch {
				t.Errorf("Matches() = %v, want %v", matched, tt.wantMatch)
			}
		})
	}
}

func TestDateCondition_TimeComparisons(t *testing.T) {

	createdYesterdayUpdatedNowEntity := newEntityBuilder().
		createdAt(yesterday).
		updatedAt(now).
		build()

	createdTomorrowUpdatedNowEntity := newEntityBuilder().
		createdAt(tomorrow).
		updatedAt(now).
		build()

	createdNowUpdatedNowEntity := newEntityBuilder().
		createdAt(now).
		updatedAt(now).
		build()

	tests := []struct {
		name      string
		entity    selector.MatchableEntity
		cond      DateCondition
		wantMatch bool
		wantErr   bool
	}{
		// Before operator tests
		{
			name:   "before operator - entity date before condition value",
			entity: createdYesterdayUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBefore,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "before operator - entity date after condition value",
			entity: createdTomorrowUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBefore,
				Value:     now,
			},
			wantMatch: false,
			wantErr:   false,
		},
		// After operator tests
		{
			name:   "after operator - entity date after condition value",
			entity: createdTomorrowUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfter,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "after operator - entity date before condition value",
			entity: createdYesterdayUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfter,
				Value:     now,
			},
			wantMatch: false,
			wantErr:   false,
		},
		// BeforeOrOn operator tests
		{
			name:   "before-or-on operator - entity date before condition value",
			entity: createdYesterdayUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBeforeOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "before-or-on operator - entity date equals condition value",
			entity: createdNowUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBeforeOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "before-or-on operator - entity date after condition value",
			entity: createdTomorrowUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBeforeOrOn,
				Value:     now,
			},
			wantMatch: false,
			wantErr:   false,
		},
		// AfterOrOn operator tests
		{
			name:   "after-or-on operator - entity date after condition value",
			entity: createdTomorrowUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfterOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "after-or-on operator - entity date equals condition value",
			entity: createdNowUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfterOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "after-or-on operator - entity date before condition value",
			entity: createdYesterdayUpdatedNowEntity,
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfterOrOn,
				Value:     now,
			},
			wantMatch: false,
			wantErr:   false,
		},
		// Test with UpdatedAt field as well
		{
			name:   "updated-at field - after operator",
			entity: createdYesterdayUpdatedNowEntity, // UpdatedAt is set to now
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorAfter,
				Value:     yesterday,
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name:   "updated-at field - before-or-on operator with same time",
			entity: createdNowUpdatedNowEntity, // UpdatedAt is set to now
			cond: DateCondition{
				TypeField: ConditionTypeUpdatedAt,
				Operator:  DateOperatorBeforeOrOn,
				Value:     now,
			},
			wantMatch: true,
			wantErr:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, err := tt.cond.Matches(tt.entity)
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

	cond := DateCondition{
		TypeField: ConditionTypeDate,
		Operator:  DateOperatorAfter,
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

	cond := DateCondition{
		TypeField: ConditionTypeDate,
		Operator:  DateOperatorAfter,
		Value:     now,
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for invalid date format, got nil")
	}
}

func TestDateCondition_InvalidOperator(t *testing.T) {
	entity := &matchableEntity{
		ID:        "test-123",
		Name:      "Test Entity",
		CreatedAt: now.Format(time.RFC3339),
		UpdatedAt: now.Format(time.RFC3339),
	}

	cond := DateCondition{
		TypeField: ConditionTypeDate,
		Operator:  "equals", // Invalid operator
		Value:     now,
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for invalid date format, got nil")
	}
}
