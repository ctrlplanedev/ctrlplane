package jobs

import (
	"bytes"
	"fmt"
	"strings"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
)

// renderJobAgentConfig walks the job agent config and renders every string
// value that contains a Go template directive (`{{`) against the dispatch
// context. Maps and slices are recursed into. Non-string scalars (numbers,
// booleans, nil) pass through unchanged. The original config is left
// untouched; a new map is returned so the job agent receives a config with
// secrets already resolved.
//
// Strings that do not contain `{{` are returned verbatim — this avoids
// surprising changes for configs that legitimately include double braces in
// non-template content, and lets template render failures surface only when
// the operator intentionally used template syntax.
func renderJobAgentConfig(
	cfg oapi.JobAgentConfig,
	dispatchCtx *oapi.DispatchContext,
) (oapi.JobAgentConfig, error) {
	if len(cfg) == 0 {
		return cfg, nil
	}
	data := dispatchCtx.Map()
	// oapi.JobAgentConfig is a named map type; the type switch in
	// renderValue matches map[string]any literally, so convert to the
	// unnamed form before recursing.
	asMap := map[string]any(cfg)
	rendered, err := renderValue(asMap, data, "")
	if err != nil {
		return nil, err
	}
	out, ok := rendered.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("job agent config: rendered value is not a map")
	}
	return oapi.JobAgentConfig(out), nil
}

// renderValue walks any JSON-shaped value (string / number / bool / nil /
// []any / map[string]any) and renders string leaves containing `{{`. The
// path argument is used to label template parse / execute errors.
func renderValue(v any, data map[string]any, path string) (any, error) {
	switch t := v.(type) {
	case string:
		if !strings.Contains(t, "{{") {
			return t, nil
		}
		return renderString(t, data, path)
	case map[string]any:
		out := make(map[string]any, len(t))
		for k, child := range t {
			childPath := joinPath(path, k)
			rendered, err := renderValue(child, data, childPath)
			if err != nil {
				return nil, err
			}
			out[k] = rendered
		}
		return out, nil
	case []any:
		out := make([]any, len(t))
		for i, child := range t {
			childPath := fmt.Sprintf("%s[%d]", path, i)
			rendered, err := renderValue(child, data, childPath)
			if err != nil {
				return nil, err
			}
			out[i] = rendered
		}
		return out, nil
	default:
		return v, nil
	}
}

func renderString(tmpl string, data map[string]any, path string) (string, error) {
	t, err := templatefuncs.Parse("jobAgentConfig:"+path, tmpl)
	if err != nil {
		return "", fmt.Errorf("job agent config %q: parse template: %w", path, err)
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("job agent config %q: execute template: %w", path, err)
	}
	return buf.String(), nil
}

func joinPath(path, key string) string {
	if path == "" {
		return key
	}
	return path + "." + key
}
