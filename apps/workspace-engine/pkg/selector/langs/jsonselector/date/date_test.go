package date

import (
	"testing"
	"time"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

// Test entity type
type testEntity struct {
	ID        string
	Name      string
	CreatedAt string
	UpdatedAt string
}

// Test helper to create entity builder
type entityBuilder struct {
	entity *testEntity
}

func newEntityBuilder() *entityBuilder {
	return &entityBuilder{
		entity: &testEntity{
			ID:   "test-123",
			Name: "Test Entity",
		},
	}
}

func (b *entityBuilder) createdAt(t time.Time) *entityBuilder {
	b.entity.CreatedAt = t.Format(time.RFC3339)
	return b
}

func (b *entityBuilder) updatedAt(t time.Time) *entityBuilder {
	b.entity.UpdatedAt = t.Format(time.RFC3339)
	return b
}

func (b *entityBuilder) build() *testEntity {
	return b.entity
}

var baseTime = time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)

func TestDateCondition_ConditionTypeDate(t *testing.T) {
	nowStr := baseTime.Format(time.RFC3339)

	condAfter := DateCondition{
		Property: "CreatedAt",
		Operator: DateOperatorAfter,
		Value:    nowStr,
	}
	condBefore := DateCondition{
		Property: "CreatedAt",
		Operator: DateOperatorBefore,
		Value:    nowStr,
	}
	condBeforeOrOn := DateCondition{
		Property: "CreatedAt",
		Operator: DateOperatorBeforeOrOn,
		Value:    nowStr,
	}
	condAfterOrOn := DateCondition{
		Property: "CreatedAt",
		Operator: DateOperatorAfterOrOn,
		Value:    nowStr,
	}

	tests := []struct {
		name         string
		cond         DateCondition
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
			entity := newEntityBuilder().createdAt(baseTime.Add(tt.entityOffset)).build()
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
	nowStr := baseTime.Format(time.RFC3339)

	condAfter := DateCondition{
		Property: "UpdatedAt",
		Operator: DateOperatorAfter,
		Value:    nowStr,
	}
	condBefore := DateCondition{
		Property: "UpdatedAt",
		Operator: DateOperatorBefore,
		Value:    nowStr,
	}
	condBeforeOrOn := DateCondition{
		Property: "UpdatedAt",
		Operator: DateOperatorBeforeOrOn,
		Value:    nowStr,
	}
	condAfterOrOn := DateCondition{
		Property: "UpdatedAt",
		Operator: DateOperatorAfterOrOn,
		Value:    nowStr,
	}

	tests := []struct {
		name         string
		cond         DateCondition
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
			entity := newEntityBuilder().updatedAt(baseTime.Add(tt.entityOffset)).build()
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
	entity := &testEntity{
		ID:   "test-123",
		Name: "Test Entity",
		// Missing CreatedAt and UpdatedAt fields
	}

	cond := DateCondition{
		Property: "non-existent-field",
		Operator: DateOperatorAfter,
		Value:    baseTime.Format(time.RFC3339),
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for missing field, got nil")
	}
}

func TestDateCondition_InvalidDateFormat(t *testing.T) {
	entity := &testEntity{
		ID:        "test-123",
		Name:      "Test Entity",
		CreatedAt: "not-a-valid-date",
		UpdatedAt: "also-not-valid",
	}

	cond := DateCondition{
		Property: "CreatedAt",
		Operator: DateOperatorAfter,
		Value:    baseTime.Format(time.RFC3339),
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for invalid date format, got nil")
	}
}

func TestDateCondition_InvalidOperator(t *testing.T) {
	entity := newEntityBuilder().createdAt(baseTime).build()

	cond := DateCondition{
		Property: "CreatedAt",
		Operator: "invalid-op", // Invalid operator
		Value:    baseTime.Format(time.RFC3339),
	}

	_, err := cond.Matches(entity)
	if err == nil {
		t.Error("Expected error for invalid operator, got nil")
	}
}

func TestDateCondition_timeTruncation(t *testing.T) {
	nowTruncated := time.Now().Truncate(time.Second)
	nowWithMillis := nowTruncated.Add(500 * time.Millisecond)
	tests := []struct {
		name       string
		condTime   time.Time
		entityTime time.Time
		operator   DateOperator
		wantMatch  bool
	}{
		{
			name:       "truncated condTime with After operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   DateOperatorAfter,
			wantMatch:  false,
		},
		{
			name:       "truncated entityTime with After operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   DateOperatorAfter,
			wantMatch:  false,
		},
		{
			name:       "truncated both with After operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   DateOperatorAfter,
			wantMatch:  false,
		},
		{
			name:       "truncated condTime with AfterOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   DateOperatorAfterOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated entityTime with AfterOrOn operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   DateOperatorAfterOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated both with AfterOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   DateOperatorAfterOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated condTime with Before operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   DateOperatorBefore,
			wantMatch:  false,
		},
		{
			name:       "truncated entityTime with Before operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   DateOperatorBefore,
			wantMatch:  false,
		},
		{
			name:       "truncated both with Before operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   DateOperatorBefore,
			wantMatch:  false,
		},
		{
			name:       "truncated condTime with BeforeOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowWithMillis,
			operator:   DateOperatorBeforeOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated entityTime with BeforeOrOn operator",
			condTime:   nowWithMillis,
			entityTime: nowTruncated,
			operator:   DateOperatorBeforeOrOn,
			wantMatch:  true,
		},
		{
			name:       "truncated both with BeforeOrOn operator",
			condTime:   nowTruncated,
			entityTime: nowTruncated,
			operator:   DateOperatorBeforeOrOn,
			wantMatch:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cond := DateCondition{
				Property: "CreatedAt",
				Operator: tt.operator,
				Value:    tt.condTime.Format(time.RFC3339),
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

func TestConvertFromUnknownCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
	}{
		{
			name: "valid after operator",
			condition: unknown.UnknownCondition{
				Property: "CreatedAt",
				Operator: "after",
				Value:    baseTime.Format(time.RFC3339),
			},
			wantErr: false,
		},
		{
			name: "valid before operator",
			condition: unknown.UnknownCondition{
				Property: "CreatedAt",
				Operator: "before",
				Value:    baseTime.Format(time.RFC3339),
			},
			wantErr: false,
		},
		{
			name: "valid before-or-on operator",
			condition: unknown.UnknownCondition{
				Property: "CreatedAt",
				Operator: "before-or-on",
				Value:    baseTime.Format(time.RFC3339),
			},
			wantErr: false,
		},
		{
			name: "valid after-or-on operator",
			condition: unknown.UnknownCondition{
				Property: "CreatedAt",
				Operator: "after-or-on",
				Value:    baseTime.Format(time.RFC3339),
			},
			wantErr: false,
		},
		{
			name: "valid equals operator",
			condition: unknown.UnknownCondition{
				Property: "CreatedAt",
				Operator: "equals",
				Value:    baseTime.Format(time.RFC3339),
			},
			wantErr: false,
		},
		{
			name: "invalid operator",
			condition: unknown.UnknownCondition{
				Property: "CreatedAt",
				Operator: "invalid-operator",
				Value:    baseTime.Format(time.RFC3339),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertFromUnknownCondition(tt.condition)
			if (err != nil) != tt.wantErr {
				t.Errorf("ConvertFromUnknownCondition() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if result.Property != tt.condition.Property {
					t.Errorf("ConvertFromUnknownCondition() Property = %v, want %v", result.Property, tt.condition.Property)
				}
				if string(result.Operator) != tt.condition.Operator {
					t.Errorf("ConvertFromUnknownCondition() Operator = %v, want %v", result.Operator, tt.condition.Operator)
				}
				if result.Value != tt.condition.Value {
					t.Errorf("ConvertFromUnknownCondition() Value = %v, want %v", result.Value, tt.condition.Value)
				}
			}
		})
	}
}
