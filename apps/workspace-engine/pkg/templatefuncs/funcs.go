// Package templatefuncs provides custom template functions that extend
// the standard sprig function library with Helm-like functionality.
//
// Usage:
//
//	import "workspace-engine/pkg/templatefuncs"
//
//	// Simple one-liner for parsing templates
//	t, err := templatefuncs.Parse("myTemplate", templateString)
//
//	// Or create a template for further configuration
//	t := templatefuncs.New("myTemplate")
//	t, err = t.Parse(templateString)
package templatefuncs

import (
	"bytes"
	"text/template"

	"github.com/Masterminds/sprig/v3"
)

// funcs is the package-level function map, initialized once.
var funcs = initFuncMap()

func initFuncMap() template.FuncMap {
	f := sprig.TxtFuncMap()

	// Add custom functions
	// ...

	return f
}

// FuncMap returns a template.FuncMap that includes all sprig text functions
// plus custom Helm-like functions (required, fail, etc.).
func FuncMap() template.FuncMap {
	return funcs
}

// New creates a new template with all custom functions pre-registered
// and standard options applied (missingkey=zero).
//
// This ensures consistent template configuration across the codebase.
func New(name string) *template.Template {
	return template.New(name).Funcs(funcs).Option("missingkey=zero")
}

// Parse is a convenience function that creates and parses a template in one call.
// It applies all custom functions and standard options automatically.
//
// Usage:
//
//	t, err := templatefuncs.Parse("myTemplate", "Hello {{ .Name }}")
func Parse(name, text string) (*template.Template, error) {
	return New(name).Parse(text)
}

// RenderMap recursively walks a map and renders any string values that contain
// Go template syntax (e.g., "{{.workflow.inputs.version}}"). Non-string values
// and strings without templates are left unchanged.
//
// Usage:
//
//	config := map[string]interface{}{
//	    "application": "app-{{.resource.name}}",
//	    "revision":    "{{.workflow.inputs.version}}",
//	    "replicas":    3,  // non-string, left as-is
//	}
//	data := map[string]interface{}{"resource": ..., "workflow": ...}
//	resolved, err := templatefuncs.RenderMap(config, data)
func RenderMap(input map[string]interface{}, data interface{}) (map[string]interface{}, error) {
	result := make(map[string]interface{}, len(input))
	for key, value := range input {
		rendered, err := renderValue(value, data)
		if err != nil {
			return nil, err
		}
		result[key] = rendered
	}
	return result, nil
}

// renderValue recursively renders a single value.
func renderValue(value interface{}, data interface{}) (interface{}, error) {
	switch v := value.(type) {
	case string:
		return renderString(v, data)
	case map[string]interface{}:
		return RenderMap(v, data)
	case []interface{}:
		return renderSlice(v, data)
	default:
		return value, nil
	}
}

// renderString templates a string if it contains template syntax.
func renderString(s string, data interface{}) (string, error) {
	t, err := Parse("inline", s)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// renderSlice recursively renders each element in a slice.
func renderSlice(slice []interface{}, data interface{}) ([]interface{}, error) {
	result := make([]interface{}, len(slice))
	for i, item := range slice {
		rendered, err := renderValue(item, data)
		if err != nil {
			return nil, err
		}
		result[i] = rendered
	}
	return result, nil
}
