package metrics

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"text/template"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
)

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
	json.Unmarshal(data, &result)
	p.mapCache = result
	return p.mapCache
}

func (p *ProviderContext) Template(tmpl string) string {
	if tmpl == "" {
		return tmpl
	}

	data := p.Map()
	t, err := template.New("").Parse(tmpl)
	if err != nil {
		return tmpl
	}

	var buf bytes.Buffer
	if err := t.Execute(&buf, data); err != nil {
		return tmpl
	}

	return buf.String()
}

type Measurement struct {
	MeasuredAt time.Time
	Data       map[string]any
}

// Metric represents a verification metric configuration
type Metric struct {
	Name             string
	Interval         time.Duration
	Count            int    // Number of measurements to take
	SuccessCondition string // CEL expression (e.g., "result.statusCode == 200")
	FailureLimit     int    // Stop after this many failures (0 = no limit)
	Provider         Provider
	evaluator        *Evaluator // CEL evaluator (set after creation)
}

func (m *Metric) Evaluator() *Evaluator {
	if m.evaluator != nil {
		return m.evaluator
	}
	evaluator, err := NewEvaluator(m.SuccessCondition)
	if err != nil {
		log.Error("Failed to create evaluator", "error", err)
		return nil
	}
	m.evaluator = evaluator
	return m.evaluator
}

// SetEvaluator sets the CEL evaluator for this metric
func (m *Metric) SetEvaluator(eval *Evaluator) {
	m.evaluator = eval
}

// Measure takes a measurement and evaluates the success condition
func (m *Metric) Measure(ctx context.Context, providerCtx *ProviderContext) (*Result, error) {
	measurement, err := m.Provider.Measure(ctx, providerCtx)
	if err != nil {
		return nil, err
	}

	message := "Measurement completed"

	// Evaluate success condition
	passed := false
	if m.evaluator != nil {
		passed, err = m.Evaluator().Evaluate(measurement.Data)
		if err != nil {
			message = fmt.Sprintf("Measurement failed: %s", err.Error())
		}
	}

	return &Result{
		Message:     message,
		Passed:      passed,
		Measurement: measurement,
	}, nil
}

// Provider collects raw measurement data
type Provider interface {
	// Measure collects data for evaluation
	Measure(context.Context, *ProviderContext) (*Measurement, error)

	// Type returns provider type (e.g., "http")
	Type() string
}
