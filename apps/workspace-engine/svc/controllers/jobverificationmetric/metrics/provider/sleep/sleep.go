package sleep

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"
)

var _ provider.Provider = (*Provider)(nil)

type config struct {
	DurationSeconds *int32 `json:"durationSeconds"`
}

type Provider struct {
	duration time.Duration
}

func New(duration time.Duration) *Provider {
	return &Provider{duration: duration}
}

func NewFromJSON(data json.RawMessage) (*Provider, error) {
	var c config
	if err := json.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("failed to unmarshal sleep provider: %w", err)
	}

	duration := 30 * time.Second
	if c.DurationSeconds != nil {
		duration = time.Duration(*c.DurationSeconds) * time.Second
	}

	return New(duration), nil
}

func (p *Provider) Type() string { return "sleep" }

func (p *Provider) Measure(_ context.Context, _ *provider.ProviderContext) (time.Time, map[string]any, error) {
	time.Sleep(p.duration)
	return time.Now(), map[string]any{"ok": true}, nil
}
