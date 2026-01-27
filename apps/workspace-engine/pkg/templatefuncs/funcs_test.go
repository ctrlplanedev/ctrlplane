package templatefuncs

import (
	"bytes"
	"reflect"
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

func TestRenderMap(t *testing.T) {
	tests := []struct {
		name        string
		input       map[string]interface{}
		data        interface{}
		want        map[string]interface{}
		wantErr     bool
		errContains string
	}{
		{
			name: "simple string template",
			input: map[string]interface{}{
				"application": "app-{{.resource.name}}",
			},
			data: map[string]interface{}{
				"resource": map[string]interface{}{
					"name": "my-service",
				},
			},
			want: map[string]interface{}{
				"application": "app-my-service",
			},
		},
		{
			name: "multiple templates",
			input: map[string]interface{}{
				"application": "app-{{.resource.name}}",
				"revision":    "{{.workflow.inputs.version}}",
				"namespace":   "{{.resource.config.namespace}}",
			},
			data: map[string]interface{}{
				"resource": map[string]interface{}{
					"name": "my-service",
					"config": map[string]interface{}{
						"namespace": "production",
					},
				},
				"workflow": map[string]interface{}{
					"inputs": map[string]interface{}{
						"version": "v1.2.3",
					},
				},
			},
			want: map[string]interface{}{
				"application": "app-my-service",
				"revision":    "v1.2.3",
				"namespace":   "production",
			},
		},
		{
			name: "non-string values unchanged",
			input: map[string]interface{}{
				"name":     "{{.resource.name}}",
				"replicas": 3,
				"enabled":  true,
				"ratio":    0.5,
			},
			data: map[string]interface{}{
				"resource": map[string]interface{}{
					"name": "my-service",
				},
			},
			want: map[string]interface{}{
				"name":     "my-service",
				"replicas": 3,
				"enabled":  true,
				"ratio":    0.5,
			},
		},
		{
			name: "nested map with templates",
			input: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":      "{{.resource.name}}",
					"namespace": "{{.resource.namespace}}",
				},
				"spec": map[string]interface{}{
					"replicas": 3,
				},
			},
			data: map[string]interface{}{
				"resource": map[string]interface{}{
					"name":      "my-app",
					"namespace": "default",
				},
			},
			want: map[string]interface{}{
				"metadata": map[string]interface{}{
					"name":      "my-app",
					"namespace": "default",
				},
				"spec": map[string]interface{}{
					"replicas": 3,
				},
			},
		},
		{
			name: "slice with templates",
			input: map[string]interface{}{
				"args": []interface{}{
					"--name={{.resource.name}}",
					"--env={{.environment}}",
					"--debug",
				},
			},
			data: map[string]interface{}{
				"resource": map[string]interface{}{
					"name": "my-service",
				},
				"environment": "production",
			},
			want: map[string]interface{}{
				"args": []interface{}{
					"--name=my-service",
					"--env=production",
					"--debug",
				},
			},
		},
		{
			name: "string without template unchanged",
			input: map[string]interface{}{
				"static":  "no-template-here",
				"dynamic": "has-{{.value}}",
			},
			data: map[string]interface{}{
				"value": "replaced",
			},
			want: map[string]interface{}{
				"static":  "no-template-here",
				"dynamic": "has-replaced",
			},
		},
		{
			name: "missing top-level key renders as <no value>",
			input: map[string]interface{}{
				"value": "prefix-{{.missing}}-suffix",
			},
			data: map[string]interface{}{},
			want: map[string]interface{}{
				"value": "prefix-<no value>-suffix",
			},
		},
		{
			name: "nested access on nil errors",
			input: map[string]interface{}{
				"value": "{{.missing.nested}}",
			},
			data:        map[string]interface{}{},
			wantErr:     true,
			errContains: "nil pointer",
		},
		{
			name: "sprig functions work",
			input: map[string]interface{}{
				"upper": "{{.name | upper}}",
				"lower": "{{.name | lower}}",
			},
			data: map[string]interface{}{
				"name": "MyService",
			},
			want: map[string]interface{}{
				"upper": "MYSERVICE",
				"lower": "myservice",
			},
		},
		{
			name:  "empty map returns empty map",
			input: map[string]interface{}{},
			data:  map[string]interface{}{},
			want:  map[string]interface{}{},
		},
		{
			name: "nil values preserved",
			input: map[string]interface{}{
				"name":  "{{.resource.name}}",
				"other": nil,
			},
			data: map[string]interface{}{
				"resource": map[string]interface{}{
					"name": "test",
				},
			},
			want: map[string]interface{}{
				"name":  "test",
				"other": nil,
			},
		},
		{
			name: "invalid template syntax",
			input: map[string]interface{}{
				"bad": "{{.unclosed",
			},
			data:        map[string]interface{}{},
			wantErr:     true,
			errContains: "unclosed action",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := RenderMap(tt.input, tt.data)

			if tt.wantErr {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.errContains)
					return
				}
				if !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("expected error containing %q, got %q", tt.errContains, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("RenderMap() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRenderMap_DoesNotMutateInput(t *testing.T) {
	input := map[string]interface{}{
		"name": "{{.value}}",
		"nested": map[string]interface{}{
			"inner": "{{.other}}",
		},
	}
	data := map[string]interface{}{
		"value": "replaced",
		"other": "also-replaced",
	}

	// Store original values
	originalName := input["name"]
	originalNested := input["nested"].(map[string]interface{})["inner"]

	result, err := RenderMap(input, data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Verify result is correct
	if result["name"] != "replaced" {
		t.Errorf("expected result name to be 'replaced', got %v", result["name"])
	}

	// Verify input was not mutated
	if input["name"] != originalName {
		t.Errorf("input was mutated: name changed from %q to %q", originalName, input["name"])
	}
	if input["nested"].(map[string]interface{})["inner"] != originalNested {
		t.Errorf("input was mutated: nested.inner changed")
	}
}
