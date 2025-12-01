package verification

import (
	"context"
	"workspace-engine/pkg/oapi"
)

type VerificationHooks interface {
	// OnVerificationStarted is called when a verification is created and started
	OnVerificationStarted(ctx context.Context, verification *oapi.ReleaseVerification) error

	// OnMeasurementTaken is called after each metric measurement
	OnMeasurementTaken(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error

	// OnMetricComplete is called when a metric finishes (reached count or failure limit)
	OnMetricComplete(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int) error

	// OnVerificationComplete is called when all metrics complete (passed/failed/cancelled)
	OnVerificationComplete(ctx context.Context, verification *oapi.ReleaseVerification) error

	// OnVerificationStopped is called when a verification is manually stopped
	OnVerificationStopped(ctx context.Context, verification *oapi.ReleaseVerification) error
}

type defaultHooks struct {
}

// OnMeasurementTaken implements VerificationHooks.
func (h *defaultHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	return nil
}

// OnMetricComplete implements VerificationHooks.
func (h *defaultHooks) OnMetricComplete(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int) error {
	return nil
}

// OnVerificationStarted implements VerificationHooks.
func (h *defaultHooks) OnVerificationStarted(ctx context.Context, verification *oapi.ReleaseVerification) error {
	return nil
}

func (h *defaultHooks) OnVerificationComplete(ctx context.Context, verification *oapi.ReleaseVerification) error {
	return nil
}

func (h *defaultHooks) OnVerificationStopped(ctx context.Context, verification *oapi.ReleaseVerification) error {
	return nil
}

func DefaultHooks() VerificationHooks {
	return &defaultHooks{}
}
