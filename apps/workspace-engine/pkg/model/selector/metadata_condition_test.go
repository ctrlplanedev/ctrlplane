package selector

import (
	"testing"
)

func TestMetadataCondition(t *testing.T) {
	tests := []struct {
		name    string
		cond    Condition
		wantErr bool
	}{
		{
			name: "valid null selector",
			cond: MetadataNullCondition{
				TypeField: ConditionTypeMetadata,
				Key:       "environment",
				Operator:  MetadataOperatorNull,
			},
			wantErr: false,
		},
		{
			name: "valid value selector",
			cond: MetadataValueCondition{
				TypeField: ConditionTypeMetadata,
				Key:       "environment",
				Operator:  MetadataOperatorEquals,
				Value:     "production",
			},
			wantErr: false,
		},
		{
			name: "null selector with wrong operator",
			cond: MetadataNullCondition{
				TypeField: ConditionTypeMetadata,
				Key:       "environment",
				Operator:  MetadataOperatorEquals,
			},
			wantErr: true,
		},
		{
			name: "value selector with empty value",
			cond: MetadataValueCondition{
				TypeField: ConditionTypeMetadata,
				Key:       "environment",
				Operator:  MetadataOperatorEquals,
				Value:     "",
			},
			wantErr: true,
		},
		{
			name: "empty key",
			cond: MetadataValueCondition{
				TypeField: ConditionTypeMetadata,
				Key:       "",
				Operator:  MetadataOperatorEquals,
				Value:     "production",
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
