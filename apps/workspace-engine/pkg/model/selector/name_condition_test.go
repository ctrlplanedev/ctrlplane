package selector

import (
	"testing"

	"workspace-engine/pkg/model/resource"
)

func TestNameCondition_Validate(t *testing.T) {
	tests := []struct {
		name    string
		cond    NameCondition
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid equals operator",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test-resource",
			},
			wantErr: false,
		},
		{
			name: "valid starts-with operator",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorStartsWith,
				Value:     "test-",
			},
			wantErr: false,
		},
		{
			name: "valid ends-with operator",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEndsWith,
				Value:     "-resource",
			},
			wantErr: false,
		},
		{
			name: "valid contains operator",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorContains,
				Value:     "res",
			},
			wantErr: false,
		},
		{
			name: "invalid type field",
			cond: NameCondition{
				TypeField: ConditionTypeID,
				Operator:  ColumnOperatorEquals,
				Value:     "test",
			},
			wantErr: true,
			errMsg:  "invalid type for name selector: id",
		},
		{
			name: "invalid operator",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  "invalid-operator",
				Value:     "test",
			},
			wantErr: true,
			errMsg:  "invalid column operator: invalid-operator",
		},
		{
			name: "empty value",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "",
			},
			wantErr: true,
			errMsg:  "value cannot be empty",
		},
		{
			name: "whitespace only value",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "   ",
			},
			wantErr: false,
		},
		{
			name: "very long value",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     string(make([]byte, 1000)),
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// result doesn't matter, only testing for validation errors
			_, err := tt.cond.Matches(resourceFixture())
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && tt.errMsg != "" && err.Error() != tt.errMsg {
				t.Errorf("Validate() error message = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestNameCondition_Type(t *testing.T) {
	tests := []struct {
		name     string
		cond     NameCondition
		wantType ConditionType
	}{
		{
			name: "returns correct type",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test",
			},
			wantType: ConditionTypeName,
		},
		{
			name: "returns correct type even with wrong TypeField",
			cond: NameCondition{
				TypeField: ConditionTypeID,
				Operator:  ColumnOperatorEquals,
				Value:     "test",
			},
			wantType: ConditionTypeName,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.cond.Type()
			if got != tt.wantType {
				t.Errorf("Type() = %v, want %v", got, tt.wantType)
			}
		})
	}
}

func TestNameCondition_Matches(t *testing.T) {
	tests := []struct {
		name     string
		cond     NameCondition
		resource resource.Resource
		want     bool
		wantErr  bool
	}{
		{
			name: "equals match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test-resource",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "equals no match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test-resource",
			},
			resource: resource.Resource{
				Name: "other-resource",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "starts-with match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorStartsWith,
				Value:     "test-",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "starts-with no match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorStartsWith,
				Value:     "prod-",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "ends-with match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEndsWith,
				Value:     "-resource",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "ends-with no match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEndsWith,
				Value:     "-service",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "contains match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorContains,
				Value:     "st-res",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "contains no match",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorContains,
				Value:     "xyz",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "case sensitive equals",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "Test-Resource",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "empty resource name",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test",
			},
			resource: resource.Resource{
				Name: "",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "special characters in name",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "test-resource_v1.2.3",
			},
			resource: resource.Resource{
				Name: "test-resource_v1.2.3",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "unicode characters",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEquals,
				Value:     "测试-resource",
			},
			resource: resource.Resource{
				Name: "测试-resource",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "invalid operator should error",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  "invalid",
				Value:     "test",
			},
			resource: resource.Resource{
				Name: "test-resource",
			},
			want:    false,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.cond.Matches(tt.resource)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("Matches() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNameCondition_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		cond     NameCondition
		resource resource.Resource
		want     bool
		wantErr  bool
	}{
		{
			name: "starts-with empty string errors",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorStartsWith,
				Value:     "",
			},
			resource: resource.Resource{
				Name: "any-name",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "ends-with empty string errors",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEndsWith,
				Value:     "",
			},
			resource: resource.Resource{
				Name: "any-name",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "contains empty string errors",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorContains,
				Value:     "",
			},
			resource: resource.Resource{
				Name: "any-name",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "whitespace handling in starts-with",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorStartsWith,
				Value:     " test",
			},
			resource: resource.Resource{
				Name: " test-resource",
			},
			want: true,
		},
		{
			name: "whitespace handling in ends-with",
			cond: NameCondition{
				TypeField: ConditionTypeName,
				Operator:  ColumnOperatorEndsWith,
				Value:     "resource ",
			},
			resource: resource.Resource{
				Name: "test-resource ",
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.cond.Matches(tt.resource)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err == nil && got != tt.want {
				t.Errorf("Matches() = %v, want %v", got, tt.want)
			}
		})
	}
}
