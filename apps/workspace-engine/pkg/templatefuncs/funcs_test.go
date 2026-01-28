package templatefuncs

import (
	"bytes"
	"strings"
	"testing"
)

func TestFailFunction(t *testing.T) {
	tests := []struct {
		name        string
		template    string
		data        any
		wantErr     bool
		errContains string
	}{
		{
			name:        "fail with static message",
			template:    `{{ fail "this should fail" }}`,
			data:        nil,
			wantErr:     true,
			errContains: "this should fail",
		},
		{
			name:        "fail with dynamic message",
			template:    `{{ fail (printf "missing required field: %s" "namespace") }}`,
			data:        nil,
			wantErr:     true,
			errContains: "missing required field: namespace",
		},
		{
			name:        "conditional fail - should fail",
			template:    `{{ if not .enabled }}{{ fail "feature must be enabled" }}{{ end }}`,
			data:        map[string]any{"enabled": false},
			wantErr:     true,
			errContains: "feature must be enabled",
		},
		{
			name:     "conditional fail - should not fail",
			template: `{{ if not .enabled }}{{ fail "feature must be enabled" }}{{ end }}OK`,
			data:     map[string]any{"enabled": true},
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tmpl, err := Parse("test", tt.template)
			if err != nil {
				t.Fatalf("failed to parse template: %v", err)
			}

			var buf bytes.Buffer
			err = tmpl.Execute(&buf, tt.data)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errContains)
					return
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("expected error containing %q, got %q", tt.errContains, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("unexpected error: %v", err)
				}
			}
		})
	}
}
