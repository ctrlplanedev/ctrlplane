package operations

import (
	"testing"
	"time"
	"workspace-engine/pkg/model/conditions"
)

type testEntity struct {
	ID        string            `json:"id"`
	Version   string            `json:"version"`
	Name      string            `json:"name"`
	System    string            `json:"system"`
	CreatedAt string            `json:"created-at"`
	UpdatedAt string            `json:"updated-at"`
	Metadata  map[string]string `json:"metadata"`
}

func TestJsonSelectorImpl_Matches(t *testing.T) {
	now := time.Now()
	nowRfc3339 := now.Format(time.RFC3339)

	entity := testEntity{
		ID:        "test-id",
		Version:   "1.0.0",
		Name:      "test-name",
		System:    "test-system",
		CreatedAt: nowRfc3339,
		UpdatedAt: nowRfc3339,
		Metadata: map[string]string{
			"meta-key": "meta-value",
		},
	}

	tests := []struct {
		name          string
		jsonCondition conditions.JSONCondition
		wantMatch     bool
		wantErr       bool
	}{
		// String conditions
		{
			name: "ID match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeID,
				Operator:      string(conditions.StringConditionOperatorEquals),
				Value:         "test-id",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "Version match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeVersion,
				Operator:      string(conditions.StringConditionOperatorStartsWith),
				Value:         "1.0",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "Name match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeName,
				Operator:      string(conditions.StringConditionOperatorEndsWith),
				Value:         "-name",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "System match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeSystem,
				Operator:      string(conditions.StringConditionOperatorContains),
				Value:         "system",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "String no match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeID,
				Operator:      string(conditions.StringConditionOperatorEquals),
				Value:         "wrong-id",
			},
			wantMatch: false,
			wantErr:   false,
		},

		// Metadata condition
		{
			name: "Metadata match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeMetadata,
				Operator:      string(conditions.StringConditionOperatorEquals),
				Key:           "meta-key",
				Value:         "meta-value",
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "Metadata no match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeMetadata,
				Operator:      string(conditions.StringConditionOperatorEquals),
				Key:           "meta-key",
				Value:         "wrong-value",
			},
			wantMatch: false,
			wantErr:   false,
		},

		// Date conditions
		{
			name: "CreatedAt match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeDate,
				Operator:      string(conditions.DateOperatorAfterOrOn),
				Value:         now.Add(-time.Hour).Format(time.RFC3339),
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "UpdatedAt match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeUpdatedAt,
				Operator:      string(conditions.DateOperatorBeforeOrOn),
				Value:         now.Add(time.Hour).Format(time.RFC3339),
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "Date no match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeDate,
				Operator:      string(conditions.DateOperatorBefore),
				Value:         now.Add(-time.Hour).Format(time.RFC3339),
			},
			wantMatch: false,
			wantErr:   false,
		},

		// Comparison conditions
		{
			name: "AND comparison match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeAnd,
				Operator:      string(conditions.ComparisonConditionOperatorAnd),
				Conditions: []conditions.JSONCondition{
					{
						ConditionType: conditions.ConditionTypeID,
						Operator:      string(conditions.StringConditionOperatorEquals),
						Value:         "test-id",
					},
					{
						ConditionType: conditions.ConditionTypeName,
						Operator:      string(conditions.StringConditionOperatorEquals),
						Value:         "test-name",
					},
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "OR comparison match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeOr,
				Operator:      string(conditions.ComparisonConditionOperatorOr),
				Conditions: []conditions.JSONCondition{
					{
						ConditionType: conditions.ConditionTypeID,
						Operator:      string(conditions.StringConditionOperatorEquals),
						Value:         "wrong-id",
					},
					{
						ConditionType: conditions.ConditionTypeName,
						Operator:      string(conditions.StringConditionOperatorEquals),
						Value:         "test-name",
					},
				},
			},
			wantMatch: true,
			wantErr:   false,
		},
		{
			name: "Comparison no match",
			jsonCondition: conditions.JSONCondition{
				ConditionType: conditions.ConditionTypeAnd,
				Operator:      string(conditions.ComparisonConditionOperatorAnd),
				Conditions: []conditions.JSONCondition{
					{
						ConditionType: conditions.ConditionTypeID,
						Operator:      string(conditions.StringConditionOperatorEquals),
						Value:         "test-id",
					},
					{
						ConditionType: conditions.ConditionTypeName,
						Operator:      string(conditions.StringConditionOperatorEquals),
						Value:         "wrong-name",
					},
				},
			},
			wantMatch: false,
			wantErr:   false,
		},

		// Unsupported type
		{
			name: "Unsupported condition type",
			jsonCondition: conditions.JSONCondition{
				ConditionType: "unsupported",
			},
			wantMatch: false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector := NewJSONSelector(tt.jsonCondition)
			got, err := selector.Matches(entity)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.wantMatch {
				t.Errorf("Matches() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}
