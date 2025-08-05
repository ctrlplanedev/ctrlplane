package selector

import (
	"testing"
	"time"
)

func TestDateCondition(t *testing.T) {
	tests := []struct {
		name    string
		cond    DateCondition
		wantErr bool
	}{
		{
			name: "valid date",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorAfter,
				Value:     time.Now(),
				DateField: DateFieldUpdatedAt,
			},
			wantErr: false,
		},
		{
			name: "invalid zero date",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  DateOperatorBefore,
				Value:     time.Time{},
				DateField: DateFieldCreatedAt,
			},
			wantErr: true,
		},
		{
			name: "invalid operator",
			cond: DateCondition{
				TypeField: ConditionTypeDate,
				Operator:  "equals",
				Value:     time.Now(),
				DateField: DateFieldCreatedAt,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// result doesn't matter, only testing for validation errors
			_, err := tt.cond.Matches(resourceFixture())
			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
