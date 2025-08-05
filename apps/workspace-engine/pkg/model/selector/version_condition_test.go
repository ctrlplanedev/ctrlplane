package selector

import (
	"testing"

	"workspace-engine/pkg/model/resource"
)

func TestVersionCondition_Validate(t *testing.T) {
	tests := []struct {
		name    string
		cond    VersionCondition
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid equals operator",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			wantErr: false,
		},
		{
			name: "valid starts-with operator",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorStartsWith,
				Value:     "1.",
			},
			wantErr: false,
		},
		{
			name: "valid ends-with operator",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEndsWith,
				Value:     ".0",
			},
			wantErr: false,
		},
		{
			name: "valid contains operator",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorContains,
				Value:     "2.1",
			},
			wantErr: false,
		},
		{
			name: "invalid type field",
			cond: VersionCondition{
				TypeField: ConditionTypeID,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			wantErr: true,
			errMsg:  "invalid type for version selector: id",
		},
		{
			name: "invalid operator",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  "invalid-operator",
				Value:     "1.0.0",
			},
			wantErr: true,
			errMsg:  "invalid column operator: invalid-operator",
		},
		{
			name: "empty value",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "",
			},
			wantErr: true,
			errMsg:  "value cannot be empty",
		},
		{
			name: "whitespace only value",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "   ",
			},
			wantErr: false,
		},
		{
			name: "very long value",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     string(make([]byte, 1000)),
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// result doesn't matter, only testing for validation errors
			_, err := tt.cond.Matches(resource.Resource{Version: "1.0.0"})
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && tt.errMsg != "" && err.Error() != tt.errMsg {
				t.Errorf("Validate() error message = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestVersionCondition_Type(t *testing.T) {
	tests := []struct {
		name     string
		cond     VersionCondition
		wantType ConditionType
	}{
		{
			name: "returns correct type",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			wantType: ConditionTypeVersion,
		},
		{
			name: "returns correct type even with wrong TypeField",
			cond: VersionCondition{
				TypeField: ConditionTypeID,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			wantType: ConditionTypeVersion,
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

func TestVersionCondition_Matches(t *testing.T) {
	tests := []struct {
		name     string
		cond     VersionCondition
		resource resource.Resource
		want     bool
		wantErr  bool
	}{
		{
			name: "equals match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			resource: resource.Resource{
				Version: "1.0.0",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "equals no match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			resource: resource.Resource{
				Version: "2.0.0",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "starts-with match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorStartsWith,
				Value:     "1.",
			},
			resource: resource.Resource{
				Version: "1.2.3",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "starts-with no match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorStartsWith,
				Value:     "2.",
			},
			resource: resource.Resource{
				Version: "1.2.3",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "ends-with match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEndsWith,
				Value:     ".3",
			},
			resource: resource.Resource{
				Version: "1.2.3",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "ends-with no match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEndsWith,
				Value:     ".4",
			},
			resource: resource.Resource{
				Version: "1.2.3",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "contains match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorContains,
				Value:     ".2.",
			},
			resource: resource.Resource{
				Version: "1.2.3",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "contains no match",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorContains,
				Value:     ".5.",
			},
			resource: resource.Resource{
				Version: "1.2.3",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "case sensitive equals",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "v1.0.0",
			},
			resource: resource.Resource{
				Version: "V1.0.0",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "empty resource version",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0",
			},
			resource: resource.Resource{
				Version: "",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "semantic version with pre-release",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0-alpha.1",
			},
			resource: resource.Resource{
				Version: "1.0.0-alpha.1",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "semantic version with build metadata",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0+20130313144700",
			},
			resource: resource.Resource{
				Version: "1.0.0+20130313144700",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "version with v prefix",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "v1.0.0",
			},
			resource: resource.Resource{
				Version: "v1.0.0",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "date-based version",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "2023.01.15",
			},
			resource: resource.Resource{
				Version: "2023.01.15",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "commit hash version",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorStartsWith,
				Value:     "abc123",
			},
			resource: resource.Resource{
				Version: "abc123def456",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "unicode characters",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "版本-1.0.0",
			},
			resource: resource.Resource{
				Version: "版本-1.0.0",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "invalid operator should error",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  "invalid",
				Value:     "1.0.0",
			},
			resource: resource.Resource{
				Version: "1.0.0",
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

func TestVersionCondition_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		cond     VersionCondition
		resource resource.Resource
		want     bool
		wantErr  bool
	}{
		{
			name: "starts-with empty string errors",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorStartsWith,
				Value:     "",
			},
			resource: resource.Resource{
				Version: "any-version",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "ends-with empty string errors",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEndsWith,
				Value:     "",
			},
			resource: resource.Resource{
				Version: "any-version",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "contains empty string errors",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorContains,
				Value:     "",
			},
			resource: resource.Resource{
				Version: "any-version",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "whitespace handling in starts-with",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorStartsWith,
				Value:     " 1.0",
			},
			resource: resource.Resource{
				Version: " 1.0.0",
			},
			want: true,
		},
		{
			name: "whitespace handling in ends-with",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEndsWith,
				Value:     ".0 ",
			},
			resource: resource.Resource{
				Version: "1.0.0 ",
			},
			want: true,
		},
		{
			name: "version with special characters",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "1.0.0-beta+exp.sha.5114f85",
			},
			resource: resource.Resource{
				Version: "1.0.0-beta+exp.sha.5114f85",
			},
			want: true,
		},
		{
			name: "version with dots only",
			cond: VersionCondition{
				TypeField: ConditionTypeVersion,
				Operator:  ColumnOperatorEquals,
				Value:     "...",
			},
			resource: resource.Resource{
				Version: "...",
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
