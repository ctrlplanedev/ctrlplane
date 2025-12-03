package verification

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewMeasurementRecorder(t *testing.T) {
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	assert.NotNil(t, recorder)
	assert.NotNil(t, recorder.store)
}

func TestRecorder_RecordMeasurement_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1m")

	// Record a measurement
	measurement := oapi.VerificationMeasurement{
		Message:    ptr("Test measurement"),
		Passed:     true,
		MeasuredAt: time.Now(),
		Data:       &map[string]any{"status": "ok"},
	}

	updated, err := recorder.RecordMeasurement(ctx, verification.Id, 0, measurement)

	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Len(t, updated.Metrics[0].Measurements, 1)
	assert.True(t, updated.Metrics[0].Measurements[0].Passed)
}

func TestRecorder_RecordMeasurement_VerificationNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	nonExistentID := uuid.New().String()
	measurement := oapi.VerificationMeasurement{
		Passed:     true,
		MeasuredAt: time.Now(),
	}

	_, err := recorder.RecordMeasurement(ctx, nonExistentID, 0, measurement)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "verification not found")
}

func TestRecorder_RecordMeasurement_MetricIndexOutOfRange(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1m")

	measurement := oapi.VerificationMeasurement{
		Passed:     true,
		MeasuredAt: time.Now(),
	}

	_, err := recorder.RecordMeasurement(ctx, verification.Id, 10, measurement)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "metric index out of range")
}

func TestRecorder_RecordMeasurement_MultipleMeasurements(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1m")

	// Record multiple measurements
	for i := 0; i < 5; i++ {
		measurement := oapi.VerificationMeasurement{
			Message:    ptr("Measurement " + string(rune('1'+i))),
			Passed:     i%2 == 0, // Alternate pass/fail
			MeasuredAt: time.Now(),
		}
		_, err := recorder.RecordMeasurement(ctx, verification.Id, 0, measurement)
		require.NoError(t, err)
	}

	// Verify all measurements were recorded
	updated, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)
	assert.Len(t, updated.Metrics[0].Measurements, 5)
}

func TestRecorder_RecordMeasurement_MultipleMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 3, "1m")

	// Record measurement for each metric
	for i := 0; i < 3; i++ {
		measurement := oapi.VerificationMeasurement{
			Message:    ptr("Measurement for metric " + string(rune('1'+i))),
			Passed:     true,
			MeasuredAt: time.Now(),
		}
		_, err := recorder.RecordMeasurement(ctx, verification.Id, i, measurement)
		require.NoError(t, err)
	}

	// Verify each metric has one measurement
	updated, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)
	for i := 0; i < 3; i++ {
		assert.Len(t, updated.Metrics[i].Measurements, 1)
	}
}

func TestRecorder_RecordError_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1m")

	// Record an error
	testError := errors.New("connection timeout")
	updated, err := recorder.RecordError(ctx, verification.Id, 0, testError)

	require.NoError(t, err)
	require.NotNil(t, updated)
	assert.Len(t, updated.Metrics[0].Measurements, 1)

	errorMeasurement := updated.Metrics[0].Measurements[0]
	assert.False(t, errorMeasurement.Passed)
	assert.Contains(t, *errorMeasurement.Message, "Measurement error")
	assert.Contains(t, *errorMeasurement.Message, "connection timeout")
	assert.NotNil(t, errorMeasurement.Data)
}

func TestRecorder_RecordError_VerificationNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	nonExistentID := uuid.New().String()
	testError := errors.New("some error")

	_, err := recorder.RecordError(ctx, nonExistentID, 0, testError)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "verification not found")
}

func TestRecorder_UpdateMessage_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1m")

	// Update message
	testMessage := "Verification completed: 5/5 measurements passed"
	err := recorder.UpdateMessage(ctx, verification.Id, testMessage)

	require.NoError(t, err)

	// Verify message was updated
	updated, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)
	assert.Equal(t, testMessage, *updated.Message)
}

func TestRecorder_UpdateMessage_VerificationNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	nonExistentID := uuid.New().String()
	err := recorder.UpdateMessage(ctx, nonExistentID, "some message")

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "verification not found")
}

func TestRecorder_ConcurrentRecordMeasurements(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1m")

	// Record measurements concurrently
	var wg sync.WaitGroup
	numGoroutines := 10

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			measurement := oapi.VerificationMeasurement{
				Message:    ptr("Concurrent measurement " + string(rune('0'+idx))),
				Passed:     true,
				MeasuredAt: time.Now(),
			}
			_, err := recorder.RecordMeasurement(ctx, verification.Id, 0, measurement)
			assert.NoError(t, err)
		}(i)
	}

	wg.Wait()

	// Verify all measurements were recorded
	updated, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)
	assert.Len(t, updated.Metrics[0].Measurements, numGoroutines)
}

func TestRecorder_ConcurrentRecordAndUpdate(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 3, "1m")

	var wg sync.WaitGroup

	// Concurrently record measurements to different metrics
	for metricIdx := 0; metricIdx < 3; metricIdx++ {
		for i := 0; i < 5; i++ {
			wg.Add(1)
			go func(mIdx, mNum int) {
				defer wg.Done()
				measurement := oapi.VerificationMeasurement{
					Message:    ptr("Measurement"),
					Passed:     true,
					MeasuredAt: time.Now(),
				}
				_, err := recorder.RecordMeasurement(ctx, verification.Id, mIdx, measurement)
				assert.NoError(t, err)
			}(metricIdx, i)
		}
	}

	// Also update message concurrently
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			err := recorder.UpdateMessage(ctx, verification.Id, "Message update "+string(rune('0'+idx)))
			assert.NoError(t, err)
		}(i)
	}

	wg.Wait()

	// Verify measurements were recorded (order may vary due to concurrency)
	updated, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)
	for i := 0; i < 3; i++ {
		assert.Len(t, updated.Metrics[i].Measurements, 5)
	}
	assert.NotNil(t, updated.Message)
}

func TestRecorder_AppendMeasurement_PreservesExistingMeasurements(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	recorder := NewMeasurementRecorder(s)

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 2, "1m")

	// Record first measurement
	measurement1 := oapi.VerificationMeasurement{
		Message:    ptr("First measurement"),
		Passed:     true,
		MeasuredAt: time.Now(),
	}
	_, err := recorder.RecordMeasurement(ctx, verification.Id, 0, measurement1)
	require.NoError(t, err)

	// Record second measurement to same metric
	measurement2 := oapi.VerificationMeasurement{
		Message:    ptr("Second measurement"),
		Passed:     false,
		MeasuredAt: time.Now(),
	}
	updated, err := recorder.RecordMeasurement(ctx, verification.Id, 0, measurement2)
	require.NoError(t, err)

	// Both measurements should be preserved
	assert.Len(t, updated.Metrics[0].Measurements, 2)
	assert.True(t, updated.Metrics[0].Measurements[0].Passed)
	assert.False(t, updated.Metrics[0].Measurements[1].Passed)

	// Other metric should be unaffected
	assert.Len(t, updated.Metrics[1].Measurements, 0)
}

