package selector

import (
	"testing"
	"time"
)

func TestIDCondition(t *testing.T) {
	tests := []struct {
		name    string
		cond    IDCondition
		wantErr bool
	}{
		{
			name: "valid ID selector",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  "equals",
				Value:     "123456",
			},
			wantErr: false,
		},
		{
			name: "invalid operator",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  "contains",
				Value:     "123456",
			},
			wantErr: true,
		},
		{
			name: "empty value",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  "equals",
				Value:     "",
			},
			wantErr: true,
		},
		{
			name: "wrong type",
			cond: IDCondition{
				TypeField: ConditionTypeName,
				Operator:  "equals",
				Value:     "123456",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cond.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNameCondition(t *testing.T) {
	tests := []struct {
		name    string
		cond    NameCondition
		wantErr bool
	}{
		{
			name: "valid equals",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test-name",
			},
			wantErr: false,
		},
		{
			name: "valid starts-with",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorStartsWith,
				Value:     "test",
			},
			wantErr: false,
		},
		{
			name: "invalid operator",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  "invalid",
				Value:     "test",
			},
			wantErr: true,
		},
		{
			name: "empty value",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cond.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

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
			err := tt.cond.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

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
			err := tt.cond.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestComparisonCondition(t *testing.T) {
	// Create some valid sub-conditions
	idCond := IDCondition{
		TypeField: ConditionTypeID,
		Operator:  "equals",
		Value:     "123",
	}
	nameCond := NameCondition{
		TypeField: ConditionTypeName,
		Operator:  ColumnOperatorEquals,
		Value:     "test",
	}

	tests := []struct {
		name    string
		cond    ComparisonCondition
		wantErr bool
	}{
		{
			name: "valid AND selector",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   ComparisonOperatorAnd,
				Conditions: []Condition{idCond, nameCond},
			},
			wantErr: false,
		},
		{
			name: "valid OR selector",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   ComparisonOperatorOr,
				Conditions: []Condition{idCond, nameCond},
			},
			wantErr: false,
		},
		{
			name: "empty conditions",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   ComparisonOperatorAnd,
				Conditions: []Condition{},
			},
			wantErr: true,
		},
		{
			name: "invalid operator",
			cond: ComparisonCondition{
				TypeField:  ConditionTypeComparison,
				Operator:   "xor",
				Conditions: []Condition{idCond},
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.cond.Validate()
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestNestedComparisonCondition(t *testing.T) {
	// Create a nested comparison selector to test depth validation
	idCond := IDCondition{
		TypeField: ConditionTypeID,
		Operator:  "equals",
		Value:     "123",
	}

	// Level 1 comparison
	level1 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorAnd,
		Conditions: []Condition{idCond},
	}

	// Level 2 comparison (should be valid)
	level2 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorOr,
		Conditions: []Condition{level1},
	}

	if err := level2.Validate(); err != nil {
		t.Errorf("Level 2 nested selector should be valid, got error: %v", err)
	}

	// Level 3 comparison
	level3 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorAnd,
		Conditions: []Condition{level2},
	}

	// Level 4 comparison (should exceed max depth)
	level4 := ComparisonCondition{
		TypeField:  ConditionTypeComparison,
		Operator:   ComparisonOperatorAnd,
		Conditions: []Condition{level3},
	}

	if err := level4.Validate(); err == nil {
		t.Error("Level 3 nested selector should exceed max depth, but validation passed")
	}
}
