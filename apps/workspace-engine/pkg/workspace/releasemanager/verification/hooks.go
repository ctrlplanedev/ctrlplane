package verification

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type VerificationHooks interface {
	// OnVerificationStarted is called when a verification is created and started
	OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) error

	// OnMeasurementTaken is called after each metric measurement
	OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error

	// OnMetricComplete is called when a metric finishes (reached count or failure limit)
	OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) error

	// OnVerificationComplete is called when all metrics complete (passed/failed/cancelled)
	OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) error

	// OnVerificationStopped is called when a verification is manually stopped
	OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) error
}

type defaultHooks struct {
}

// OnMeasurementTaken implements VerificationHooks.
func (h *defaultHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	return nil
}

// OnMetricComplete implements VerificationHooks.
func (h *defaultHooks) OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) error {
	return nil
}

// OnVerificationStarted implements VerificationHooks.
func (h *defaultHooks) OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) error {
	return nil
}

func (h *defaultHooks) OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) error {
	return nil
}

func (h *defaultHooks) OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) error {
	return nil
}

func DefaultHooks() VerificationHooks {
	return &defaultHooks{}
}

// CompositeHooks combines multiple VerificationHooks implementations.
// All hooks are called in order; errors are logged but don't stop subsequent hooks.
type CompositeHooks struct {
	hooks []VerificationHooks
}

// NewCompositeHooks creates a new CompositeHooks that runs all provided hooks.
func NewCompositeHooks(hooks ...VerificationHooks) *CompositeHooks {
	return &CompositeHooks{hooks: hooks}
}

// OnVerificationStarted calls OnVerificationStarted on all hooks.
func (c *CompositeHooks) OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) (e error) {
	for _, h := range c.hooks {
		if err := h.OnVerificationStarted(ctx, verification); err != nil {
			e = err
		}
	}
	return
}

// OnMeasurementTaken calls OnMeasurementTaken on all hooks.
func (c *CompositeHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) (e error) {
	for _, h := range c.hooks {
		if err := h.OnMeasurementTaken(ctx, verification, metricIndex, measurement); err != nil {
			e = err
		}
	}
	return
}

// OnMetricComplete calls OnMetricComplete on all hooks.
func (c *CompositeHooks) OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) (e error) {
	for _, h := range c.hooks {
		if err := h.OnMetricComplete(ctx, verification, metricIndex); err != nil {
			e = err
		}
	}
	return
}

// OnVerificationComplete calls OnVerificationComplete on all hooks.
func (c *CompositeHooks) OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) (e error) {
	for _, h := range c.hooks {
		if err := h.OnVerificationComplete(ctx, verification); err != nil {
			e = err
		}
	}
	return
}

// OnVerificationStopped calls OnVerificationStopped on all hooks.
func (c *CompositeHooks) OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) (e error) {
	for _, h := range c.hooks {
		if err := h.OnVerificationStopped(ctx, verification); err != nil {
			e = err
		}
	}
	return
}
