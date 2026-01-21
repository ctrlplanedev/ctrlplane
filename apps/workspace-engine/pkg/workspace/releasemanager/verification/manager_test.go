package verification

import (
	"context"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Note: Test helpers (NewTestServer, createTestHTTPProvider, etc.) are defined in scheduler_test.go

// Tests for Manager

func TestNewManager(t *testing.T) {
	s := newTestStore()
	manager := NewManager(s)

	assert.NotNil(t, manager)
	assert.NotNil(t, manager.store)
	assert.NotNil(t, manager.scheduler)
	assert.Equal(t, s, manager.store)
}

func TestManager_StartVerification_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	// Create metric specs using test server
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			FailureThreshold: ptr(2),
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)

	require.NoError(t, err)

	// Verify verification was created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]
	assert.Equal(t, job.Id, verification.JobId)
	assert.Equal(t, 1, len(verification.Metrics))
	assert.Equal(t, "health-check", verification.Metrics[0].Name)
	assert.EqualValues(t, 30, verification.Metrics[0].IntervalSeconds)
	assert.EqualValues(t, 5, verification.Metrics[0].Count)
	// Note: scheduler runs first measurement immediately, so we should have at least one
	assert.LessOrEqual(t, len(verification.Metrics[0].Measurements), verification.Metrics[0].Count)

	// Verify scheduler started the verification
	manager.scheduler.mu.Lock()
	_, schedulerRunning := manager.scheduler.cancelFuncs[verification.Id]
	manager.scheduler.mu.Unlock()
	assert.True(t, schedulerRunning, "scheduler should have started the verification")

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_StartVerification_MultipleMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL+"/health", oapi.GET),
		},
		{
			Name:             "availability-check",
			IntervalSeconds:  60,
			Count:            3,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL+"/status", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)

	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]
	assert.Equal(t, 2, len(verification.Metrics))
	assert.Equal(t, "health-check", verification.Metrics[0].Name)
	assert.Equal(t, "availability-check", verification.Metrics[1].Name)

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_StartVerification_AlreadyExists(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	// Start verification first time
	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	firstVerificationID := verifications[0].Id

	// Try to start again - should create a new verification
	err = manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	// Verify new verification was created
	verifications = s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 2)
	// Most recent first
	assert.NotEqual(t, firstVerificationID, verifications[0].Id, "should be a new verification")

	// Clean up
	for _, v := range verifications {
		manager.scheduler.StopVerification(v.Id)
	}
}

func TestManager_StartVerification_NoMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	// Try to start with empty metrics
	err := manager.StartVerification(ctx, job, []oapi.VerificationMetricSpec{})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least one metric configuration is required")

	// Verify no verification was created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func TestManager_StartVerification_WithFailureLimit(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	failureLimit := 3
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            10,
			SuccessCondition: "result.statusCode == 200",
			FailureThreshold: &failureLimit,
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)

	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]
	require.NotNil(t, verification.Metrics[0].FailureThreshold)
	assert.Equal(t, 3, *verification.Metrics[0].FailureThreshold)

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_StopVerification_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Verify it's running
	manager.scheduler.mu.Lock()
	_, running := manager.scheduler.cancelFuncs[verification.Id]
	manager.scheduler.mu.Unlock()
	assert.True(t, running)

	// Stop the verification
	manager.StopVerificationsForJob(ctx, job.Id)

	// Verify it's stopped
	manager.scheduler.mu.Lock()
	_, stillRunning := manager.scheduler.cancelFuncs[verification.Id]
	manager.scheduler.mu.Unlock()
	assert.False(t, stillRunning)
}

func TestManager_StopVerification_NotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	nonExistentJobID := uuid.New().String()

	// Should not panic
	assert.NotPanics(t, func() {
		manager.StopVerificationsForJob(ctx, nonExistentJobID)
	})
}

func TestManager_Restore_NoVerifications(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	err := manager.Restore(ctx)

	assert.NoError(t, err)

	// No verifications should be running
	manager.scheduler.mu.Lock()
	count := len(manager.scheduler.cancelFuncs)
	manager.scheduler.mu.Unlock()
	assert.Equal(t, 0, count)
}

func TestManager_Restore_RunningVerifications(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create some releases, jobs, and verifications in running state
	release1 := createTestRelease(s, ctx)
	job1 := createTestJob(s, ctx, release1.ID())
	release2 := createTestRelease(s, ctx)
	job2 := createTestJob(s, ctx, release2.ID())
	release3 := createTestRelease(s, ctx)
	job3 := createTestJob(s, ctx, release3.ID())

	verification1 := createTestVerification(s, ctx, job1.Id, 2, 3600)
	verification2 := createTestVerification(s, ctx, job2.Id, 1, 300)
	verification3 := createTestVerification(s, ctx, job3.Id, 3, 2700)

	// verification1 is running (no measurements)
	// verification2 is completed (all measurements passed)
	for i := 0; i < verification2.Metrics[0].Count; i++ {
		msg := "Success"
		verification2.Metrics[0].Measurements = append(verification2.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Status:     oapi.Passed,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 200},
		})
	}
	s.JobVerifications.Upsert(ctx, verification2)

	// verification3 has some measurements but not complete
	msg := "Success"
	verification3.Metrics[0].Measurements = append(verification3.Metrics[0].Measurements, oapi.VerificationMeasurement{
		Message:    &msg,
		Status:     oapi.Passed,
		MeasuredAt: time.Now(),
		Data:       &map[string]any{"statusCode": 200},
	})
	s.JobVerifications.Upsert(ctx, verification3)

	// Restore should restart verification1 and verification3, but not verification2
	err := manager.Restore(ctx)

	require.NoError(t, err)

	// Check which verifications are running
	manager.scheduler.mu.Lock()
	_, v1Running := manager.scheduler.cancelFuncs[verification1.Id]
	_, v2Running := manager.scheduler.cancelFuncs[verification2.Id]
	_, v3Running := manager.scheduler.cancelFuncs[verification3.Id]
	totalRunning := len(manager.scheduler.cancelFuncs)
	manager.scheduler.mu.Unlock()

	assert.True(t, v1Running, "verification1 should be restarted")
	assert.False(t, v2Running, "verification2 should not be restarted (completed)")
	assert.True(t, v3Running, "verification3 should be restarted")
	assert.Equal(t, 2, totalRunning, "should have 2 verifications running")

	// Clean up
	manager.scheduler.StopVerification(verification1.Id)
	manager.scheduler.StopVerification(verification3.Id)
}

func TestManager_Restore_FailedVerifications(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())
	verification := createTestVerification(s, ctx, job.Id, 1, 30)

	// Make verification failed by hitting failure limit
	for i := 0; i <= *verification.Metrics[0].FailureThreshold; i++ {
		msg := "Failed"
		verification.Metrics[0].Measurements = append(verification.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Status:     oapi.Failed,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 500},
		})
	}
	s.JobVerifications.Upsert(ctx, verification)

	// Verify it's in failed state
	assert.Equal(t, oapi.JobVerificationStatusFailed, verification.Status())

	// Restore should not restart failed verifications
	err := manager.Restore(ctx)

	require.NoError(t, err)

	manager.scheduler.mu.Lock()
	_, running := manager.scheduler.cancelFuncs[verification.Id]
	manager.scheduler.mu.Unlock()

	assert.False(t, running, "failed verification should not be restarted")
}

func TestManager_Restore_MixedStates(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create verifications in different states
	runningRelease := createTestRelease(s, ctx)
	runningJob := createTestJob(s, ctx, runningRelease.ID())
	passedRelease := createTestRelease(s, ctx)
	passedJob := createTestJob(s, ctx, passedRelease.ID())
	failedRelease := createTestRelease(s, ctx)
	failedJob := createTestJob(s, ctx, failedRelease.ID())

	runningVerification := createTestVerification(s, ctx, runningJob.Id, 1, 3600)

	passedVerification := createTestVerification(s, ctx, passedJob.Id, 1, 3600)
	for i := 0; i < passedVerification.Metrics[0].Count; i++ {
		msg := "Success"
		passedVerification.Metrics[0].Measurements = append(passedVerification.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Status:     oapi.Passed,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 200},
		})
	}
	s.JobVerifications.Upsert(ctx, passedVerification)

	failedVerification := createTestVerification(s, ctx, failedJob.Id, 1, 3600)
	for i := 0; i <= *failedVerification.Metrics[0].FailureThreshold; i++ {
		msg := "Failed"
		failedVerification.Metrics[0].Measurements = append(failedVerification.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Status:     oapi.Failed,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 500},
		})
	}
	s.JobVerifications.Upsert(ctx, failedVerification)

	// Restore
	err := manager.Restore(ctx)
	require.NoError(t, err)

	// Only running verification should be restarted
	manager.scheduler.mu.Lock()
	_, runningActive := manager.scheduler.cancelFuncs[runningVerification.Id]
	_, passedActive := manager.scheduler.cancelFuncs[passedVerification.Id]
	_, failedActive := manager.scheduler.cancelFuncs[failedVerification.Id]
	totalActive := len(manager.scheduler.cancelFuncs)
	manager.scheduler.mu.Unlock()

	assert.True(t, runningActive, "running verification should be active")
	assert.False(t, passedActive, "passed verification should not be active")
	assert.False(t, failedActive, "failed verification should not be active")
	assert.Equal(t, 1, totalActive)

	// Clean up
	manager.scheduler.StopVerification(runningVerification.Id)
}

func TestManager_StartAndStopMultiple(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	// Start multiple verifications
	jobs := make([]*oapi.Job, 5)
	for i := 0; i < 5; i++ {
		release := createTestRelease(s, ctx)
		jobs[i] = createTestJob(s, ctx, release.ID())
		err := manager.StartVerification(ctx, jobs[i], metrics)
		require.NoError(t, err)
	}

	// Verify all are running
	manager.scheduler.mu.Lock()
	runningCount := len(manager.scheduler.cancelFuncs)
	manager.scheduler.mu.Unlock()
	assert.Equal(t, 5, runningCount)

	// Stop all
	for _, job := range jobs {
		manager.StopVerificationsForJob(ctx, job.Id)
	}

	// Verify all are stopped
	manager.scheduler.mu.Lock()
	finalCount := len(manager.scheduler.cancelFuncs)
	manager.scheduler.mu.Unlock()
	assert.Equal(t, 0, finalCount)
}

func TestManager_StartVerification_PreservesAllMetricFields(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	method := oapi.POST
	timeout := "10s"
	body := `{"key": "value"}`
	headers := map[string]string{"Authorization": "Bearer token"}
	failureLimit := 5
	failureCondition := "result.statusCode == 500 || result.body.status == 'error'"
	successThreshold := 3

	provider := oapi.MetricProvider{}
	_ = provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     ts.URL + "/verify",
		Method:  &method,
		Type:    oapi.Http,
		Timeout: &timeout,
		Body:    &body,
		Headers: &headers,
	})

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "complex-check",
			IntervalSeconds:  120,
			Count:            20,
			SuccessCondition: "result.body.status == 'ok'",
			FailureCondition: &failureCondition,
			FailureThreshold: &failureLimit,
			SuccessThreshold: &successThreshold,
			Provider:         provider,
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Verify all fields are preserved
	metric := verification.Metrics[0]
	assert.Equal(t, "complex-check", metric.Name)
	assert.EqualValues(t, 120, metric.IntervalSeconds)
	assert.EqualValues(t, 20, metric.Count)
	assert.Equal(t, "result.body.status == 'ok'", metric.SuccessCondition)
	require.NotNil(t, metric.FailureCondition, "FailureCondition should be preserved")
	assert.Equal(t, failureCondition, *metric.FailureCondition)
	assert.EqualValues(t, 5, *metric.FailureThreshold)
	require.NotNil(t, metric.SuccessThreshold, "SuccessThreshold should be preserved")
	assert.EqualValues(t, 3, *metric.SuccessThreshold)

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_Integration_FullLifecycle(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  1,
			Count:            3,
			SuccessCondition: "result.statusCode == 200",
			FailureThreshold: ptr(2),
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	// Start verification
	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	// Wait for some measurements
	time.Sleep(2 * time.Second)

	// Check that measurements were taken
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]
	assert.GreaterOrEqual(t, len(verification.Metrics[0].Measurements), 1)

	// Verify test server received requests
	assert.GreaterOrEqual(t, ts.RequestCount(), 1)

	// Stop verification
	manager.StopVerificationsForJob(ctx, job.Id)

	// Verify it's stopped
	manager.scheduler.mu.Lock()
	_, running := manager.scheduler.cancelFuncs[verification.Id]
	manager.scheduler.mu.Unlock()
	assert.False(t, running)
}

// Benchmark tests
func BenchmarkManager_StartVerification(b *testing.B) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	// Pre-create jobs
	jobs := make([]*oapi.Job, b.N)
	for i := 0; i < b.N; i++ {
		release := createTestRelease(s, ctx)
		jobs[i] = createTestJob(s, ctx, release.ID())
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = manager.StartVerification(ctx, jobs[i], metrics)
	}

	// Clean up
	for _, job := range jobs {
		verifications := s.JobVerifications.GetByJobId(job.Id)
		for _, verification := range verifications {
			manager.scheduler.StopVerification(verification.Id)
		}
	}
}

func BenchmarkManager_StopVerification(b *testing.B) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	// Pre-create and start verifications
	jobs := make([]*oapi.Job, b.N)
	for i := 0; i < b.N; i++ {
		release := createTestRelease(s, ctx)
		jobs[i] = createTestJob(s, ctx, release.ID())
		_ = manager.StartVerification(ctx, jobs[i], metrics)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager.StopVerificationsForJob(ctx, jobs[i].Id)
	}
}

func BenchmarkManager_Restore(b *testing.B) {
	ctx := context.Background()

	// Pre-create verifications
	stores := make([]*store.Store, b.N)
	for i := 0; i < b.N; i++ {
		s := newTestStore()
		// Create 10 running verifications per store
		for j := 0; j < 10; j++ {
			release := createTestRelease(s, ctx)
			job := createTestJob(s, ctx, release.ID())
			createTestVerification(s, ctx, job.Id, 2, 3600)
		}
		stores[i] = s
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager := NewManager(stores[i])
		_ = manager.Restore(ctx)

		// Clean up
		for _, verification := range stores[i].JobVerifications.Items() {
			manager.scheduler.StopVerification(verification.Id)
		}
	}
}

// Mock hooks for testing
type mockHooks struct {
	mu sync.Mutex

	verificationStartedCalls  []string
	measurementTakenCalls     []measurementCall
	metricCompleteCalls       []metricCall
	verificationCompleteCalls []string
	verificationStoppedCalls  []string

	// Allow injecting errors for testing error handling
	errorOnVerificationStarted  error
	errorOnMeasurementTaken     error
	errorOnMetricComplete       error
	errorOnVerificationComplete error
	errorOnVerificationStopped  error
}

type measurementCall struct {
	verificationID string
	metricIndex    int
	measurement    *oapi.VerificationMeasurement
}

type metricCall struct {
	verificationID string
	metricIndex    int
}

func newMockHooks() *mockHooks {
	return &mockHooks{
		verificationStartedCalls:  make([]string, 0),
		measurementTakenCalls:     make([]measurementCall, 0),
		metricCompleteCalls:       make([]metricCall, 0),
		verificationCompleteCalls: make([]string, 0),
		verificationStoppedCalls:  make([]string, 0),
	}
}

func (m *mockHooks) OnVerificationStarted(ctx context.Context, verification *oapi.JobVerification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verificationStartedCalls = append(m.verificationStartedCalls, verification.Id)
	return m.errorOnVerificationStarted
}

func (m *mockHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.JobVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.measurementTakenCalls = append(m.measurementTakenCalls, measurementCall{
		verificationID: verification.Id,
		metricIndex:    metricIndex,
		measurement:    measurement,
	})
	return m.errorOnMeasurementTaken
}

func (m *mockHooks) OnMetricComplete(ctx context.Context, verification *oapi.JobVerification, metricIndex int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metricCompleteCalls = append(m.metricCompleteCalls, metricCall{
		verificationID: verification.Id,
		metricIndex:    metricIndex,
	})
	return m.errorOnMetricComplete
}

func (m *mockHooks) OnVerificationComplete(ctx context.Context, verification *oapi.JobVerification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verificationCompleteCalls = append(m.verificationCompleteCalls, verification.Id)
	return m.errorOnVerificationComplete
}

func (m *mockHooks) OnVerificationStopped(ctx context.Context, verification *oapi.JobVerification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verificationStoppedCalls = append(m.verificationStoppedCalls, verification.Id)
	return m.errorOnVerificationStopped
}

func (m *mockHooks) getVerificationStartedCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.verificationStartedCalls)
}

func (m *mockHooks) getMeasurementTakenCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.measurementTakenCalls)
}

func (m *mockHooks) getMetricCompleteCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.metricCompleteCalls)
}

func (m *mockHooks) getVerificationCompleteCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.verificationCompleteCalls)
}

func (m *mockHooks) getVerificationStoppedCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.verificationStoppedCalls)
}

// Hook tests

func TestManager_HooksOnVerificationStarted(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()
	manager := NewManager(s, WithHooks(hooks))

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	// Verify hook was called
	assert.Equal(t, 1, hooks.getVerificationStartedCount())

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	hooks.mu.Lock()
	assert.Equal(t, verification.Id, hooks.verificationStartedCalls[0])
	hooks.mu.Unlock()

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_HooksOnVerificationStopped(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()
	manager := NewManager(s, WithHooks(hooks))

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  30,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Stop the verification
	manager.StopVerificationsForJob(ctx, job.Id)

	// Verify hook was called
	assert.Equal(t, 1, hooks.getVerificationStoppedCount())

	hooks.mu.Lock()
	assert.Equal(t, verification.Id, hooks.verificationStoppedCalls[0])
	hooks.mu.Unlock()
}

func TestManager_HooksOnMeasurementTaken(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()
	manager := NewManager(s, WithHooks(hooks))

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  100,
			Count:            3,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Wait for at least one measurement to be taken
	time.Sleep(200 * time.Millisecond)

	// Verify hook was called at least once
	assert.GreaterOrEqual(t, hooks.getMeasurementTakenCount(), 1)

	hooks.mu.Lock()
	if len(hooks.measurementTakenCalls) > 0 {
		assert.Equal(t, verification.Id, hooks.measurementTakenCalls[0].verificationID)
		assert.Equal(t, 0, hooks.measurementTakenCalls[0].metricIndex)
		assert.NotNil(t, hooks.measurementTakenCalls[0].measurement)
	}
	hooks.mu.Unlock()

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_HooksOnMetricComplete(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()
	manager := NewManager(s, WithHooks(hooks))

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	// Use a very short interval, low count, and short timeout to complete quickly
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  1, // 1 second interval for quick test
			Count:            2, // Only 2 measurements to complete quickly
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProviderWithTimeout(ts.URL, oapi.GET, "100ms"),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Wait for metric to complete using Eventually to poll for completion
	// Need at least 1 second for the second measurement (IntervalSeconds: 1)
	assert.Eventually(t, func() bool {
		return hooks.getMetricCompleteCount() >= 1
	}, 3*time.Second, 50*time.Millisecond, "OnMetricComplete hook should be called")

	// Verify hook was called with correct parameters
	hooks.mu.Lock()
	if len(hooks.metricCompleteCalls) > 0 {
		assert.Equal(t, verification.Id, hooks.metricCompleteCalls[0].verificationID)
		assert.Equal(t, 0, hooks.metricCompleteCalls[0].metricIndex)
	}
	hooks.mu.Unlock()

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_HooksOnVerificationComplete(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()
	manager := NewManager(s, WithHooks(hooks))

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	// Use a very short interval, low count, and short timeout to complete quickly
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  1, // 1 second interval for quick test
			Count:            2, // Only 2 measurements to complete quickly
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProviderWithTimeout(ts.URL, oapi.GET, "100ms"),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Wait for verification to complete using Eventually to poll for completion
	// Need at least 1 second for the second measurement (IntervalSeconds: 1)
	assert.Eventually(t, func() bool {
		return hooks.getVerificationCompleteCount() >= 1
	}, 3*time.Second, 50*time.Millisecond, "OnVerificationComplete hook should be called")

	// Verify hook was called with correct parameters
	hooks.mu.Lock()
	if len(hooks.verificationCompleteCalls) > 0 {
		assert.Equal(t, verification.Id, hooks.verificationCompleteCalls[0])
	}
	hooks.mu.Unlock()

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_HooksErrorsDontFailVerification(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	// Inject errors in all hooks
	hooks.errorOnVerificationStarted = assert.AnError
	hooks.errorOnMeasurementTaken = assert.AnError
	hooks.errorOnMetricComplete = assert.AnError
	hooks.errorOnVerificationComplete = assert.AnError
	hooks.errorOnVerificationStopped = assert.AnError

	manager := NewManager(s, WithHooks(hooks))

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			IntervalSeconds:  50,
			Count:            2,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL, oapi.GET),
		},
	}

	// StartVerification should succeed despite hook error
	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)

	// Wait for some measurements
	time.Sleep(200 * time.Millisecond)

	// StopVerification should succeed despite hook error
	manager.StopVerificationsForJob(ctx, job.Id)

	// Verify hooks were still called despite errors
	assert.Equal(t, 1, hooks.getVerificationStartedCount())
	assert.GreaterOrEqual(t, hooks.getMeasurementTakenCount(), 1)
	assert.Equal(t, 1, hooks.getVerificationStoppedCount())
}

func TestManager_HooksWithMultipleMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	hooks := newMockHooks()
	manager := NewManager(s, WithHooks(hooks))

	// Create test server
	ts := NewTestServer()
	defer ts.Close()

	release := createTestRelease(s, ctx)
	job := createTestJob(s, ctx, release.ID())

	// Create multiple metrics
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check-1",
			IntervalSeconds:  1,
			Count:            2,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL+"/health", oapi.GET),
		},
		{
			Name:             "health-check-2",
			IntervalSeconds:  1,
			Count:            2,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createTestHTTPProvider(ts.URL+"/metrics", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, job, metrics)
	require.NoError(t, err)

	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	verification := verifications[0]

	// Wait for both metrics to complete
	// Poll until both metrics have completed their measurements
	// IntervalSeconds: 1, Count: 2 means ~1 second for second measurement per metric
	require.Eventually(t, func() bool {
		verifications = s.JobVerifications.GetByJobId(job.Id)
		if len(verifications) == 0 {
			return false
		}
		verification = verifications[0]
		completedCount := 0
		for _, metric := range verification.Metrics {
			if len(metric.Measurements) >= metric.Count {
				completedCount++
			}
		}
		return completedCount >= 2
	}, 4*time.Second, 100*time.Millisecond, "Both metrics should complete")

	// Wait for hooks to be called for both metrics
	require.Eventually(t, func() bool {
		return hooks.getMetricCompleteCount() >= 2
	}, 4*time.Second, 100*time.Millisecond, "Both metric complete hooks should be called")

	// Verify hooks were called for both metrics
	assert.Equal(t, 1, hooks.getVerificationStartedCount())
	assert.GreaterOrEqual(t, hooks.getMeasurementTakenCount(), 2) // At least one per metric
	assert.GreaterOrEqual(t, hooks.getMetricCompleteCount(), 2)   // Both metrics should complete
	assert.Equal(t, 1, hooks.getVerificationCompleteCount())      // Only one verification complete

	// Verify different metric indices were recorded
	hooks.mu.Lock()
	metricIndices := make(map[int]bool)
	for _, call := range hooks.measurementTakenCalls {
		metricIndices[call.metricIndex] = true
	}
	hooks.mu.Unlock()

	// Should have measurements from both metrics (index 0 and 1)
	assert.GreaterOrEqual(t, len(metricIndices), 1)

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}
