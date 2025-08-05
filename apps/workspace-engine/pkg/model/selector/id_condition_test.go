package selector

import (
	"testing"

	"workspace-engine/pkg/model/resource"
)

func TestIDCondition_Type(t *testing.T) {
	tests := []struct {
		name     string
		cond     IDCondition
		wantType ConditionType
	}{
		{
			name: "returns correct type",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "test-id",
			},
			wantType: ConditionTypeID,
		},
		{
			name: "returns correct type even with wrong TypeField",
			cond: IDCondition{
				TypeField: ConditionTypeName,
				Operator:  IdOperatorEquals,
				Value:     "test-id",
			},
			wantType: ConditionTypeID,
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

func TestIDCondition_Validate(t *testing.T) {
	tests := []struct {
		name    string
		cond    IDCondition
		wantErr bool
		errMsg  string
	}{
		{
			name: "valid ID condition",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "test-id-123",
			},
			wantErr: false,
		},
		{
			name: "invalid type field",
			cond: IDCondition{
				TypeField: ConditionTypeName,
				Operator:  IdOperatorEquals,
				Value:     "test-id",
			},
			wantErr: true,
			errMsg:  "invalid type for ID selector: name",
		},
		{
			name: "invalid operator",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  "not-equals",
				Value:     "test-id",
			},
			wantErr: true,
			errMsg:  "ID selector only supports 'equals' operator, got: not-equals",
		},
		{
			name: "empty value",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "",
			},
			wantErr: true,
			errMsg:  "value cannot be empty",
		},
		{
			name: "whitespace only value is allowed",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "   ",
			},
			wantErr: false,
		},
		{
			name: "very long ID value",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     string(make([]byte, 1000)),
			},
			wantErr: false,
		},
		{
			name: "special characters in ID",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "test-id_123.456:789",
			},
			wantErr: false,
		},
		{
			name: "unicode characters in ID",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "测试-id-123",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// result doesn't matter, only testing for validation errors
			_, err := tt.cond.Matches(resourceFixture())
			if (err != nil) != tt.wantErr {
				t.Errorf("Match() error = %v, wantErr %v", err, tt.wantErr)
			}
			if err != nil && tt.errMsg != "" && err.Error() != tt.errMsg {
				t.Errorf("Match() error message = %v, want %v", err.Error(), tt.errMsg)
			}
		})
	}
}

func TestIDCondition_Matches(t *testing.T) {
	tests := []struct {
		name     string
		cond     IDCondition
		resource resource.Resource
		want     bool
		wantErr  bool
		errMsg   string
	}{
		{
			name: "equals match",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "test-id-123",
			},
			resource: resource.Resource{
				ID: "test-id-123",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "equals no match",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "test-id-123",
			},
			resource: resource.Resource{
				ID: "other-id-456",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "case sensitive match",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "Test-ID-123",
			},
			resource: resource.Resource{
				ID: "test-id-123",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "empty resource ID",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "test-id",
			},
			resource: resource.Resource{
				ID: "",
			},
			want:    false,
			wantErr: false,
		},
		{
			name: "empty condition value errors",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "",
			},
			resource: resource.Resource{
				ID: "",
			},
			want:    false,
			wantErr: true,
		},
		{
			name: "special characters match",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "id-with_special.chars:123",
			},
			resource: resource.Resource{
				ID: "id-with_special.chars:123",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "unicode characters match",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "测试-id-123",
			},
			resource: resource.Resource{
				ID: "测试-id-123",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "whitespace in ID",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     " test-id ",
			},
			resource: resource.Resource{
				ID: " test-id ",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "invalid operator should error",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  "invalid-operator",
				Value:     "test-id",
			},
			resource: resource.Resource{
				ID: "test-id",
			},
			want:    false,
			wantErr: true,
			errMsg:  "ID selector only supports 'equals' operator, got: invalid-operator",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := tt.cond.Matches(tt.resource)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if err != nil && tt.errMsg != "" && err.Error() != tt.errMsg {
				t.Errorf("Matches() error message = %v, want %v", err.Error(), tt.errMsg)
			}
			if got != tt.want {
				t.Errorf("Matches() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIDCondition_EdgeCases(t *testing.T) {
	tests := []struct {
		name     string
		cond     IDCondition
		resource resource.Resource
		want     bool
		wantErr  bool
	}{
		{
			name: "very long ID match",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "this-is-a-very-long-id-that-might-be-used-in-some-systems-with-uuid-like-structure-123456789",
			},
			resource: resource.Resource{
				ID: "this-is-a-very-long-id-that-might-be-used-in-some-systems-with-uuid-like-structure-123456789",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "UUID format ID",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "550e8400-e29b-41d4-a716-446655440000",
			},
			resource: resource.Resource{
				ID: "550e8400-e29b-41d4-a716-446655440000",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "numeric only ID",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "123456789",
			},
			resource: resource.Resource{
				ID: "123456789",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "ID with newlines",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "id-with\nnewline",
			},
			resource: resource.Resource{
				ID: "id-with\nnewline",
			},
			want:    true,
			wantErr: false,
		},
		{
			name: "ID with tabs",
			cond: IDCondition{
				TypeField: ConditionTypeID,
				Operator:  IdOperatorEquals,
				Value:     "id-with\ttab",
			},
			resource: resource.Resource{
				ID: "id-with\ttab",
			},
			want:    true,
			wantErr: false,
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
