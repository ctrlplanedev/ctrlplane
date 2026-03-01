package verification

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	mu sync.Mutex

	verifications map[string]*oapi.JobVerification
	jobs          map[string]*oapi.Job
	providerCtx   *provider.ProviderContext
	releaseTarget *ReleaseTarget

	getVerificationErr       error
	getVerificationCallCount int
	getVerificationErrOnCall int // fail on the Nth call (1-indexed), 0 = never
	getJobErr                error
	getProviderCtxErr        error
	getReleaseTargetErr      error
}

func (g *mockGetter) GetVerification(_ context.Context, id string) (*oapi.JobVerification, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.getVerificationCallCount++
	if g.getVerificationErrOnCall > 0 && g.getVerificationCallCount == g.getVerificationErrOnCall {
		return nil, g.getVerificationErr
	}
	if g.getVerificationErrOnCall == 0 && g.getVerificationErr != nil {
		return nil, g.getVerificationErr
	}
	return g.verifications[id], nil
}

func (g *mockGetter) GetJob(_ context.Context, jobID string) (*oapi.Job, error) {
	if g.getJobErr != nil {
		return nil, g.getJobErr
	}
	j, ok := g.jobs[jobID]
	if !ok {
		return nil, fmt.Errorf("job %s not found", jobID)
	}
	return j, nil
}

func (g *mockGetter) GetProviderContext(_ context.Context, _ string) (*provider.ProviderContext, error) {
	if g.getProviderCtxErr != nil {
		return nil, g.getProviderCtxErr
	}
	return g.providerCtx, nil
}

func (g *mockGetter) GetReleaseTarget(_ context.Context, _ string) (*ReleaseTarget, error) {
	if g.getReleaseTargetErr != nil {
		return nil, g.getReleaseTargetErr
	}
	return g.releaseTarget, nil
}

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type recordedMeasurement struct {
	VerificationID string
	MetricIndex    int
	Measurement    oapi.VerificationMeasurement
}

type mockSetter struct {
	mu sync.Mutex

	measurements    []recordedMeasurement
	messages        map[string]string
	enqueuedTargets []*ReleaseTarget

	recordErr  error
	messageErr error
	enqueueErr error

	getter *mockGetter
}

func (s *mockSetter) RecordMeasurement(_ context.Context, verificationID string, metricIndex int, measurement oapi.VerificationMeasurement) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.recordErr != nil {
		return s.recordErr
	}
	s.measurements = append(s.measurements, recordedMeasurement{
		VerificationID: verificationID,
		MetricIndex:    metricIndex,
		Measurement:    measurement,
	})
	if s.getter != nil {
		s.getter.mu.Lock()
		if v, ok := s.getter.verifications[verificationID]; ok {
			v.Metrics[metricIndex].Measurements = append(
				v.Metrics[metricIndex].Measurements, measurement,
			)
		}
		s.getter.mu.Unlock()
	}
	return nil
}

func (s *mockSetter) UpdateVerificationMessage(_ context.Context, id, message string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.messageErr != nil {
		return s.messageErr
	}
	if s.messages == nil {
		s.messages = make(map[string]string)
	}
	s.messages[id] = message
	return nil
}

func (s *mockSetter) EnqueueDesiredRelease(_ context.Context, _ string, rt *ReleaseTarget) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.enqueueErr != nil {
		return s.enqueueErr
	}
	s.enqueuedTargets = append(s.enqueuedTargets, rt)
	return nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func sleepProvider() oapi.MetricProvider {
	var p oapi.MetricProvider
	_ = p.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 0,
	})
	return p
}

func newVerification(jobID string, ms ...oapi.VerificationMetricStatus) *oapi.JobVerification {
	return &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobID,
		CreatedAt: time.Now(),
		Metrics:   ms,
	}
}

func metricStatus(name string, count int, successCondition string) oapi.VerificationMetricStatus {
	return oapi.VerificationMetricStatus{
		Name:             name,
		Count:            count,
		IntervalSeconds:  1,
		SuccessCondition: successCondition,
		Provider:         sleepProvider(),
		Measurements:     []oapi.VerificationMeasurement{},
	}
}

func oldMeasurement(status oapi.VerificationMeasurementStatus) oapi.VerificationMeasurement {
	return oapi.VerificationMeasurement{
		Status:     status,
		MeasuredAt: time.Now().Add(-time.Minute),
	}
}

func recentMeasurement(status oapi.VerificationMeasurementStatus) oapi.VerificationMeasurement {
	return oapi.VerificationMeasurement{
		Status:     status,
		MeasuredAt: time.Now(),
	}
}

func setupMocks(v *oapi.JobVerification, job *oapi.Job) (*mockGetter, *mockSetter) {
	getter := &mockGetter{
		verifications: map[string]*oapi.JobVerification{v.Id: v},
		jobs:          map[string]*oapi.Job{job.Id: job},
		providerCtx:   &provider.ProviderContext{},
		releaseTarget: &ReleaseTarget{
			WorkspaceID:   uuid.New().String(),
			DeploymentID:  uuid.New().String(),
			EnvironmentID: uuid.New().String(),
			ResourceID:    uuid.New().String(),
		},
	}
	setter := &mockSetter{getter: getter}
	return getter, setter
}

func scope(v *oapi.JobVerification, idx int) *VerificationMetricScope {
	return &VerificationMetricScope{VerificationID: v.Id, MetricIndex: idx}
}

func reconcileItem(scopeID, kind string) reconcile.Item {
	return reconcile.Item{
		ID:        1,
		Kind:      kind,
		ScopeType: "verification-metric",
		ScopeID:   scopeID,
	}
}

// intPtr returns a pointer to the given int.
func intPtr(i int) *int { return &i }

// ---------------------------------------------------------------------------
// ParseScope tests
// ---------------------------------------------------------------------------

func TestParseScope_Valid(t *testing.T) {
	s, err := ParseScope("abc-123:2")
	require.NoError(t, err)
	assert.Equal(t, "abc-123", s.VerificationID)
	assert.Equal(t, 2, s.MetricIndex)
}

func TestParseScope_MissingColon(t *testing.T) {
	_, err := ParseScope("no-colon")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid verification metric scope")
}

func TestParseScope_NonNumericIndex(t *testing.T) {
	_, err := ParseScope("id:abc")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid metric index")
}

func TestParseScope_EmptyVerificationID(t *testing.T) {
	s, err := ParseScope(":0")
	require.NoError(t, err)
	assert.Equal(t, "", s.VerificationID)
	assert.Equal(t, 0, s.MetricIndex)
}

func TestParseScope_MultipleColons_InvalidIndex(t *testing.T) {
	_, err := ParseScope("id:with:extra:3")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid metric index")
}

func TestParseScope_UUIDVerificationID(t *testing.T) {
	s, err := ParseScope("550e8400-e29b-41d4-a716-446655440000:7")
	require.NoError(t, err)
	assert.Equal(t, "550e8400-e29b-41d4-a716-446655440000", s.VerificationID)
	assert.Equal(t, 7, s.MetricIndex)
}

func TestParseScope_NegativeIndex(t *testing.T) {
	s, err := ParseScope("vid:-1")
	require.NoError(t, err)
	assert.Equal(t, -1, s.MetricIndex)
}

// ---------------------------------------------------------------------------
// Controller.Process tests
// ---------------------------------------------------------------------------

func TestProcess_ValidScopeID(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter, setter := setupMocks(v, job)
	ctrl := NewController(getter, setter)

	item := reconcileItem(v.Id+":0", "verification")
	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Greater(t, result.RequeueAfter, time.Duration(0))
	require.Len(t, setter.measurements, 1)
}

func TestProcess_InvalidScopeID_ReturnsError(t *testing.T) {
	ctrl := NewController(&mockGetter{verifications: map[string]*oapi.JobVerification{}}, &mockSetter{})
	item := reconcileItem("invalid-no-colon", "verification")
	_, err := ctrl.Process(context.Background(), item)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "parse verification metric scope")
}

func TestProcess_PropagatesRequeueAfter(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 3, "true")
	metric.Measurements = []oapi.VerificationMeasurement{recentMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)
	ctrl := NewController(getter, setter)

	item := reconcileItem(v.Id+":0", "verification")
	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Greater(t, result.RequeueAfter, time.Duration(0), "should propagate interval guard requeue")
	assert.Empty(t, setter.measurements, "should not have measured — interval not elapsed")
}

func TestProcess_ReconcileError_Propagated(t *testing.T) {
	getter := &mockGetter{
		verifications:      map[string]*oapi.JobVerification{},
		getVerificationErr: fmt.Errorf("connection refused"),
	}
	ctrl := NewController(getter, &mockSetter{})
	item := reconcileItem("any-id:0", "verification")
	_, err := ctrl.Process(context.Background(), item)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "reconcile verification")
}

func TestProcess_VerificationNotFound_NoRequeue(t *testing.T) {
	getter := &mockGetter{verifications: map[string]*oapi.JobVerification{}}
	ctrl := NewController(getter, &mockSetter{})
	item := reconcileItem("missing:0", "verification")
	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Equal(t, time.Duration(0), result.RequeueAfter)
}

// ---------------------------------------------------------------------------
// Reconcile: verification not found / deleted
// ---------------------------------------------------------------------------

func TestReconcile_VerificationNotFound_NoOp(t *testing.T) {
	getter := &mockGetter{verifications: map[string]*oapi.JobVerification{}}
	setter := &mockSetter{}
	s := &VerificationMetricScope{VerificationID: "gone", MetricIndex: 0}

	result, err := Reconcile(context.Background(), getter, setter, s)
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.measurements)
	assert.Empty(t, setter.messages)
}

func TestReconcile_GetVerificationError(t *testing.T) {
	getter := &mockGetter{
		verifications:      map[string]*oapi.JobVerification{},
		getVerificationErr: fmt.Errorf("db connection lost"),
	}
	setter := &mockSetter{}
	s := &VerificationMetricScope{VerificationID: "any", MetricIndex: 0}

	_, err := Reconcile(context.Background(), getter, setter, s)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get verification")
}

// ---------------------------------------------------------------------------
// Reconcile: metric index validation
// ---------------------------------------------------------------------------

func TestReconcile_MetricIndexNegative(t *testing.T) {
	jobID := uuid.New().String()
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter := &mockGetter{verifications: map[string]*oapi.JobVerification{v.Id: v}}
	setter := &mockSetter{}

	s := &VerificationMetricScope{VerificationID: v.Id, MetricIndex: -1}
	_, err := Reconcile(context.Background(), getter, setter, s)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "metric index")
}

func TestReconcile_MetricIndexOutOfBounds(t *testing.T) {
	jobID := uuid.New().String()
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter := &mockGetter{verifications: map[string]*oapi.JobVerification{v.Id: v}}
	setter := &mockSetter{}

	s := &VerificationMetricScope{VerificationID: v.Id, MetricIndex: 5}
	_, err := Reconcile(context.Background(), getter, setter, s)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "metric index 5 out of range")
}

func TestReconcile_MetricIndexZero_Valid(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter)
}

func TestReconcile_NoMetrics_IndexOutOfBounds(t *testing.T) {
	jobID := uuid.New().String()
	v := newVerification(jobID)
	getter := &mockGetter{verifications: map[string]*oapi.JobVerification{v.Id: v}}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "metric index 0 out of range [0, 0)")
}

// ---------------------------------------------------------------------------
// Reconcile: interval guard
// ---------------------------------------------------------------------------

func TestReconcile_IntervalNotElapsed_Defers(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 3, "true")
	metric.Measurements = []oapi.VerificationMeasurement{recentMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements, "should not measure — interval not elapsed")
	require.NotNil(t, result.RequeueAfter)
	assert.Greater(t, *result.RequeueAfter, time.Duration(0))
}

func TestReconcile_IntervalElapsed_Measures(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 3, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1, "should measure — interval elapsed")
	require.NotNil(t, result.RequeueAfter)
}

func TestReconcile_NoMeasurements_MeasuresImmediately(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter)
}

func TestReconcile_IntervalGuard_LargeInterval(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 3, "true")
	metric.IntervalSeconds = 3600
	metric.Measurements = []oapi.VerificationMeasurement{recentMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	require.NotNil(t, result.RequeueAfter)
	assert.Greater(t, *result.RequeueAfter, 59*time.Minute, "should defer for nearly the full interval")
}

// ---------------------------------------------------------------------------
// Reconcile: metric already complete (ShouldContinue = false)
// ---------------------------------------------------------------------------

func TestReconcile_MetricAlreadyComplete_SkipsMeasurement(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements, "should not measure — metric already complete")
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "passed")
	require.Len(t, setter.enqueuedTargets, 1)
}

func TestReconcile_MetricAlreadyFailed_SkipsMeasurement(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 5, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Failed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "failed")
}

// ---------------------------------------------------------------------------
// Reconcile: measurement success → continues or completes
// ---------------------------------------------------------------------------

func TestReconcile_PassingMeasurement_Requeues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, oapi.Passed, setter.measurements[0].Measurement.Status)
	require.NotNil(t, result.RequeueAfter, "should requeue — more measurements needed")
	assert.Empty(t, setter.messages, "should not finalize yet")
}

func TestReconcile_FinalPassingMeasurement_Completes(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 2, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter, "should not requeue — metric complete")
	assert.Contains(t, setter.messages[v.Id], "passed")
	require.Len(t, setter.enqueuedTargets, 1)
}

func TestReconcile_AllCountMet_CompletesAndEnqueues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 3, "true")
	metric.Measurements = []oapi.VerificationMeasurement{
		oldMeasurement(oapi.Passed),
		oldMeasurement(oapi.Passed),
	}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "passed")
	require.Len(t, setter.enqueuedTargets, 1)
}

// ---------------------------------------------------------------------------
// Reconcile: measurement failure
// ---------------------------------------------------------------------------

func TestReconcile_FailingMeasurement_NoThreshold_Stops(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	// "false" as success condition → always evaluates to false → Failed (binary)
	v := newVerification(jobID, metricStatus("check", 5, "false"))
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, oapi.Failed, setter.measurements[0].Measurement.Status)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "failed")
}

func TestReconcile_FailingMeasurement_WithThreshold_Continues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 5, "false")
	metric.FailureThreshold = intPtr(2)
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "below threshold — should continue")
	assert.Empty(t, setter.messages, "should not finalize yet")
}

func TestReconcile_FailureThreshold_Exceeded_Stops(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 5, "false")
	metric.FailureThreshold = intPtr(1)
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Failed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "failed")
}

// ---------------------------------------------------------------------------
// Reconcile: success threshold
// ---------------------------------------------------------------------------

func TestReconcile_SuccessThreshold_MetBeforeCount_Completes(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 10, "true")
	metric.SuccessThreshold = intPtr(2)
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, oapi.Passed, setter.measurements[0].Measurement.Status)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "passed")
}

func TestReconcile_SuccessThreshold_NotYetMet_Requeues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 10, "true")
	metric.SuccessThreshold = intPtr(3)
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "threshold not met — should continue")
}

func TestReconcile_SuccessThreshold_BrokenByFailure_Resets(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 10, "true")
	metric.SuccessThreshold = intPtr(3)
	metric.FailureThreshold = intPtr(5)
	metric.Measurements = []oapi.VerificationMeasurement{
		oldMeasurement(oapi.Passed),
		oldMeasurement(oapi.Failed),
		oldMeasurement(oapi.Passed),
	}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "consecutive count is 2 but threshold is 3")
}

// ---------------------------------------------------------------------------
// Reconcile: inconclusive measurements
// ---------------------------------------------------------------------------

func TestReconcile_InconclusiveMeasurement_Continues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	failureCondition := "false"
	metric := metricStatus("check", 5, "false")
	metric.FailureCondition = &failureCondition
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, oapi.Inconclusive, setter.measurements[0].Measurement.Status)
	require.NotNil(t, result.RequeueAfter)
	assert.Empty(t, setter.messages, "should not finalize yet — inconclusive is not failure")
}

// ---------------------------------------------------------------------------
// Reconcile: multi-metric verification
// ---------------------------------------------------------------------------

func TestReconcile_MultiMetric_AllComplete_Passes(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	m1 := metricStatus("a", 1, "true")
	m1.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	m2 := metricStatus("b", 1, "true")
	m2.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, m1, m2)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "passed")
	require.Len(t, setter.enqueuedTargets, 1)
}

func TestReconcile_MultiMetric_OneStillRunning_NoFinalize(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	m1 := metricStatus("a", 1, "true")
	m1.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	m2 := metricStatus("b", 3, "true")
	v := newVerification(jobID, m1, m2)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.messages, "should not finalize — metric b still running")
	assert.Empty(t, setter.enqueuedTargets)
}

func TestReconcile_MultiMetric_OneFailed_OverallFails(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	m1 := metricStatus("a", 1, "true")
	m1.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	m2 := metricStatus("b", 5, "true")
	m2.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Failed)}
	v := newVerification(jobID, m1, m2)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 1))
	require.NoError(t, err)
	assert.Empty(t, setter.measurements)
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.messages[v.Id], "failed")
	require.Len(t, setter.enqueuedTargets, 1)
}

func TestReconcile_ProcessesCorrectMetricByIndex(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	m0 := metricStatus("a", 1, "true")
	m0.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	m1 := metricStatus("b", 3, "true")
	v := newVerification(jobID, m0, m1)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 1))
	require.NoError(t, err)
	require.Len(t, setter.measurements, 1)
	assert.Equal(t, 1, setter.measurements[0].MetricIndex, "should target metric index 1")
	require.NotNil(t, result.RequeueAfter)
}

// ---------------------------------------------------------------------------
// Reconcile: getter/setter error propagation
// ---------------------------------------------------------------------------

func TestReconcile_GetJobError(t *testing.T) {
	jobID := uuid.New().String()
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter := &mockGetter{
		verifications: map[string]*oapi.JobVerification{v.Id: v},
		jobs:          map[string]*oapi.Job{},
		getJobErr:     fmt.Errorf("job table locked"),
	}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get job")
}

func TestReconcile_GetProviderContextError(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter := &mockGetter{
		verifications:     map[string]*oapi.JobVerification{v.Id: v},
		jobs:              map[string]*oapi.Job{job.Id: job},
		getProviderCtxErr: fmt.Errorf("release not found"),
	}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get provider context")
}

func TestReconcile_RecordMeasurementError(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter, _ := setupMocks(v, job)
	setter := &mockSetter{recordErr: fmt.Errorf("disk full"), getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "record measurement")
}

func TestReconcile_ReReadVerificationError(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter, _ := setupMocks(v, job)
	getter.getVerificationErr = fmt.Errorf("re-read failed")
	getter.getVerificationErrOnCall = 2

	setter := &mockSetter{getter: getter}
	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "re-read verification")
}

func TestReconcile_UpdateMessageError(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, _ := setupMocks(v, job)
	setter := &mockSetter{messageErr: fmt.Errorf("column too long"), getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "update verification message")
}

func TestReconcile_EnqueueDesiredReleaseError(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, _ := setupMocks(v, job)
	setter := &mockSetter{enqueueErr: fmt.Errorf("queue down"), getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "enqueue desired release")
}

func TestReconcile_GetReleaseTargetError(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter := &mockGetter{
		verifications:       map[string]*oapi.JobVerification{v.Id: v},
		jobs:                map[string]*oapi.Job{job.Id: job},
		providerCtx:         &provider.ProviderContext{},
		getReleaseTargetErr: fmt.Errorf("release deleted"),
	}
	setter := &mockSetter{getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get release target")
}

func TestReconcile_GetJobErrorDuringFinalization(t *testing.T) {
	jobID := uuid.New().String()
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter := &mockGetter{
		verifications: map[string]*oapi.JobVerification{v.Id: v},
		jobs:          map[string]*oapi.Job{},
		getJobErr:     fmt.Errorf("job purged"),
	}
	setter := &mockSetter{getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "get job for release target")
}

// ---------------------------------------------------------------------------
// Reconcile: re-read after recording picks up updated state
// ---------------------------------------------------------------------------

func TestReconcile_ReReadAfterRecord_DetectsCompletion(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 2, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)

	require.Len(t, setter.measurements, 1)
	assert.Nil(t, result.RequeueAfter, "re-read should see 2/2 measurements → complete")
	assert.Contains(t, setter.messages[v.Id], "passed")
}

func TestReconcile_ReReadAfterRecord_StillRunning_Requeues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 5, "true")
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)

	require.Len(t, setter.measurements, 1)
	require.NotNil(t, result.RequeueAfter, "only 1/5 measurements — should requeue")
	assert.Empty(t, setter.messages)
}

// ---------------------------------------------------------------------------
// handleVerificationStatus: desired-release enqueue carries release target
// ---------------------------------------------------------------------------

func TestHandleVerificationStatus_EnqueuesCorrectTarget(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: "release-abc"}
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)

	rt := &ReleaseTarget{
		WorkspaceID:   "ws-1",
		DeploymentID:  "dep-1",
		EnvironmentID: "env-1",
		ResourceID:    "res-1",
	}
	getter := &mockGetter{
		verifications: map[string]*oapi.JobVerification{v.Id: v},
		jobs:          map[string]*oapi.Job{job.Id: job},
		releaseTarget: rt,
	}
	setter := &mockSetter{getter: getter}

	_, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	require.Len(t, setter.enqueuedTargets, 1)
	assert.Equal(t, "ws-1", setter.enqueuedTargets[0].WorkspaceID)
	assert.Equal(t, "dep-1", setter.enqueuedTargets[0].DeploymentID)
	assert.Equal(t, "env-1", setter.enqueuedTargets[0].EnvironmentID)
	assert.Equal(t, "res-1", setter.enqueuedTargets[0].ResourceID)
}

func TestHandleVerificationStatus_RunningStatus_NoMessageOrEnqueue(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	m1 := metricStatus("a", 1, "true")
	m1.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	m2 := metricStatus("b", 5, "true")
	v := newVerification(jobID, m1, m2)
	getter, setter := setupMocks(v, job)

	result, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.messages, "running status → no message update")
	assert.Empty(t, setter.enqueuedTargets, "running status → no enqueue")
}

// ---------------------------------------------------------------------------
// Reconcile: idempotency — same item processed twice
// ---------------------------------------------------------------------------

func TestReconcile_Idempotent_AlreadyFinalized(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	metric := metricStatus("check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{oldMeasurement(oapi.Passed)}
	v := newVerification(jobID, metric)
	getter, setter := setupMocks(v, job)

	result1, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Nil(t, result1.RequeueAfter)
	assert.Len(t, setter.enqueuedTargets, 1)

	result2, err := Reconcile(context.Background(), getter, setter, scope(v, 0))
	require.NoError(t, err)
	assert.Nil(t, result2.RequeueAfter)
	assert.Len(t, setter.enqueuedTargets, 2, "enqueues again — idempotent finalization")
}
