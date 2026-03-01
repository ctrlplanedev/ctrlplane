package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"time"
	"workspace-engine/pkg/templatefuncs"
)

// ProviderContext provides context information for metric providers.
// Fields use map[string]any so templates (e.g. {{.resource.name}})
// resolve against camelCase JSON keys regardless of the upstream source.
type ProviderContext struct {
	Release     map[string]any `json:"release"`
	Resource    map[string]any `json:"resource"`
	Environment map[string]any `json:"environment"`
	Version     map[string]any `json:"version"`
	Target      map[string]any `json:"target"`
	Deployment  map[string]any `json:"deployment"`
	Variables   map[string]any `json:"variables"`

	mapCache map[string]any `json:"-"`
}

func (p *ProviderContext) Map() map[string]any {
	if p.mapCache != nil {
		return p.mapCache
	}
	data, _ := json.Marshal(p)
	var result map[string]any
	_ = json.Unmarshal(data, &result)
	p.mapCache = result
	return p.mapCache
}

func (p *ProviderContext) Template(tmpl string) string {
	if tmpl == "" {
		return tmpl
	}

	data := p.Map()
	t, err := templatefuncs.Parse("template", tmpl)
	if err != nil {
		return tmpl
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return tmpl
	}

	return buf.String()
}

// Provider collects raw measurement data.
type Provider interface {
	Measure(context.Context, *ProviderContext) (time.Time, map[string]any, error)
	Type() string
}
