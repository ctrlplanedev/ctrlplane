package sleep

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
)

var _ provider.Provider = (*Provider)(nil)

type Provider struct {
	duration time.Duration
}

func New(duration time.Duration) *Provider {
	return &Provider{duration: duration}
}

func (p *Provider) Type() string {
	return "sleep"
}

func (p *Provider) Measure(_ context.Context, providerCtx *provider.ProviderContext) (time.Time, map[string]any, error) {
	time.Sleep(p.duration)
	return time.Now(), map[string]any{"ok": true}, nil
}

func NewFromOAPI(oapiProvider any) (*Provider, error) {
	type sleepProvider struct {
		DurationSeconds *int32 `json:"durationSeconds"`
	}

	data, err := json.Marshal(oapiProvider)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal provider: %w", err)
	}

	var sp sleepProvider
	if err := json.Unmarshal(data, &sp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal provider: %w", err)
	}

	duration := 30 * time.Second
	if sp.DurationSeconds != nil {
		duration = time.Duration(*sp.DurationSeconds) * time.Second
	}

	return New(duration), nil
}
