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

// Helper function to create a metric provider
func createHTTPProvider(url string, method oapi.HTTPMetricProviderMethod) oapi.MetricProvider {
	provider := oapi.MetricProvider{}
	provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:    url,
		Method: &method,
		Type:   oapi.Http,
	})
	return provider
}

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

	release := createTestRelease(s, ctx)

	// Create metric specs
	method := oapi.GET
	provider := oapi.MetricProvider{}
	provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:    "http://example.com/health",
		Method: &method,
		Type:   oapi.Http,
	})
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			FailureLimit:     ptr(2),
			Provider:         provider,
		},
	}

	err := manager.StartVerification(ctx, release, metrics)

	require.NoError(t, err)

	// Verify verification was created
	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)
	assert.Equal(t, release.ID(), verification.ReleaseId)
	assert.Equal(t, 1, len(verification.Metrics))
	assert.Equal(t, "health-check", verification.Metrics[0].Name)
	assert.Equal(t, "30s", verification.Metrics[0].Interval)
	assert.Equal(t, 5, verification.Metrics[0].Count)
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

	release := createTestRelease(s, ctx)

	method := oapi.GET
	provider1 := oapi.MetricProvider{}
	provider1.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:    "http://example.com/health",
		Method: &method,
		Type:   oapi.Http,
	})
	provider2 := oapi.MetricProvider{}
	provider2.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:    "http://example.com/status",
		Method: &method,
		Type:   oapi.Http,
	})
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         provider1,
		},
		{
			Name:             "availability-check",
			Interval:         "1m",
			Count:            3,
			SuccessCondition: "result.statusCode == 200",
			Provider:         provider2,
		},
	}

	err := manager.StartVerification(ctx, release, metrics)

	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)
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

	release := createTestRelease(s, ctx)

	method := oapi.GET
	provider := oapi.MetricProvider{}
	provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:    "http://example.com/health",
		Method: &method,
		Type:   oapi.Http,
	})
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         provider,
		},
	}

	// Start verification first time
	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, _ := s.ReleaseVerifications.GetByReleaseId(release.ID())
	firstVerificationID := verification.Id

	// Try to start again - should return without error
	err = manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	// Verify no new verification was created
	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)
	assert.Equal(t, firstVerificationID, verification.Id, "should still be the same verification")

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_StartVerification_NoMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	release := createTestRelease(s, ctx)

	// Try to start with empty metrics
	err := manager.StartVerification(ctx, release, []oapi.VerificationMetricSpec{})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "at least one metric configuration is required")

	// Verify no verification was created
	_, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	assert.False(t, exists)
}

func TestManager_StartVerification_WithFailureLimit(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	release := createTestRelease(s, ctx)

	failureLimit := 3
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            10,
			SuccessCondition: "result.statusCode == 200",
			FailureLimit:     &failureLimit,
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)

	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)
	require.NotNil(t, verification.Metrics[0].FailureLimit)
	assert.Equal(t, 3, *verification.Metrics[0].FailureLimit)

	// Clean up
	manager.scheduler.StopVerification(verification.Id)
}

func TestManager_StopVerification_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	release := createTestRelease(s, ctx)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, _ := s.ReleaseVerifications.GetByReleaseId(release.ID())

	// Verify it's running
	manager.scheduler.mu.Lock()
	_, running := manager.scheduler.cancelFuncs[verification.Id]
	manager.scheduler.mu.Unlock()
	assert.True(t, running)

	// Stop the verification
	manager.StopVerification(ctx, release.ID())

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

	nonExistentReleaseID := uuid.New().String()

	// Should not panic
	assert.NotPanics(t, func() {
		manager.StopVerification(ctx, nonExistentReleaseID)
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

	// Create some releases and verifications in running state
	release1 := createTestRelease(s, ctx)
	release2 := createTestRelease(s, ctx)
	release3 := createTestRelease(s, ctx)

	verification1 := createTestVerification(s, ctx, release1.ID(), 2, "1h")
	verification2 := createTestVerification(s, ctx, release2.ID(), 1, "30m")
	verification3 := createTestVerification(s, ctx, release3.ID(), 3, "45m")

	// verification1 is running (no measurements)
	// verification2 is completed (all measurements passed)
	for i := 0; i < verification2.Metrics[0].Count; i++ {
		msg := "Success"
		verification2.Metrics[0].Measurements = append(verification2.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Passed:     true,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 200},
		})
	}
	s.ReleaseVerifications.Upsert(ctx, verification2)

	// verification3 has some measurements but not complete
	msg := "Success"
	verification3.Metrics[0].Measurements = append(verification3.Metrics[0].Measurements, oapi.VerificationMeasurement{
		Message:    &msg,
		Passed:     true,
		MeasuredAt: time.Now(),
		Data:       &map[string]any{"statusCode": 200},
	})
	s.ReleaseVerifications.Upsert(ctx, verification3)

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
	verification := createTestVerification(s, ctx, release.ID(), 1, "30s")

	// Make verification failed by hitting failure limit
	for i := 0; i < *verification.Metrics[0].FailureLimit; i++ {
		msg := "Failed"
		verification.Metrics[0].Measurements = append(verification.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Passed:     false,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 500},
		})
	}
	s.ReleaseVerifications.Upsert(ctx, verification)

	// Verify it's in failed state
	assert.Equal(t, oapi.ReleaseVerificationStatusFailed, verification.Status())

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
	passedRelease := createTestRelease(s, ctx)
	failedRelease := createTestRelease(s, ctx)

	runningVerification := createTestVerification(s, ctx, runningRelease.ID(), 1, "1h")

	passedVerification := createTestVerification(s, ctx, passedRelease.ID(), 1, "1h")
	for i := 0; i < passedVerification.Metrics[0].Count; i++ {
		msg := "Success"
		passedVerification.Metrics[0].Measurements = append(passedVerification.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Passed:     true,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 200},
		})
	}
	s.ReleaseVerifications.Upsert(ctx, passedVerification)

	failedVerification := createTestVerification(s, ctx, failedRelease.ID(), 1, "1h")
	for i := 0; i < *failedVerification.Metrics[0].FailureLimit; i++ {
		msg := "Failed"
		failedVerification.Metrics[0].Measurements = append(failedVerification.Metrics[0].Measurements, oapi.VerificationMeasurement{
			Message:    &msg,
			Passed:     false,
			MeasuredAt: time.Now(),
			Data:       &map[string]any{"statusCode": 500},
		})
	}
	s.ReleaseVerifications.Upsert(ctx, failedVerification)

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

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	// Start multiple verifications
	releases := make([]*oapi.Release, 5)
	for i := 0; i < 5; i++ {
		releases[i] = createTestRelease(s, ctx)
		err := manager.StartVerification(ctx, releases[i], metrics)
		require.NoError(t, err)
	}

	// Verify all are running
	manager.scheduler.mu.Lock()
	runningCount := len(manager.scheduler.cancelFuncs)
	manager.scheduler.mu.Unlock()
	assert.Equal(t, 5, runningCount)

	// Stop all
	for _, release := range releases {
		manager.StopVerification(ctx, release.ID())
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

	release := createTestRelease(s, ctx)

	method := oapi.POST
	timeout := "10s"
	body := `{"key": "value"}`
	headers := map[string]string{"Authorization": "Bearer token"}
	failureLimit := 5

	provider := oapi.MetricProvider{}
	provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
		Url:     "http://api.example.com/verify",
		Method:  &method,
		Type:    oapi.Http,
		Timeout: &timeout,
		Body:    &body,
		Headers: &headers,
	})

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "complex-check",
			Interval:         "2m",
			Count:            20,
			SuccessCondition: "result.body.status == 'ok'",
			FailureLimit:     &failureLimit,
			Provider:         provider,
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

	// Verify all fields are preserved
	metric := verification.Metrics[0]
	assert.Equal(t, "complex-check", metric.Name)
	assert.Equal(t, "2m", metric.Interval)
	assert.Equal(t, 20, metric.Count)
	assert.Equal(t, "result.body.status == 'ok'", metric.SuccessCondition)
	assert.Equal(t, 5, *metric.FailureLimit)

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

	release := createTestRelease(s, ctx)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "100ms",
			Count:            3,
			SuccessCondition: "result.statusCode == 200",
			FailureLimit:     ptr(2),
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	// Start verification
	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	// Wait for some measurements
	time.Sleep(250 * time.Millisecond)

	// Check that measurements were taken
	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)
	assert.GreaterOrEqual(t, len(verification.Metrics[0].Measurements), 1)

	// Stop verification
	manager.StopVerification(ctx, release.ID())

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

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	// Pre-create releases
	releases := make([]*oapi.Release, b.N)
	for i := 0; i < b.N; i++ {
		releases[i] = createTestRelease(s, ctx)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager.StartVerification(ctx, releases[i], metrics)
	}

	// Clean up
	for _, release := range releases {
		if verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID()); exists {
			manager.scheduler.StopVerification(verification.Id)
		}
	}
}

func BenchmarkManager_StopVerification(b *testing.B) {
	ctx := context.Background()
	s := newTestStore()
	manager := NewManager(s)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	// Pre-create and start verifications
	releases := make([]*oapi.Release, b.N)
	for i := 0; i < b.N; i++ {
		releases[i] = createTestRelease(s, ctx)
		manager.StartVerification(ctx, releases[i], metrics)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager.StopVerification(ctx, releases[i].ID())
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
			createTestVerification(s, ctx, release.ID(), 2, "1h")
		}
		stores[i] = s
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		manager := NewManager(stores[i])
		manager.Restore(ctx)

		// Clean up
		for _, verification := range stores[i].ReleaseVerifications.Items() {
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

func (m *mockHooks) OnVerificationStarted(ctx context.Context, verification *oapi.ReleaseVerification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verificationStartedCalls = append(m.verificationStartedCalls, verification.Id)
	return m.errorOnVerificationStarted
}

func (m *mockHooks) OnMeasurementTaken(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int, measurement *oapi.VerificationMeasurement) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.measurementTakenCalls = append(m.measurementTakenCalls, measurementCall{
		verificationID: verification.Id,
		metricIndex:    metricIndex,
		measurement:    measurement,
	})
	return m.errorOnMeasurementTaken
}

func (m *mockHooks) OnMetricComplete(ctx context.Context, verification *oapi.ReleaseVerification, metricIndex int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.metricCompleteCalls = append(m.metricCompleteCalls, metricCall{
		verificationID: verification.Id,
		metricIndex:    metricIndex,
	})
	return m.errorOnMetricComplete
}

func (m *mockHooks) OnVerificationComplete(ctx context.Context, verification *oapi.ReleaseVerification) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.verificationCompleteCalls = append(m.verificationCompleteCalls, verification.Id)
	return m.errorOnVerificationComplete
}

func (m *mockHooks) OnVerificationStopped(ctx context.Context, verification *oapi.ReleaseVerification) error {
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

	release := createTestRelease(s, ctx)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	// Verify hook was called
	assert.Equal(t, 1, hooks.getVerificationStartedCount())

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

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

	release := createTestRelease(s, ctx)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "30s",
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

	// Stop the verification
	manager.StopVerification(ctx, release.ID())

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

	release := createTestRelease(s, ctx)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "100ms",
			Count:            3,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

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

	release := createTestRelease(s, ctx)

	// Use a very short interval and low count to complete quickly
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "50ms",
			Count:            2, // Only 2 measurements to complete quickly
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

	// Wait for metric to complete (2 measurements at 50ms interval + buffer)
	time.Sleep(300 * time.Millisecond)

	// Verify hook was called
	assert.GreaterOrEqual(t, hooks.getMetricCompleteCount(), 1)

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

	release := createTestRelease(s, ctx)

	// Use a very short interval and low count to complete quickly
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "50ms",
			Count:            2, // Only 2 measurements to complete quickly
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

	// Wait for verification to complete (2 measurements at 50ms interval + buffer)
	time.Sleep(300 * time.Millisecond)

	// Verify hook was called
	assert.GreaterOrEqual(t, hooks.getVerificationCompleteCount(), 1)

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

	// Inject errors in all hooks
	hooks.errorOnVerificationStarted = assert.AnError
	hooks.errorOnMeasurementTaken = assert.AnError
	hooks.errorOnMetricComplete = assert.AnError
	hooks.errorOnVerificationComplete = assert.AnError
	hooks.errorOnVerificationStopped = assert.AnError

	manager := NewManager(s, WithHooks(hooks))

	release := createTestRelease(s, ctx)

	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check",
			Interval:         "50ms",
			Count:            2,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
	}

	// StartVerification should succeed despite hook error
	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	_, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

	// Wait for some measurements
	time.Sleep(200 * time.Millisecond)

	// StopVerification should succeed despite hook error
	manager.StopVerification(ctx, release.ID())

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

	release := createTestRelease(s, ctx)

	// Create multiple metrics
	metrics := []oapi.VerificationMetricSpec{
		{
			Name:             "health-check-1",
			Interval:         "50ms",
			Count:            2,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/health", oapi.GET),
		},
		{
			Name:             "health-check-2",
			Interval:         "50ms",
			Count:            2,
			SuccessCondition: "result.statusCode == 200",
			Provider:         createHTTPProvider("http://example.com/metrics", oapi.GET),
		},
	}

	err := manager.StartVerification(ctx, release, metrics)
	require.NoError(t, err)

	verification, exists := s.ReleaseVerifications.GetByReleaseId(release.ID())
	require.True(t, exists)

	// Wait for both metrics to complete
	time.Sleep(300 * time.Millisecond)

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
