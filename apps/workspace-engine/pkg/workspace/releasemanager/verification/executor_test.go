package verification

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewMeasurementExecutor(t *testing.T) {
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	assert.NotNil(t, executor)
	assert.NotNil(t, executor.store)
}

func TestExecutor_Execute_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	// Create a test HTTP server that returns 200
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status": "healthy"}`))
	}))
	defer server.Close()

	// Create release
	release := createTestRelease(s, ctx)
	metric := createHTTPMetricStatus(server.URL)

	// Execute measurement with direct objects
	measurement, err := executor.Execute(ctx, &metric, release.ID())

	require.NoError(t, err)
	assert.Equal(t, oapi.Passed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
}

func TestExecutor_Execute_ReleaseNotFound(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	metric := createHTTPMetricStatus("http://example.com/health")
	nonExistentReleaseID := "non-existent-release-id"

	_, err := executor.Execute(ctx, &metric, nonExistentReleaseID)

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to build provider context")
	assert.Contains(t, err.Error(), "release not found")
}

func TestExecutor_Execute_FailedMeasurement(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	// Create a test HTTP server that returns 500
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"error": "internal server error"}`))
	}))
	defer server.Close()

	release := createTestRelease(s, ctx)
	metric := createHTTPMetricStatus(server.URL)

	// Execute measurement - should not error but should fail
	// (success condition not met, no failure condition = binary pass/fail)
	measurement, err := executor.Execute(ctx, &metric, release.ID())

	require.NoError(t, err)
	assert.Equal(t, oapi.Failed, measurement.Status)
	assert.NotNil(t, measurement.Data)
}

func TestExecutor_Execute_ContextCancellation(t *testing.T) {
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	// Create a server that delays response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(5 * time.Second)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	release := createTestRelease(s, ctx)
	metric := createHTTPMetricStatus(server.URL)

	// Execute should fail due to context timeout
	_, err := executor.Execute(ctx, &metric, release.ID())

	assert.Error(t, err)
}

func TestExecutor_Execute_WithTemplatedURL(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	// Create a test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	release := createTestRelease(s, ctx)

	// Create metric with templated URL (templates use release context)
	metric := createHTTPMetricStatus(server.URL + "/{{.release.version.tag}}")

	// Execute - template should be resolved
	measurement, err := executor.Execute(ctx, &metric, release.ID())

	require.NoError(t, err)
	assert.Equal(t, oapi.Passed, measurement.Status)
}

func TestExecutor_BuildProviderContext_Success(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	release := createTestRelease(s, ctx)

	providerCtx, err := executor.BuildProviderContext(release.ID())

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

func TestExecutor_BuildProviderContext_ReleaseNotFound(t *testing.T) {
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	nonExistentID := uuid.New().String()
	providerCtx, err := executor.BuildProviderContext(nonExistentID)

	assert.Error(t, err)
	assert.Nil(t, providerCtx)
	assert.Contains(t, err.Error(), "release not found")
}

func TestExecutor_BuildProviderContext_WithVariables(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	executor := NewMeasurementExecutor(s)

	release := createTestRelease(s, ctx)

	// Add variables to release
	envVal := oapi.LiteralValue{}
	_ = envVal.FromStringValue("production")
	versionVal := oapi.LiteralValue{}
	_ = versionVal.FromStringValue("1.2.3")
	release.Variables = map[string]oapi.LiteralValue{
		"env":     envVal,
		"version": versionVal,
	}
	_ = s.Releases.Upsert(ctx, release)

	providerCtx, err := executor.BuildProviderContext(release.ID())

	require.NoError(t, err)
	require.NotNil(t, providerCtx)
	assert.Equal(t, 2, len(providerCtx.Variables))
	assert.Contains(t, providerCtx.Variables, "env")
	assert.Contains(t, providerCtx.Variables, "version")
}

// Helper function to create an HTTP metric status
func createHTTPMetricStatus(url string) oapi.VerificationMetricStatus {
	method := oapi.GET
	timeout := "5s"
	httpProvider := oapi.HTTPMetricProvider{
		Url:     url,
		Method:  &method,
		Type:    oapi.Http,
		Timeout: &timeout,
	}
	provider := oapi.MetricProvider{}
	_ = provider.FromHTTPMetricProvider(httpProvider)

	return oapi.VerificationMetricStatus{
		Name:             "test-metric",
		IntervalSeconds:  60,
		Count:            5,
		SuccessCondition: "result.statusCode == 200",
		FailureThreshold: ptr(2),
		Provider:         provider,
		Measurements:     []oapi.VerificationMeasurement{},
	}
}
