package verification

import (
	"context"
	"fmt"
	"sync"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

// MeasurementRecorder handles storing measurement results in the verification store.
// It provides thread-safe updates to verification records.
type MeasurementRecorder struct {
	store *store.Store
	mu    sync.Mutex
}

// NewMeasurementRecorder creates a new measurement recorder
func NewMeasurementRecorder(store *store.Store) *MeasurementRecorder {
	return &MeasurementRecorder{store: store}
}

// RecordMeasurement safely adds a measurement to a verification's metric.
// Returns the updated verification record.
func (r *MeasurementRecorder) RecordMeasurement(
	ctx context.Context,
	verificationID string,
	metricIndex int,
	measurement oapi.VerificationMeasurement,
) (*oapi.ReleaseVerification, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Verify the verification exists and metric index is valid
	verification, ok := r.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		return nil, fmt.Errorf("verification not found: %s", verificationID)
	}

	if metricIndex >= len(verification.Metrics) {
		return nil, fmt.Errorf("metric index out of range: %d", metricIndex)
	}

	// Update the verification with the new measurement
	updated, _ := r.store.ReleaseVerifications.Update(
		ctx, verificationID, func(v *oapi.ReleaseVerification) *oapi.ReleaseVerification {
			return r.appendMeasurement(v, metricIndex, measurement)
		},
	)

	return updated, nil
}

// RecordError safely adds an error measurement to a verification's metric.
// Returns the updated verification record.
func (r *MeasurementRecorder) RecordError(
	ctx context.Context,
	verificationID string,
	metricIndex int,
	err error,
) (*oapi.ReleaseVerification, error) {
	errorMsg := fmt.Sprintf("Measurement error: %s", err.Error())
	errorData := map[string]any{"error": err.Error()}

	measurement := oapi.VerificationMeasurement{
		Message:    &errorMsg,
		Passed:     false,
		MeasuredAt: time.Now(),
		Data:       &errorData,
	}

	return r.RecordMeasurement(ctx, verificationID, metricIndex, measurement)
}

// UpdateMessage updates the verification's summary message.
func (r *MeasurementRecorder) UpdateMessage(
	ctx context.Context,
	verificationID string,
	message string,
) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	verification, ok := r.store.ReleaseVerifications.Get(verificationID)
	if !ok {
		return fmt.Errorf("verification not found: %s", verificationID)
	}

	verification.Message = &message
	r.store.ReleaseVerifications.Upsert(ctx, verification)

	return nil
}

// appendMeasurement creates a deep copy of the verification and appends the measurement.
// This avoids race conditions when multiple goroutines update the same verification.
func (r *MeasurementRecorder) appendMeasurement(
	v *oapi.ReleaseVerification,
	metricIndex int,
	measurement oapi.VerificationMeasurement,
) *oapi.ReleaseVerification {
	// Make a deep copy to avoid race conditions
	updated := *v
	updated.Metrics = make([]oapi.VerificationMetricStatus, len(v.Metrics))

	for i := range v.Metrics {
		updated.Metrics[i] = v.Metrics[i]
		// Copy measurements slice
		updated.Metrics[i].Measurements = make(
			[]oapi.VerificationMeasurement,
			len(v.Metrics[i].Measurements),
		)
		copy(updated.Metrics[i].Measurements, v.Metrics[i].Measurements)
	}

	// Append the new measurement
	updated.Metrics[metricIndex].Measurements = append(
		updated.Metrics[metricIndex].Measurements,
		measurement,
	)

	return &updated
}
