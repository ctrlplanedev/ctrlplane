package metrics

import (
	"context"
	"encoding/json"
	"testing"
	"workspace-engine/svc/controllers/jobverificationmetric/metrics/provider"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createSleepMetric(successCondition string, failureCondition *string) *VerificationMetric {
	return &VerificationMetric{
		Name:             "test-metric",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: successCondition,
		FailureCondition: failureCondition,
		FailureThreshold: int32Ptr(1),
		Provider:         json.RawMessage(`{"type":"sleep","durationSeconds":0}`),
		Measurements:     []Measurement{},
	}
}

func int32Ptr(v int32) *int32 { return &v }

func TestMeasure_SuccessConditionPasses_NoFailureCondition(t *testing.T) {
	ctx := context.Background()
	metric := createSleepMetric("result.ok == true", nil)

	measurement, err := Measure(ctx, metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, StatusPassed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Success condition met", measurement.Message)
}

func TestMeasure_SuccessConditionFails_NoFailureCondition_Failed(t *testing.T) {
	ctx := context.Background()
	metric := createSleepMetric("result.ok == false", nil)

	measurement, err := Measure(ctx, metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, StatusFailed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Success condition not met", measurement.Message)
}

func TestMeasure_SuccessConditionPasses_FailureConditionNotTriggered(t *testing.T) {
	ctx := context.Background()
	failureCondition := "result.ok == false"
	metric := createSleepMetric("result.ok == true", &failureCondition)

	measurement, err := Measure(ctx, metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, StatusPassed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
}

func TestMeasure_FailureConditionTriggered(t *testing.T) {
	ctx := context.Background()
	failureCondition := "result.ok == true"
	metric := createSleepMetric("result.ok == true", &failureCondition)

	measurement, err := Measure(ctx, metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, StatusFailed, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Failure condition met", measurement.Message)
}

func TestMeasure_NeitherConditionMet_Inconclusive(t *testing.T) {
	ctx := context.Background()
	failureCondition := `result.ok == "other"`
	metric := createSleepMetric("result.ok == false", &failureCondition)

	measurement, err := Measure(ctx, metric, &provider.ProviderContext{})

	require.NoError(t, err)
	assert.Equal(t, StatusInconclusive, measurement.Status)
	assert.NotNil(t, measurement.Data)
	assert.NotZero(t, measurement.MeasuredAt)
	assert.Equal(t, "Waiting for success or failure condition", measurement.Message)
}

func TestMeasure_InvalidSuccessCondition(t *testing.T) {
	ctx := context.Background()
	metric := createSleepMetric("this is not valid CEL {{{}}", nil)

	_, err := Measure(ctx, metric, &provider.ProviderContext{})
	assert.Error(t, err)
}

func TestMeasure_EmptySuccessCondition(t *testing.T) {
	ctx := context.Background()
	metric := createSleepMetric("", nil)

	_, err := Measure(ctx, metric, &provider.ProviderContext{})
	assert.Error(t, err)
}

func TestMeasure_InvalidFailureCondition(t *testing.T) {
	ctx := context.Background()
	failureCondition := "this is not valid CEL {{{}}"
	metric := createSleepMetric("result.ok == true", &failureCondition)

	_, err := Measure(ctx, metric, &provider.ProviderContext{})
	assert.Error(t, err)
}

func TestMeasure_InvalidProvider(t *testing.T) {
	ctx := context.Background()
	metric := &VerificationMetric{
		Name:             "test-metric",
		IntervalSeconds:  1,
		Count:            1,
		SuccessCondition: "result.ok == true",
		FailureThreshold: int32Ptr(1),
		Provider:         json.RawMessage(`{}`),
		Measurements:     []Measurement{},
	}

	_, err := Measure(ctx, metric, &provider.ProviderContext{})
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "failed to create provider")
}
