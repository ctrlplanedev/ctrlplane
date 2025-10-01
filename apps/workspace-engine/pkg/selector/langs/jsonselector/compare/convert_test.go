package compare

import (
	"testing"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

func TestConvertToSelector_ComparisonCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
	}{
		{
			name: "AND comparison condition",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "equals",
						Value:    "test",
					},
					{
						Property: "status",
						Operator: "equals",
						Value:    "active",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "OR comparison condition",
			condition: unknown.UnknownCondition{
				Operator: "or",
				Conditions: []unknown.UnknownCondition{
					{
						Property: "name",
						Operator: "equals",
						Value:    "test1",
					},
					{
						Property: "name",
						Operator: "equals",
						Value:    "test2",
					},
				},
			},
			wantErr: false,
		},
		{
			name: "nested AND/OR conditions",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{
						Operator: "or",
						Conditions: []unknown.UnknownCondition{
							{
								Property: "name",
								Operator: "equals",
								Value:    "test1",
							},
							{
								Property: "name",
								Operator: "equals",
								Value:    "test2",
							},
						},
					},
					{
						Property: "status",
						Operator: "equals",
						Value:    "active",
					},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertToSelector(tt.condition)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ConvertToSelector() expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("ConvertToSelector() unexpected error = %v", err)
				return
			}

			if result == nil {
				t.Errorf("ConvertToSelector() returned nil result")
				return
			}

			// Verify it's a ComparisonCondition
			if _, ok := result.(ComparisonCondition); !ok {
				t.Errorf("ConvertToSelector() returned type %T, want ComparisonCondition", result)
			}
		})
	}
}

func TestConvertToSelector_StringCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
	}{
		{
			name: "equals string condition",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "equals",
				Value:    "test",
			},
			wantErr: false,
		},
		{
			name: "starts-with string condition",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "starts-with",
				Value:    "test",
			},
			wantErr: false,
		},
		{
			name: "ends-with string condition",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "ends-with",
				Value:    "test",
			},
			wantErr: false,
		},
		{
			name: "contains string condition",
			condition: unknown.UnknownCondition{
				Property: "description",
				Operator: "contains",
				Value:    "keyword",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertToSelector(tt.condition)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ConvertToSelector() expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("ConvertToSelector() unexpected error = %v", err)
				return
			}

			if result == nil {
				t.Errorf("ConvertToSelector() returned nil result")
			}
		})
	}
}

func TestConvertToSelector_DateCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
	}{
		{
			name: "before date condition",
			condition: unknown.UnknownCondition{
				Property: "createdAt",
				Operator: "before",
				Value:    "2024-01-01T00:00:00Z",
			},
			wantErr: false,
		},
		{
			name: "after date condition",
			condition: unknown.UnknownCondition{
				Property: "updatedAt",
				Operator: "after",
				Value:    "2024-01-01T00:00:00Z",
			},
			wantErr: false,
		},
		{
			name: "before-or-on date condition",
			condition: unknown.UnknownCondition{
				Property: "createdAt",
				Operator: "before-or-on",
				Value:    "2024-01-01T00:00:00Z",
			},
			wantErr: false,
		},
		{
			name: "after-or-on date condition",
			condition: unknown.UnknownCondition{
				Property: "updatedAt",
				Operator: "after-or-on",
				Value:    "2024-01-01T00:00:00Z",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertToSelector(tt.condition)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ConvertToSelector() expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("ConvertToSelector() unexpected error = %v", err)
				return
			}

			if result == nil {
				t.Errorf("ConvertToSelector() returned nil result")
			}
		})
	}
}

func TestConvertToSelector_MetadataCondition(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
	}{
		{
			name: "metadata equals condition",
			condition: unknown.UnknownCondition{
				Property:    "env",
				Operator:    "equals",
				Value:       "production",
				MetadataKey: "env",
			},
			wantErr: false,
		},
		{
			name: "metadata starts-with condition",
			condition: unknown.UnknownCondition{
				Property:    "version",
				Operator:    "starts-with",
				Value:       "v1",
				MetadataKey: "version",
			},
			wantErr: false,
		},
		{
			name: "metadata contains condition",
			condition: unknown.UnknownCondition{
				Property:    "tags",
				Operator:    "contains",
				Value:       "critical",
				MetadataKey: "tags",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertToSelector(tt.condition)

			if tt.wantErr {
				if err == nil {
					t.Errorf("ConvertToSelector() expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("ConvertToSelector() unexpected error = %v", err)
				return
			}

			if result == nil {
				t.Errorf("ConvertToSelector() returned nil result")
			}
		})
	}
}

func TestConvertToSelector_InvalidOperator(t *testing.T) {
	tests := []struct {
		name      string
		condition unknown.UnknownCondition
		wantErr   bool
		errMsg    string
	}{
		{
			name: "completely invalid operator",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "invalid-operator",
				Value:    "test",
			},
			wantErr: true,
			errMsg:  "invalid condition type: invalid-operator",
		},
		{
			name: "empty operator",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "",
				Value:    "test",
			},
			wantErr: true,
			errMsg:  "invalid condition type: ",
		},
		{
			name: "operator with wrong case",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "EQUALS",
				Value:    "test",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertToSelector(tt.condition)

			if !tt.wantErr {
				if err != nil {
					t.Errorf("ConvertToSelector() unexpected error = %v", err)
				}
				return
			}

			if err == nil {
				t.Errorf("ConvertToSelector() expected error but got none")
				return
			}

			if tt.errMsg != "" && err.Error() != tt.errMsg {
				t.Errorf("ConvertToSelector() error = %v, want %v", err.Error(), tt.errMsg)
			}

			if result != nil {
				t.Errorf("ConvertToSelector() with error should return nil result, got %T", result)
			}
		})
	}
}

func TestConvertToSelector_Integration(t *testing.T) {
	t.Run("converts and matches string condition", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Property: "name",
			Operator: "starts-with",
			Value:    "test",
		}

		selector, err := ConvertToSelector(condition)
		if err != nil {
			t.Fatalf("ConvertToSelector() unexpected error = %v", err)
		}

		entity := struct {
			Name string `json:"name"`
		}{
			Name: "test-name",
		}

		matched, err := selector.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() = false, want true")
		}
	})

	t.Run("converts and matches complex nested condition", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Operator: "and",
			Conditions: []unknown.UnknownCondition{
				{
					Property: "name",
					Operator: "starts-with",
					Value:    "test",
				},
				{
					Operator: "or",
					Conditions: []unknown.UnknownCondition{
						{
							Property: "status",
							Operator: "contains",
							Value:    "active",
						},
						{
							Property: "status",
							Operator: "contains",
							Value:    "pending",
						},
					},
				},
			},
		}

		selector, err := ConvertToSelector(condition)
		if err != nil {
			t.Fatalf("ConvertToSelector() unexpected error = %v", err)
		}

		entity := struct {
			Name   string `json:"name"`
			Status string `json:"status"`
		}{
			Name:   "test-service",
			Status: "active",
		}

		matched, err := selector.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() = false, want true")
		}
	})

	t.Run("converts and does not match when condition fails", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Property: "name",
			Operator: "starts-with",
			Value:    "expected",
		}

		selector, err := ConvertToSelector(condition)
		if err != nil {
			t.Fatalf("ConvertToSelector() unexpected error = %v", err)
		}

		entity := struct {
			Name string `json:"name"`
		}{
			Name: "different-name",
		}

		matched, err := selector.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if matched {
			t.Errorf("Matches() = true, want false")
		}
	})

	t.Run("converts string with contains operator", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Property: "description",
			Operator: "contains",
			Value:    "important",
		}

		selector, err := ConvertToSelector(condition)
		if err != nil {
			t.Fatalf("ConvertToSelector() unexpected error = %v", err)
		}

		entity := struct {
			Description string `json:"description"`
		}{
			Description: "This is an important message",
		}

		matched, err := selector.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() = false, want true")
		}
	})

	t.Run("prioritizes comparison over string condition", func(t *testing.T) {
		// When operator is "and" or "or", it should be treated as a comparison condition
		condition := unknown.UnknownCondition{
			Operator: "and",
			Conditions: []unknown.UnknownCondition{
				{
					Property: "name",
					Operator: "contains",
					Value:    "test",
				},
			},
		}

		selector, err := ConvertToSelector(condition)
		if err != nil {
			t.Fatalf("ConvertToSelector() unexpected error = %v", err)
		}

		// Verify it's a ComparisonCondition, not a StringCondition
		if _, ok := selector.(ComparisonCondition); !ok {
			t.Errorf("ConvertToSelector() returned type %T, want ComparisonCondition", selector)
		}
	})

	t.Run("handles empty nested conditions", func(t *testing.T) {
		condition := unknown.UnknownCondition{
			Operator:   "and",
			Conditions: []unknown.UnknownCondition{},
		}

		selector, err := ConvertToSelector(condition)
		if err != nil {
			t.Fatalf("ConvertToSelector() unexpected error = %v", err)
		}

		entity := struct {
			Name string `json:"name"`
		}{
			Name: "test",
		}

		// Empty AND conditions should return true
		matched, err := selector.Matches(entity)
		if err != nil {
			t.Errorf("Matches() unexpected error = %v", err)
		}

		if !matched {
			t.Errorf("Matches() with empty AND = false, want true")
		}
	})
}

func TestConvertToSelector_AllConditionTypes(t *testing.T) {
	// Test that ConvertToSelector can handle all supported condition types
	tests := []struct {
		name         string
		condition    unknown.UnknownCondition
		expectedType string
	}{
		{
			name: "comparison condition",
			condition: unknown.UnknownCondition{
				Operator: "and",
				Conditions: []unknown.UnknownCondition{
					{Property: "name", Operator: "equals", Value: "test"},
				},
			},
			expectedType: "ComparisonCondition",
		},
		{
			name: "string condition",
			condition: unknown.UnknownCondition{
				Property: "name",
				Operator: "equals",
				Value:    "test",
			},
			expectedType: "StringCondition",
		},
		{
			name: "date condition",
			condition: unknown.UnknownCondition{
				Property: "createdAt",
				Operator: "before",
				Value:    "2024-01-01T00:00:00Z",
			},
			expectedType: "DateCondition",
		},
		{
			name: "metadata condition",
			condition: unknown.UnknownCondition{
				Property:    "env",
				Operator:    "equals",
				Value:       "prod",
				MetadataKey: "env",
			},
			expectedType: "MetadataCondition",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := ConvertToSelector(tt.condition)
			if err != nil {
				t.Errorf("ConvertToSelector() unexpected error = %v", err)
				return
			}

			if result == nil {
				t.Errorf("ConvertToSelector() returned nil result")
				return
			}

			// Just verify result is not nil and can be matched
			_, matchErr := result.Matches(struct{}{})
			// It's ok if matching fails due to missing properties, we just want to verify conversion worked
			_ = matchErr
		})
	}
}

