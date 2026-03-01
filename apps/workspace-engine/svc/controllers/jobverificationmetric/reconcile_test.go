package jobverificationmetric

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/reconcile"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	mu sync.Mutex

	metrics     map[string]*metrics.VerificationMetric
	providerCtx *provider.ProviderContext

	getMetricErr       error
	getMetricCallCount int
	getMetricErrOnCall int // fail on the Nth call (1-indexed), 0 = never
	getProviderCtxErr  error
}

func (g *mockGetter) GetVerificationMetric(_ context.Context, id string) (*metrics.VerificationMetric, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.getMetricCallCount++
	if g.getMetricErrOnCall > 0 && g.getMetricCallCount == g.getMetricErrOnCall {
		return nil, g.getMetricErr
	}
	if g.getMetricErrOnCall == 0 && g.getMetricErr != nil {
		return nil, g.getMetricErr
	}
	return g.metrics[id], nil
}

func (g *mockGetter) GetProviderContext(_ context.Context, _ string) (*provider.ProviderContext, error) {
	if g.getProviderCtxErr != nil {
		return nil, g.getProviderCtxErr
	}
	return g.providerCtx, nil
}

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type recordedMeasurement struct {
	MetricID    string
	Measurement metrics.Measurement
}

type mockSetter struct {
	mu sync.Mutex

	measurements []recordedMeasurement
	completed    map[string]metrics.VerificationStatus

	recordErr   error
	completeErr error

	getter *mockGetter
}

func (s *mockSetter) RecordMeasurement(_ context.Context, metricID string, measurement metrics.Measurement) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.recordErr != nil {
		return s.recordErr
	}
	s.measurements = append(s.measurements, recordedMeasurement{
		MetricID:    metricID,
		Measurement: measurement,
	})
	if s.getter != nil {
		s.getter.mu.Lock()
		if m, ok := s.getter.metrics[metricID]; ok {
			m.Measurements = append(m.Measurements, measurement)
		}
		s.getter.mu.Unlock()
	}
	return nil
}

func (s *mockSetter) CompleteMetric(_ context.Context, metricID string, status metrics.VerificationStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.completeErr != nil {
		return s.completeErr
	}
	if s.completed == nil {
		s.completed = make(map[string]metrics.VerificationStatus)
	}
	s.completed[metricID] = status
	return nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func sleepProvider() json.RawMessage {
	return json.RawMessage(`{"type":"sleep","durationSeconds":0}`)
}

func newMetric(name string, count int32, successCondition string) *metrics.VerificationMetric {
	return &metrics.VerificationMetric{
		ID:               uuid.New().String(),
		Name:             name,
		Count:            count,
		IntervalSeconds:  1,
		SuccessCondition: successCondition,
		Provider:         sleepProvider(),
		Measurements:     []metrics.Measurement{},
	}
}

func oldMeasurement(status metrics.MeasurementStatus) metrics.Measurement {
	return metrics.Measurement{
		Status:     status,
		MeasuredAt: time.Now().Add(-time.Minute),
	}
}

func recentMeasurement(status metrics.MeasurementStatus) metrics.Measurement {
	return metrics.Measurement{
		Status:     status,
		MeasuredAt: time.Now(),
	}
}

func setupMocks(m *metrics.VerificationMetric) (*mockGetter, *mockSetter) {
	getter := &mockGetter{
		metrics:     map[string]*metrics.VerificationMetric{m.ID: m},
		providerCtx: &provider.ProviderContext{},
	}
	setter := &mockSetter{getter: getter}
	return getter, setter
}

func reconcileItem(scopeID, kind string) reconcile.Item {
	return reconcile.Item{
		ID:        1,
		Kind:      kind,
		ScopeType: "verification-metric",
		ScopeID:   scopeID,
	}
}

func int32Ptr(i int32) *int32 { return &i }

func strPtr(s string) *string { return &s }

// ---------------------------------------------------------------------------
// Controller.Process tests
// ---------------------------------------------------------------------------

func TestProcess_ValidMetricID(t *testing.T) {
	m := newMetric("check", 3, "true")
	getter, setter := setupMocks(m)
	ctrl := NewController(getter, setter)

	item := reconcileItem(m.ID, "verification-metric")
	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Greater(t, result.RequeueAfter, time.Duration(0))
	require.Len(t, setter.measurements, 1)
}

func TestProcess_PropagatesRequeueAfter(t *testing.T) {
	m := newMetric("check", 3, "true")
	m.Measurements = []metrics.Measurement{recentMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)
	ctrl := NewController(getter, setter)

	item := reconcileItem(m.ID, "verification-metric")
	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Greater(t, result.RequeueAfter, time.Duration(0), "should propagate interval guard requeue")
	assert.Empty(t, setter.measurements, "should not have measured — interval not elapsed")
}

func TestProcess_ReconcileError_Propagated(t *testing.T) {
	getter := &mockGetter{
		metrics:      map[string]*metrics.VerificationMetric{},
		getMetricErr: fmt.Errorf("connection refused"),
	}
	ctrl := NewController(getter, &mockSetter{})
	item := reconcileItem("any-id", "verification-metric")
	_, err := ctrl.Process(context.Background(), item)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "reconcile verification metric")
}

func TestProcess_MetricNotFound_NoRequeue(t *testing.T) {
	getter := &mockGetter{metrics: map[string]*metrics.VerificationMetric{}}
	ctrl := NewController(getter, &mockSetter{})
	item := reconcileItem("missing", "verification-metric")
	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Equal(t, time.Duration(0), result.RequeueAfter)
}

// ---------------------------------------------------------------------------
// Reconcile: metric not found / deleted
// ---------------------------------------------------------------------------

func TestReconcile_MetricNotFound_NoOp(t *testing.T) {
	getter := &mockGetter{metrics: map[string]*metrics.VerificationMetric{}}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, "gone")
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.measurements)
}

func TestReconcile_GetMetricError(t *testing.T) {
	getter := &mockGetter{
		metrics:      map[string]*metrics.VerificationMetric{},
		getMetricErr: fmt.Errorf("db connection lost"),
	}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), getter, setter, "any")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get verification metric")
}

// ---------------------------------------------------------------------------
// Reconcile: interval guard
// ---------------------------------------------------------------------------

func TestReconcile_IntervalNotElapsed_Defers(t *testing.T) {
	m := newMetric("check", 3, "true")
	m.Measurements = []metrics.Measurement{recentMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	assert.Empty(t, setter.measurements, "should not measure — interval not elapsed")
	require.NotNil(t, result.RequeueAfter)
	assert.Greater(t, *result.RequeueAfter, time.Duration(0))
}

func TestReconcile_IntervalElapsed_Measures(t *testing.T) {
	m := newMetric("check", 3, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1, "should measure — interval elapsed")
	require.NotNil(t, result.RequeueAfter)
}

func TestReconcile_NoMeasurements_MeasuresImmediately(t *testing.T) {
	m := newMetric("check", 3, "true")
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter)
}

func TestReconcile_IntervalGuard_LargeInterval(t *testing.T) {
	m := newMetric("check", 3, "true")
	m.IntervalSeconds = 3600
	m.Measurements = []metrics.Measurement{recentMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	require.NotNil(t, result.RequeueAfter)
	assert.Greater(t, *result.RequeueAfter, 59*time.Minute, "should defer for nearly the full interval")
}

// ---------------------------------------------------------------------------
// Reconcile: metric already complete (ShouldContinue = false)
// ---------------------------------------------------------------------------

func TestReconcile_MetricAlreadyComplete_SkipsMeasurement(t *testing.T) {
	m := newMetric("check", 1, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	assert.Empty(t, setter.measurements, "should not measure — metric already complete")
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationPassed, setter.completed[m.ID])
}

func TestReconcile_MetricAlreadyFailed_SkipsMeasurement(t *testing.T) {
	m := newMetric("check", 5, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusFailed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationFailed, setter.completed[m.ID])
}

// ---------------------------------------------------------------------------
// Reconcile: measurement success -> continues or completes
// ---------------------------------------------------------------------------

func TestReconcile_PassingMeasurement_Requeues(t *testing.T) {
	m := newMetric("check", 3, "true")
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, metrics.StatusPassed, setter.measurements[0].Measurement.Status)
	require.NotNil(t, result.RequeueAfter, "should requeue — more measurements needed")
	assert.Empty(t, setter.completed, "should not finalize yet")
}

func TestReconcile_FinalPassingMeasurement_Completes(t *testing.T) {
	m := newMetric("check", 2, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter, "should not requeue — metric complete")
	assert.Equal(t, metrics.VerificationPassed, setter.completed[m.ID])
}

func TestReconcile_AllCountMet_CompletesWithPassed(t *testing.T) {
	m := newMetric("check", 3, "true")
	m.Measurements = []metrics.Measurement{
		oldMeasurement(metrics.StatusPassed),
		oldMeasurement(metrics.StatusPassed),
	}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationPassed, setter.completed[m.ID])
}

// ---------------------------------------------------------------------------
// Reconcile: measurement failure
// ---------------------------------------------------------------------------

func TestReconcile_FailingMeasurement_NoThreshold_Stops(t *testing.T) {
	m := newMetric("check", 5, "false")
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, metrics.StatusFailed, setter.measurements[0].Measurement.Status)
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationFailed, setter.completed[m.ID])
}

func TestReconcile_FailingMeasurement_WithThreshold_Continues(t *testing.T) {
	m := newMetric("check", 5, "false")
	m.FailureThreshold = int32Ptr(2)
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "below threshold — should continue")
	assert.Empty(t, setter.completed, "should not finalize yet")
}

func TestReconcile_FailureThreshold_Exceeded_Stops(t *testing.T) {
	m := newMetric("check", 5, "false")
	m.FailureThreshold = int32Ptr(1)
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusFailed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationFailed, setter.completed[m.ID])
}

// ---------------------------------------------------------------------------
// Reconcile: success threshold
// ---------------------------------------------------------------------------

func TestReconcile_SuccessThreshold_MetBeforeCount_Completes(t *testing.T) {
	m := newMetric("check", 10, "true")
	m.SuccessThreshold = int32Ptr(2)
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, metrics.StatusPassed, setter.measurements[0].Measurement.Status)
	assert.Nil(t, result.RequeueAfter)
	assert.Equal(t, metrics.VerificationPassed, setter.completed[m.ID])
}

func TestReconcile_SuccessThreshold_NotYetMet_Requeues(t *testing.T) {
	m := newMetric("check", 10, "true")
	m.SuccessThreshold = int32Ptr(3)
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "threshold not met — should continue")
}

func TestReconcile_SuccessThreshold_BrokenByFailure_Resets(t *testing.T) {
	m := newMetric("check", 10, "true")
	m.SuccessThreshold = int32Ptr(3)
	m.FailureThreshold = int32Ptr(5)
	m.Measurements = []metrics.Measurement{
		oldMeasurement(metrics.StatusPassed),
		oldMeasurement(metrics.StatusFailed),
		oldMeasurement(metrics.StatusPassed),
	}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "consecutive count is 2 but threshold is 3")
}

// ---------------------------------------------------------------------------
// Reconcile: inconclusive measurements
// ---------------------------------------------------------------------------

func TestReconcile_InconclusiveMeasurement_Continues(t *testing.T) {
	failureCondition := "false"
	m := newMetric("check", 5, "false")
	m.FailureCondition = &failureCondition
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, metrics.StatusInconclusive, setter.measurements[0].Measurement.Status)
	require.NotNil(t, result.RequeueAfter)
	assert.Empty(t, setter.completed, "should not finalize yet — inconclusive is not failure")
}

// ---------------------------------------------------------------------------
// Reconcile: getter/setter error propagation
// ---------------------------------------------------------------------------

func TestReconcile_GetProviderContextError(t *testing.T) {
	m := newMetric("check", 3, "true")
	getter := &mockGetter{
		metrics:           map[string]*metrics.VerificationMetric{m.ID: m},
		getProviderCtxErr: fmt.Errorf("release not found"),
	}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), getter, setter, m.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get provider context")
}

func TestReconcile_RecordMeasurementError(t *testing.T) {
	m := newMetric("check", 3, "true")
	getter, _ := setupMocks(m)
	setter := &mockSetter{recordErr: fmt.Errorf("disk full"), getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, m.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "record measurement")
}

func TestReconcile_ReReadMetricError(t *testing.T) {
	m := newMetric("check", 3, "true")
	getter, _ := setupMocks(m)
	getter.getMetricErr = fmt.Errorf("re-read failed")
	getter.getMetricErrOnCall = 2

	setter := &mockSetter{getter: getter}
	_, err := Reconcile(context.Background(), getter, setter, m.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "re-read verification metric")
}

func TestReconcile_CompleteMetricError(t *testing.T) {
	m := newMetric("check", 1, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, _ := setupMocks(m)
	setter := &mockSetter{completeErr: fmt.Errorf("queue down"), getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, m.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "complete metric")
}

// ---------------------------------------------------------------------------
// Reconcile: re-read after recording picks up updated state
// ---------------------------------------------------------------------------

func TestReconcile_ReReadAfterRecord_DetectsCompletion(t *testing.T) {
	m := newMetric("check", 2, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter, "re-read should see 2/2 measurements → complete")
	assert.Equal(t, metrics.VerificationPassed, setter.completed[m.ID])
}

func TestReconcile_ReReadAfterRecord_StillRunning_Requeues(t *testing.T) {
	m := newMetric("check", 5, "true")
	getter, setter := setupMocks(m)

	result, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)

	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "only 1/5 measurements — should requeue")
	assert.Empty(t, setter.completed)
}

// ---------------------------------------------------------------------------
// Reconcile: idempotency — same item processed twice
// ---------------------------------------------------------------------------

func TestReconcile_Idempotent_AlreadyFinalized(t *testing.T) {
	m := newMetric("check", 1, "true")
	m.Measurements = []metrics.Measurement{oldMeasurement(metrics.StatusPassed)}
	getter, setter := setupMocks(m)

	result1, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	assert.Nil(t, result1.RequeueAfter)
	assert.Contains(t, setter.completed, m.ID)

	result2, err := Reconcile(context.Background(), getter, setter, m.ID)
	require.NoError(t, err)
	assert.Nil(t, result2.RequeueAfter)
}
