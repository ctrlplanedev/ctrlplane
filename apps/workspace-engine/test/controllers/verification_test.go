package controllers_test

import (
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/verification/metrics/provider"
	"workspace-engine/svc/controllers/verification"
	. "workspace-engine/test/controllers/harness"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func sleepProvider() oapi.MetricProvider {
	var p oapi.MetricProvider
	_ = p.FromSleepMetricProvider(oapi.SleepMetricProvider{DurationSeconds: 0})
	return p
}

func newVerification(jobID string, metrics ...oapi.VerificationMetricStatus) *oapi.JobVerification {
	return &oapi.JobVerification{
		Id:        uuid.New().String(),
		JobId:     jobID,
		CreatedAt: time.Now(),
		Metrics:   metrics,
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

func measurement(status oapi.VerificationMeasurementStatus) oapi.VerificationMeasurement {
	return oapi.VerificationMeasurement{
		Status:     status,
		MeasuredAt: time.Now().Add(-time.Minute),
	}
}

func verificationGetter(v *oapi.JobVerification, job *oapi.Job) *VerificationGetter {
	return &VerificationGetter{
		Verifications: map[string]*oapi.JobVerification{v.Id: v},
		Jobs:          map[string]*oapi.Job{job.Id: job},
		ProviderCtx:   &provider.ProviderContext{},
		ReleaseTarget: &verification.ReleaseTarget{
			WorkspaceID:   uuid.New().String(),
			DeploymentID:  uuid.New().String(),
			EnvironmentID: uuid.New().String(),
			ResourceID:    uuid.New().String(),
		},
	}
}

// ---------------------------------------------------------------------------
// Reconcile-level tests: metric measurement flow
// ---------------------------------------------------------------------------

func TestVerification_FirstMeasurement_Requeues(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("health-check", 3, "true"))
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{
		VerificationID: v.Id,
		MetricIndex:    0,
	}

	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1, "should record one measurement")
	assert.Equal(t, v.Id, setter.RecordedMeasurements[0].VerificationID)
	assert.Equal(t, 0, setter.RecordedMeasurements[0].MetricIndex)

	require.NotNil(t, result.RequeueAfter, "should requeue for next measurement")
}

func TestVerification_AllMeasurementsPass_Completes(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric := metricStatus("health-check", 2, "true")
	metric.Measurements = []oapi.VerificationMeasurement{
		measurement(oapi.Passed),
	}
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{
		VerificationID: v.Id,
		MetricIndex:    0,
	}

	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	assert.Equal(t, oapi.Passed, setter.RecordedMeasurements[0].Measurement.Status)

	assert.Nil(t, result.RequeueAfter, "should not requeue — verification is complete")
	assert.Contains(t, setter.Messages[v.Id], "passed")
	require.Len(t, setter.EnqueuedTargets, 1, "should enqueue desired-release re-evaluation")
}

func TestVerification_FailureLimitExceeded_Fails(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric := metricStatus("health-check", 5, "false")
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{
		VerificationID: v.Id,
		MetricIndex:    0,
	}

	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	assert.Equal(t, oapi.Failed, setter.RecordedMeasurements[0].Measurement.Status)

	assert.Nil(t, result.RequeueAfter, "should not requeue — failure stops metric")
	assert.Contains(t, setter.Messages[v.Id], "failed")
	require.Len(t, setter.EnqueuedTargets, 1)
}

func TestVerification_NotFound_NoOp(t *testing.T) {
	getter := &VerificationGetter{
		Verifications: map[string]*oapi.JobVerification{},
		Jobs:          map[string]*oapi.Job{},
	}
	setter := &VerificationSetter{}

	scope := &verification.VerificationMetricScope{
		VerificationID: "nonexistent",
		MetricIndex:    0,
	}

	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.RecordedMeasurements)
}

func TestVerification_InvalidMetricIndex_Errors(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}
	v := newVerification(jobID, metricStatus("check", 3, "true"))
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{}

	scope := &verification.VerificationMetricScope{
		VerificationID: v.Id,
		MetricIndex:    5,
	}

	_, err := verification.Reconcile(t.Context(), getter, setter, scope)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "metric index")
}

func TestVerification_AlreadyComplete_ChecksOverallStatus(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric := metricStatus("health-check", 1, "true")
	metric.Measurements = []oapi.VerificationMeasurement{
		measurement(oapi.Passed),
	}
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{
		VerificationID: v.Id,
		MetricIndex:    0,
	}

	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	assert.Empty(t, setter.RecordedMeasurements, "should not take another measurement")
	assert.Nil(t, result.RequeueAfter)
	assert.Contains(t, setter.Messages[v.Id], "passed")
	require.Len(t, setter.EnqueuedTargets, 1)
}

// ---------------------------------------------------------------------------
// Multi-metric verification
// ---------------------------------------------------------------------------

func TestVerification_MultipleMetrics_AllMustPass(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric1 := metricStatus("check-a", 1, "true")
	metric1.Measurements = []oapi.VerificationMeasurement{measurement(oapi.Passed)}

	metric2 := metricStatus("check-b", 1, "true")
	metric2.Measurements = []oapi.VerificationMeasurement{measurement(oapi.Passed)}

	v := newVerification(jobID, metric1, metric2)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope0 := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 0}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope0)
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	assert.Contains(t, setter.Messages[v.Id], "passed")
	require.Len(t, setter.EnqueuedTargets, 1)
}

func TestVerification_MultipleMetrics_OneRunning_StaysRunning(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric1 := metricStatus("check-a", 1, "true")
	metric1.Measurements = []oapi.VerificationMeasurement{measurement(oapi.Passed)}

	metric2 := metricStatus("check-b", 3, "true")

	v := newVerification(jobID, metric1, metric2)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope0 := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 0}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope0)
	require.NoError(t, err)

	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.Messages, "should not set message while metric-b is still running")
	assert.Empty(t, setter.EnqueuedTargets, "should not enqueue while metric-b is still running")
}

func TestVerification_MultipleMetrics_OneFails_OverallFails(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric1 := metricStatus("check-a", 1, "true")
	metric1.Measurements = []oapi.VerificationMeasurement{measurement(oapi.Passed)}

	metric2 := metricStatus("check-b", 3, "false")
	metric2.Measurements = []oapi.VerificationMeasurement{measurement(oapi.Failed)}

	v := newVerification(jobID, metric1, metric2)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope1 := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 1}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope1)
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	assert.Contains(t, setter.Messages[v.Id], "failed")
	require.Len(t, setter.EnqueuedTargets, 1)
}

// ---------------------------------------------------------------------------
// Success threshold
// ---------------------------------------------------------------------------

func TestVerification_SuccessThreshold_RequiresConsecutivePasses(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	threshold := 2
	metric := metricStatus("check", 5, "true")
	metric.SuccessThreshold = &threshold
	metric.Measurements = []oapi.VerificationMeasurement{
		measurement(oapi.Passed),
	}
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 0}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	assert.Equal(t, oapi.Passed, setter.RecordedMeasurements[0].Measurement.Status)

	assert.Nil(t, result.RequeueAfter, "two consecutive passes met threshold — complete")
	assert.Contains(t, setter.Messages[v.Id], "passed")
}

// ---------------------------------------------------------------------------
// Failure threshold
// ---------------------------------------------------------------------------

func TestVerification_FailureThreshold_ContinuesBelowLimit(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	failureThreshold := 2
	metric := metricStatus("check", 5, "false")
	metric.FailureThreshold = &failureThreshold
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 0}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	require.Len(t, setter.RecordedMeasurements, 1)
	require.NotNil(t, result.RequeueAfter, "below failure threshold — should continue")
}

func TestVerification_FailureThreshold_ExceedsLimit_Stops(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	failureThreshold := 1
	metric := metricStatus("check", 5, "false")
	metric.FailureThreshold = &failureThreshold
	metric.Measurements = []oapi.VerificationMeasurement{
		measurement(oapi.Failed),
	}
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 0}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	assert.Nil(t, result.RequeueAfter, "above failure threshold — should stop")
	assert.Contains(t, setter.Messages[v.Id], "failed")
}

// ---------------------------------------------------------------------------
// Interval guard
// ---------------------------------------------------------------------------

func TestVerification_IntervalNotElapsed_Defers(t *testing.T) {
	jobID := uuid.New().String()
	job := &oapi.Job{Id: jobID, ReleaseId: uuid.New().String()}

	metric := metricStatus("check", 3, "true")
	metric.Measurements = []oapi.VerificationMeasurement{
		{Status: oapi.Passed, MeasuredAt: time.Now()},
	}
	v := newVerification(jobID, metric)
	getter := verificationGetter(v, job)
	setter := &VerificationSetter{Getter: getter}

	scope := &verification.VerificationMetricScope{VerificationID: v.Id, MetricIndex: 0}
	result, err := verification.Reconcile(t.Context(), getter, setter, scope)
	require.NoError(t, err)

	assert.Empty(t, setter.RecordedMeasurements, "should not take a measurement — interval not elapsed")
	require.NotNil(t, result.RequeueAfter, "should requeue with remaining time")
	assert.Greater(t, *result.RequeueAfter, time.Duration(0))
}
