package verification

import (
	"context"
	"sync"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Helper functions
func ptr[T any](v T) *T {
	return &v
}

func newTestStore() *store.Store {
	changeset := statechange.NewChangeSet[any]()
	return store.New("test-workspace-"+uuid.New().String(), changeset)
}

func createTestRelease(s *store.Store, ctx context.Context) *oapi.Release {
	// Create system
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:          systemId,
		Name:        "test-system",
		Description: ptr("Test system"),
	}
	s.Systems.Upsert(ctx, system)

	// Create resource
	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Version:    "1.0.0",
		Identifier: "test-res-1",
		Metadata:   map[string]string{},
		Config:     map[string]interface{}{},
		CreatedAt:  time.Now(),
	}
	s.Resources.Upsert(ctx, resource)

	// Create environment
	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:          environmentId,
		Name:        "test-env",
		Description: ptr("Test environment"),
		SystemId:    systemId,
	}
	selector := &oapi.Selector{}
	selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	s.Environments.Upsert(ctx, environment)

	// Create deployment
	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:          deploymentId,
		Name:        "test-deployment",
		Slug:        "test-deployment",
		Description: ptr("Test deployment"),
		SystemId:    systemId,
	}
	deploymentSelector := &oapi.Selector{}
	deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	s.Deployments.Upsert(ctx, deployment)

	// Create version
	versionId := uuid.New().String()
	version := &oapi.DeploymentVersion{
		Id:           versionId,
		Tag:          "v1.0.0",
		DeploymentId: deploymentId,
		CreatedAt:    time.Now(),
	}
	s.DeploymentVersions.Upsert(ctx, versionId, version)

	// Create release target
	releaseTarget := &oapi.ReleaseTarget{
		ResourceId:    resourceId,
		EnvironmentId: environmentId,
		DeploymentId:  deploymentId,
	}
	s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create release
	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
	}
	s.Releases.Upsert(ctx, release)

	return release
}

func createTestVerification(s *store.Store, ctx context.Context, releaseID string, metricCount int, interval string) *oapi.ReleaseVerification {
	metrics := make([]oapi.VerificationMetricStatus, metricCount)
	for i := 0; i < metricCount; i++ {
		// Create a simple HTTP provider config
		method := oapi.GET
		httpProvider := oapi.HTTPMetricProvider{
			Url:    "http://example.com/health",
			Method: &method,
			Type:   oapi.Http,
		}
		provider := oapi.MetricProvider{}
		provider.FromHTTPMetricProvider(httpProvider)

		metrics[i] = oapi.VerificationMetricStatus{
			Name:             "metric-" + uuid.New().String()[:8],
			Interval:         interval,
			Count:            5,
			SuccessCondition: "result.statusCode == 200",
			FailureLimit:     ptr(2),
			Provider:         provider,
			Measurements:     []oapi.VerificationMeasurement{},
		}
	}

	verification := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: releaseID,
		Metrics:   metrics,
		CreatedAt: time.Now(),
	}

	s.ReleaseVerifications.Upsert(ctx, verification)
	return verification
}

// Tests

func TestNewScheduler(t *testing.T) {
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	assert.NotNil(t, scheduler)
	assert.NotNil(t, scheduler.store)
	assert.NotNil(t, scheduler.cancelFuncs)
	assert.Equal(t, 0, len(scheduler.cancelFuncs))
}

func TestScheduler_StartVerification_NotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	// Try to start a verification that doesn't exist
	nonExistentID := uuid.New().String()
	scheduler.StartVerification(ctx, nonExistentID)

	// Should not panic and should not create any cancel functions
	scheduler.mu.Lock()
	assert.Equal(t, 0, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()
}

func TestScheduler_StartVerification_AlreadyRunning(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1h")

	// Start verification first time
	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	cancelFuncs1 := scheduler.cancelFuncs[verification.Id]
	scheduler.mu.Unlock()

	assert.Equal(t, 1, len(cancelFuncs1))

	// Try to start again - should be a no-op
	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	cancelFuncs2 := scheduler.cancelFuncs[verification.Id]
	scheduler.mu.Unlock()

	// Should be the same cancel functions
	assert.Equal(t, len(cancelFuncs1), len(cancelFuncs2))

	// Clean up
	scheduler.StopVerification(verification.Id)
}

func TestScheduler_StartVerification_AlreadyCompleted(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1h")

	// Mark all metrics as complete by adding measurements
	for i := range verification.Metrics {
		for j := 0; j < verification.Metrics[i].Count; j++ {
			msg := "Success"
			verification.Metrics[i].Measurements = append(verification.Metrics[i].Measurements, oapi.VerificationMeasurement{
				Message:    &msg,
				Passed:     true,
				MeasuredAt: time.Now(),
				Data:       &map[string]any{"statusCode": 200},
			})
		}
	}
	s.ReleaseVerifications.Upsert(ctx, verification)

	// Try to start - should not start any goroutines
	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	assert.Equal(t, 0, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()
}

func TestScheduler_StartVerification_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 3, "1h")

	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	cancelFuncs := scheduler.cancelFuncs[verification.Id]
	scheduler.mu.Unlock()

	assert.Equal(t, 3, len(cancelFuncs), "should have one cancel func per metric")

	// Clean up
	scheduler.StopVerification(verification.Id)
}

func TestScheduler_StopVerification(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 2, "1h")

	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	assert.Equal(t, 1, len(scheduler.cancelFuncs))
	assert.Equal(t, 2, len(scheduler.cancelFuncs[verification.Id]))
	scheduler.mu.Unlock()

	// Stop the verification
	scheduler.StopVerification(verification.Id)

	scheduler.mu.Lock()
	assert.Equal(t, 0, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()
}

func TestScheduler_StopVerification_NotRunning(t *testing.T) {
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	nonExistentID := uuid.New().String()

	// Should not panic
	assert.NotPanics(t, func() {
		scheduler.StopVerification(nonExistentID)
	})
}

func TestScheduler_StopVerification_MultipleTimes(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 1, "1h")

	scheduler.StartVerification(ctx, verification.Id)
	scheduler.StopVerification(verification.Id)

	// Stop again - should not panic
	assert.NotPanics(t, func() {
		scheduler.StopVerification(verification.Id)
	})
}

func TestScheduler_BuildProviderContext_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	providerCtx, err := scheduler.buildProviderContext(release.ID())

	require.NoError(t, err)
	require.NotNil(t, providerCtx)
	assert.Equal(t, release, providerCtx.Release)
	assert.NotNil(t, providerCtx.Resource)
	assert.NotNil(t, providerCtx.Environment)
	assert.NotNil(t, providerCtx.Version)
	assert.NotNil(t, providerCtx.Target)
	assert.NotNil(t, providerCtx.Deployment)
	assert.NotNil(t, providerCtx.Variables)
}

func TestScheduler_BuildProviderContext_ReleaseNotFound(t *testing.T) {
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	nonExistentID := uuid.New().String()
	providerCtx, err := scheduler.buildProviderContext(nonExistentID)

	assert.Error(t, err)
	assert.Nil(t, providerCtx)
	assert.Contains(t, err.Error(), "release not found")
}

func TestScheduler_BuildProviderContext_WithVariables(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	// Add variables to release
	envVal := oapi.LiteralValue{}
	envVal.FromStringValue("production")
	versionVal := oapi.LiteralValue{}
	versionVal.FromStringValue("1.2.3")
	release.Variables = map[string]oapi.LiteralValue{
		"env":     envVal,
		"version": versionVal,
	}
	s.Releases.Upsert(ctx, release)

	providerCtx, err := scheduler.buildProviderContext(release.ID())

	require.NoError(t, err)
	require.NotNil(t, providerCtx)
	assert.Equal(t, 2, len(providerCtx.Variables))
	assert.Contains(t, providerCtx.Variables, "env")
	assert.Contains(t, providerCtx.Variables, "version")
}

func TestScheduler_ConcurrentStartStop(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	// Create multiple verifications
	verificationIDs := make([]string, 10)
	for i := 0; i < 10; i++ {
		release := createTestRelease(s, ctx)
		verification := createTestVerification(s, ctx, release.ID(), 2, "1h")
		verificationIDs[i] = verification.Id
	}

	var wg sync.WaitGroup

	// Concurrently start all verifications
	for _, vid := range verificationIDs {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			scheduler.StartVerification(ctx, id)
		}(vid)
	}

	wg.Wait()

	// Verify all started
	scheduler.mu.Lock()
	assert.Equal(t, 10, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()

	// Concurrently stop all verifications
	for _, vid := range verificationIDs {
		wg.Add(1)
		go func(id string) {
			defer wg.Done()
			scheduler.StopVerification(id)
		}(vid)
	}

	wg.Wait()

	// Verify all stopped
	scheduler.mu.Lock()
	assert.Equal(t, 0, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()
}

func TestScheduler_MultipleMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	// Create verification with 5 metrics
	verification := createTestVerification(s, ctx, release.ID(), 5, "1h")

	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	cancelFuncs := scheduler.cancelFuncs[verification.Id]
	scheduler.mu.Unlock()

	assert.Equal(t, 5, len(cancelFuncs), "should have one goroutine per metric")

	// Clean up
	scheduler.StopVerification(verification.Id)
}

func TestScheduler_RestartAfterStop(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)
	verification := createTestVerification(s, ctx, release.ID(), 2, "1h")

	// Start, stop, start again
	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	assert.Equal(t, 1, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()

	scheduler.StopVerification(verification.Id)

	scheduler.mu.Lock()
	assert.Equal(t, 0, len(scheduler.cancelFuncs))
	scheduler.mu.Unlock()

	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	assert.Equal(t, 1, len(scheduler.cancelFuncs))
	assert.Equal(t, 2, len(scheduler.cancelFuncs[verification.Id]))
	scheduler.mu.Unlock()

	// Clean up
	scheduler.StopVerification(verification.Id)
}

func TestScheduler_VerificationWithNoMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	verification := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Metrics:   []oapi.VerificationMetricStatus{},
		CreatedAt: time.Now(),
	}
	s.ReleaseVerifications.Upsert(ctx, verification)

	// Should handle empty metrics gracefully
	scheduler.StartVerification(ctx, verification.Id)

	scheduler.mu.Lock()
	cancelFuncs := scheduler.cancelFuncs[verification.Id]
	scheduler.mu.Unlock()

	assert.Equal(t, 0, len(cancelFuncs))
}

// Integration test: verify measurements are actually taken
func TestScheduler_Integration_MeasurementsTaken(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	// Create verification with very short interval for testing
	verification := createTestVerification(s, ctx, release.ID(), 1, "100ms")

	// Start the verification
	scheduler.StartVerification(ctx, verification.Id)

	// Wait for some measurements to be taken
	// Note: measurements will fail because we're using a mock HTTP endpoint
	// but we're just testing that the goroutine is running
	time.Sleep(350 * time.Millisecond)

	// Get updated verification from store
	updatedVerification, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)

	// Should have at least 2-3 measurements (initial + 2-3 ticks)
	totalMeasurements := 0
	for _, metric := range updatedVerification.Metrics {
		totalMeasurements += len(metric.Measurements)
	}

	assert.GreaterOrEqual(t, totalMeasurements, 2, "should have taken at least 2 measurements")
	assert.LessOrEqual(t, totalMeasurements, 5, "should not have taken too many measurements")

	// Clean up
	scheduler.StopVerification(verification.Id)
}

// Test that goroutines stop when metrics are complete
func TestScheduler_Integration_StopsWhenMetricsComplete(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	// Create verification with 1 measurement count
	verification := createTestVerification(s, ctx, release.ID(), 1, "50ms")
	verification.Metrics[0].Count = 1 // Only take 1 measurement
	s.ReleaseVerifications.Upsert(ctx, verification)

	// Start the verification
	scheduler.StartVerification(ctx, verification.Id)

	// Wait for initial measurement plus some buffer time
	time.Sleep(200 * time.Millisecond)

	// Get updated verification
	updatedVerification, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)

	// Should have exactly 1 measurement (goroutine should have stopped)
	assert.Equal(t, 1, len(updatedVerification.Metrics[0].Measurements))

	// Clean up
	scheduler.StopVerification(verification.Id)
}

// Test that verification stops early on failure limit
func TestScheduler_Integration_StopsOnFailureLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	// Create verification with failure limit of 2
	verification := createTestVerification(s, ctx, release.ID(), 1, "50ms")
	verification.Metrics[0].Count = 10            // Allow up to 10 measurements
	verification.Metrics[0].FailureLimit = ptr(2) // But stop after 2 failures
	s.ReleaseVerifications.Upsert(ctx, verification)

	// Start the verification
	scheduler.StartVerification(ctx, verification.Id)

	// Wait for measurements (they will fail since the HTTP endpoint doesn't exist)
	time.Sleep(300 * time.Millisecond)

	// Get updated verification
	updatedVerification, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)

	// Should have stopped after reaching failure limit
	measurementCount := len(updatedVerification.Metrics[0].Measurements)
	assert.GreaterOrEqual(t, measurementCount, 2, "should have at least 2 measurements")
	assert.LessOrEqual(t, measurementCount, 4, "should have stopped near failure limit, not taken all 10")

	// Clean up
	scheduler.StopVerification(verification.Id)
}

// Test concurrent measurements across multiple metrics
func TestScheduler_Integration_ConcurrentMetrics(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	release := createTestRelease(s, ctx)

	// Create verification with 3 metrics
	verification := createTestVerification(s, ctx, release.ID(), 3, "100ms")

	// Start the verification
	scheduler.StartVerification(ctx, verification.Id)

	// Wait for measurements
	time.Sleep(350 * time.Millisecond)

	// Get updated verification
	updatedVerification, ok := s.ReleaseVerifications.Get(verification.Id)
	require.True(t, ok)

	// Each metric should have taken measurements
	for i, metric := range updatedVerification.Metrics {
		assert.GreaterOrEqual(t, len(metric.Measurements), 2,
			"metric %d should have taken at least 2 measurements", i)
	}

	// Clean up
	scheduler.StopVerification(verification.Id)
}

// Benchmark tests
func BenchmarkScheduler_StartVerification(b *testing.B) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	// Pre-create verifications
	verificationIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		release := createTestRelease(s, ctx)
		verification := createTestVerification(s, ctx, release.ID(), 2, "1h")
		verificationIDs[i] = verification.Id
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		scheduler.StartVerification(ctx, verificationIDs[i])
	}

	// Clean up
	for _, vid := range verificationIDs {
		scheduler.StopVerification(vid)
	}
}

func BenchmarkScheduler_StopVerification(b *testing.B) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	// Pre-create and start verifications
	verificationIDs := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		release := createTestRelease(s, ctx)
		verification := createTestVerification(s, ctx, release.ID(), 2, "1h")
		verificationIDs[i] = verification.Id
		scheduler.StartVerification(ctx, verification.Id)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		scheduler.StopVerification(verificationIDs[i])
	}
}

func BenchmarkScheduler_ConcurrentOperations(b *testing.B) {
	ctx := context.Background()
	s := newTestStore()
	scheduler := newScheduler(s, DefaultHooks())

	// Pre-create verifications
	verificationIDs := make([]string, 100)
	for i := 0; i < 100; i++ {
		release := createTestRelease(s, ctx)
		verification := createTestVerification(s, ctx, release.ID(), 2, "1h")
		verificationIDs[i] = verification.Id
	}

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			vid := verificationIDs[i%100]
			if i%2 == 0 {
				scheduler.StartVerification(ctx, vid)
			} else {
				scheduler.StopVerification(vid)
			}
			i++
		}
	})

	// Clean up
	for _, vid := range verificationIDs {
		scheduler.StopVerification(vid)
	}
}
