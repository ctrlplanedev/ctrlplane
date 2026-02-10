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
