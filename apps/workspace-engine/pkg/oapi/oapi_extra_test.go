package oapi

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelease_UUID(t *testing.T) {
	release := &Release{
		ReleaseTarget: ReleaseTarget{
			DeploymentId:  "dep-1",
			EnvironmentId: "env-1",
			ResourceId:    "res-1",
		},
		Version: DeploymentVersion{
			Id:  "ver-1",
			Tag: "v1.0.0",
		},
		CreatedAt: "2024-01-01T00:00:00Z",
	}

	u1 := release.UUID()
	u2 := release.UUID()
	assert.Equal(t, u1, u2, "UUID should be deterministic")
	assert.NotEqual(t, u1.String(), "00000000-0000-0000-0000-000000000000", "UUID should not be nil UUID")
}

func TestVerificationMetricSpec_GetInterval(t *testing.T) {
	spec := &VerificationMetricSpec{
		IntervalSeconds: 30,
	}
	assert.Equal(t, 30*time.Second, spec.GetInterval())
}

func TestVerificationMetricSpec_GetFailureLimit(t *testing.T) {
	// Nil threshold
	spec := &VerificationMetricSpec{}
	assert.Equal(t, 0, spec.GetFailureLimit())

	// Non-nil threshold
	limit := 5
	spec2 := &VerificationMetricSpec{FailureThreshold: &limit}
	assert.Equal(t, 5, spec2.GetFailureLimit())
}

func TestVerificationMetricStatus_GetInterval(t *testing.T) {
	status := &VerificationMetricStatus{
		IntervalSeconds: 60,
	}
	assert.Equal(t, 60*time.Second, status.GetInterval())
}

func TestVerificationMetricStatus_GetFailureLimit(t *testing.T) {
	// Nil threshold
	status := &VerificationMetricStatus{}
	assert.Equal(t, 0, status.GetFailureLimit())

	// Non-nil threshold
	limit := 3
	status2 := &VerificationMetricStatus{FailureThreshold: &limit}
	assert.Equal(t, 3, status2.GetFailureLimit())
}

func TestJobVerification_StartedAt(t *testing.T) {
	now := time.Now()

	// No metrics
	jv := &JobVerification{
		Id:        "jv-1",
		JobId:     "job-1",
		CreatedAt: now,
	}
	assert.Nil(t, jv.StartedAt())

	// With metrics
	t1 := now.Add(-10 * time.Minute)
	t2 := now.Add(-5 * time.Minute)

	jv2 := &JobVerification{
		Id:        "jv-2",
		JobId:     "job-2",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:  "metric-1",
				Count: 2,
				Measurements: []VerificationMeasurement{
					{MeasuredAt: t2, Status: Passed},
				},
			},
			{
				Name:  "metric-2",
				Count: 2,
				Measurements: []VerificationMeasurement{
					{MeasuredAt: t1, Status: Passed},
				},
			},
		},
	}
	started := jv2.StartedAt()
	require.NotNil(t, started)
	assert.Equal(t, t1, *started, "Should return earliest measurement time")
}

func TestJobVerification_CompletedAt(t *testing.T) {
	now := time.Now()

	// Running verification (not complete)
	jv := &JobVerification{
		Id:        "jv-1",
		JobId:     "job-1",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:  "metric-1",
				Count: 3,
				Measurements: []VerificationMeasurement{
					{MeasuredAt: now, Status: Passed},
					// Only 1 of 3 measurements → still running
				},
			},
		},
	}
	assert.Nil(t, jv.CompletedAt(), "Should be nil when still running")

	// Completed verification
	t1 := now.Add(-10 * time.Minute)
	t2 := now.Add(-5 * time.Minute)
	jv2 := &JobVerification{
		Id:        "jv-2",
		JobId:     "job-2",
		CreatedAt: now,
		Metrics: []VerificationMetricStatus{
			{
				Name:  "metric-1",
				Count: 1,
				Measurements: []VerificationMeasurement{
					{MeasuredAt: t1, Status: Passed},
				},
			},
			{
				Name:  "metric-2",
				Count: 1,
				Measurements: []VerificationMeasurement{
					{MeasuredAt: t2, Status: Passed},
				},
			},
		},
	}
	completed := jv2.CompletedAt()
	require.NotNil(t, completed)
	assert.Equal(t, t2, *completed, "Should return latest measurement time when complete")
}

func TestRelatableEntity_Item(t *testing.T) {
	// Resource
	resource := &Resource{
		Id:          "res-1",
		Name:        "test",
		Kind:        "service",
		WorkspaceId: "ws-1",
	}
	resEntity := &RelatableEntity{}
	err := resEntity.FromResource(*resource)
	require.NoError(t, err)
	item := resEntity.Item()
	require.NotNil(t, item)
	resItem, ok := item.(*Resource)
	require.True(t, ok)
	assert.Equal(t, "res-1", resItem.Id)

	// Deployment
	deployment := &Deployment{
		Id:        "dep-1",
		Name:      "test-deploy",
		Slug:      "test-deploy",
		SystemIds: []string{"sys-1"},
	}
	depEntity := &RelatableEntity{}
	err = depEntity.FromDeployment(*deployment)
	require.NoError(t, err)
	item = depEntity.Item()
	require.NotNil(t, item)
	depItem, ok := item.(*Deployment)
	require.True(t, ok)
	assert.Equal(t, "dep-1", depItem.Id)

	// Environment
	env := &Environment{
		Id:        "env-1",
		Name:      "production",
		SystemIds: []string{"sys-1"},
	}
	envEntity := &RelatableEntity{}
	err = envEntity.FromEnvironment(*env)
	require.NoError(t, err)
	item = envEntity.Item()
	require.NotNil(t, item)
	envItem, ok := item.(*Environment)
	require.True(t, ok)
	assert.Equal(t, "env-1", envItem.Id)
}
