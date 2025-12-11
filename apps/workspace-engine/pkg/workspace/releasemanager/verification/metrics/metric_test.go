package metrics

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createSleepMetricStatus(successCondition string, failureCondition *string) oapi.VerificationMetricStatus {
	sleepProvider := oapi.SleepMetricProvider{
		Type:     oapi.Sleep,
		Duration: 0,
	}
	providerCfg := oapi.MetricProvider{}
	_ = providerCfg.FromSleepMetricProvider(sleepProvider)

	return oapi.VerificationMetricStatus{
		Name:             "test-metric",
		Interval:         "1s",
		Count:            1,
		SuccessCondition: successCondition,
		FailureCondition: failureCondition,
		FailureLimit:     ptr(1),
		Provider:         providerCfg,
		Measurements:     []oapi.VerificationMeasurement{},
	}
}

func ptr[T any](v T) *T {
	return &v
}

func TestMeasure_SuccessConditionPasses_NoFailureCondition(t *testing.T) {
	ctx := context.Background()
	metric := createSleepMetricStatus("result.ok == true", nil)

	measurement, err := Measure(ctx, &metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, oapi.Passed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Success condition met", *measurement.Message)
}

func TestMeasure_SuccessConditionFails_NoFailureCondition_Failed(t *testing.T) {
	ctx := context.Background()
	// Sleep provider returns {"ok": true}, so checking for false will not match success
	// With no failure condition, this is binary - success not met means failed
	metric := createSleepMetricStatus("result.ok == false", nil)

	measurement, err := Measure(ctx, &metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, oapi.Failed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Success condition not met", *measurement.Message)
}

func TestMeasure_SuccessConditionPasses_FailureConditionNotTriggered(t *testing.T) {
	ctx := context.Background()
	// Success: ok == true (passes)
	// Failure: ok == false (does not trigger)
	failureCondition := "result.ok == false"
	metric := createSleepMetricStatus("result.ok == true", &failureCondition)

	measurement, err := Measure(ctx, &metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, oapi.Passed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
}

func TestMeasure_FailureConditionTriggered(t *testing.T) {
	ctx := context.Background()
	// Failure condition is checked first, so even if success would pass,
	// failure takes precedence
	failureCondition := "result.ok == true"
	metric := createSleepMetricStatus("result.ok == true", &failureCondition)

	measurement, err := Measure(ctx, &metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, oapi.Failed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Failure condition met", *measurement.Message)
}

func TestMeasure_NeitherConditionMet_Inconclusive(t *testing.T) {
	ctx := context.Background()
	failureCondition := `result.ok == "other"`
	metric := createSleepMetricStatus("result.ok == false", &failureCondition)

	measurement, err := Measure(ctx, &metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, oapi.Inconclusive, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Waiting for success or failure condition", *measurement.Message)
}

func TestMeasure_InvalidSuccessCondition(t *testing.T) {
	ctx := context.Background()
	// Invalid CEL expression
	metric := createSleepMetricStatus("this is not valid CEL {{{}}", nil)

	_, err := Measure(ctx, &metric, &provider.ProviderContext{})

	assert.Error(t, err)
}

func TestMeasure_EmptySuccessCondition(t *testing.T) {
	ctx := context.Background()
	metric := createSleepMetricStatus("", nil)

	_, err := Measure(ctx, &metric, &provider.ProviderContext{})

	assert.Error(t, err)
}

func TestMeasure_InvalidFailureCondition(t *testing.T) {
	ctx := context.Background()
	// Valid success condition, invalid failure condition
	failureCondition := "this is not valid CEL {{{}}"
	metric := createSleepMetricStatus("result.ok == true", &failureCondition)

	_, err := Measure(ctx, &metric, &provider.ProviderContext{})

	assert.Error(t, err)
}

func TestMeasure_InvalidProvider(t *testing.T) {
	ctx := context.Background()
	// Create a metric with an invalid/empty provider
	metric := oapi.VerificationMetricStatus{
		Name:             "test-metric",
		Interval:         "1s",
		Count:            1,
		SuccessCondition: "result.ok == true",
		FailureLimit:     ptr(1),
		Provider:         oapi.MetricProvider{}, // Empty provider
		Measurements:     []oapi.VerificationMeasurement{},
	}

	_, err := Measure(ctx, &metric, &provider.ProviderContext{})

	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create provider")
}
