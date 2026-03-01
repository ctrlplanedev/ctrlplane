package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/templatefuncs"
)

// ProviderContext provides context information for metric providers
type ProviderContext struct {
	Release     *oapi.Release           `json:"release"`
	Resource    *oapi.Resource          `json:"resource"`
	Environment *oapi.Environment       `json:"environment"`
	Version     *oapi.DeploymentVersion `json:"version"`
	Target      *oapi.ReleaseTarget     `json:"target"`
	Deployment  *oapi.Deployment        `json:"deployment"`
	Variables   map[string]any          `json:"variables"`

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

// Provider collects raw measurement data
type Provider interface {
	// Measure collects data for evaluation
	// Returns the measurement time and data map
	Measure(context.Context, *ProviderContext) (time.Time, map[string]any, error)

	// Type returns provider type (e.g., "http")
	Type() string
}
