package verification_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/action"
	verificationaction "workspace-engine/pkg/workspace/releasemanager/action/verification"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type starterCall struct {
	JobID string
	Specs []oapi.VerificationMetricSpec
}

type mockStarter struct {
	mu    sync.Mutex
	calls []starterCall
	err   error
}

func (m *mockStarter) StartVerification(_ context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.calls = append(m.calls, starterCall{JobID: job.Id, Specs: specs})
	return m.err
}

func (m *mockStarter) callCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.calls)
}

func (m *mockStarter) lastCall() starterCall {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.calls[len(m.calls)-1]
}

func newRelease() *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    uuid.New().String(),
			EnvironmentId: uuid.New().String(),
			DeploymentId:  uuid.New().String(),
		},
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			Tag:          "v1.0.0",
			DeploymentId: uuid.New().String(),
			CreatedAt:    time.Now(),
		},
		Variables: map[string]oapi.LiteralValue{},
	}
}

func newJob(releaseID string) *oapi.Job {
	return &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: releaseID,
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}
}

func createPolicyWithVerification(metrics []oapi.VerificationMetricSpec, triggerOn *oapi.VerificationRuleTriggerOn) *oapi.Policy {
	return &oapi.Policy{
		Id:        uuid.New().String(),
		Name:      "test-policy",
		Enabled:   true,
		Priority:  1,
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
		Rules: []oapi.PolicyRule{
			{
				Id:        uuid.New().String(),
				PolicyId:  uuid.New().String(),
				CreatedAt: time.Now().Format(time.RFC3339),
				Verification: &oapi.VerificationRule{
					Metrics:   metrics,
					TriggerOn: triggerOn,
				},
			},
		},
		Metadata: map[string]string{},
	}
}

func createPolicyWithRules(rules []oapi.PolicyRule) *oapi.Policy {
	return &oapi.Policy{
		Id:        uuid.New().String(),
		Name:      "test-policy",
		Enabled:   true,
		Priority:  1,
		CreatedAt: time.Now().Format(time.RFC3339),
		Selector:  "true",
		Rules:     rules,
		Metadata:  map[string]string{},
	}
}

func createTestMetric(name string) oapi.VerificationMetricSpec {
	provider := oapi.MetricProvider{}
	_ = provider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 1,
	})
	return oapi.VerificationMetricSpec{
		Name:             name,
		IntervalSeconds:  30,
		Count:            3,
		SuccessCondition: "result.ok == true",
		Provider:         provider,
	}
}

func TestVerificationAction_Name(t *testing.T) {
	starter := &mockStarter{}
	a := verificationaction.NewVerificationAction(starter)
	assert.Equal(t, "verification", a.Name())
}

func TestVerificationAction_Execute_NoMetrics(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_CreatesVerification(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("health-check")},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	assert.Equal(t, 1, starter.callCount())
	call := starter.lastCall()
	assert.Equal(t, job.Id, call.JobID)
	require.Len(t, call.Specs, 1)
	assert.Equal(t, "health-check", call.Specs[0].Name)
}

func TestVerificationAction_Execute_SkipsDisabledPolicy(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("health-check")},
		&triggerOn,
	)
	policy.Enabled = false

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_SkipsWrongTrigger(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobFailure
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("health-check")},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_DefaultsTriggerToJobSuccess(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("health-check")},
		nil,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 1, starter.callCount())
	assert.Len(t, starter.lastCall().Specs, 1)
}

func TestVerificationAction_Execute_DeduplicatesMetrics(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy1 := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{
			createTestMetric("health-check"),
			createTestMetric("latency-check"),
		},
		&triggerOn,
	)
	policy2 := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{
			createTestMetric("health-check"),
			createTestMetric("error-rate"),
		},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy1, policy2},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	assert.Equal(t, 1, starter.callCount())
	call := starter.lastCall()
	assert.Len(t, call.Specs, 3)

	names := make(map[string]bool)
	for _, s := range call.Specs {
		names[s.Name] = true
	}
	assert.True(t, names["health-check"])
	assert.True(t, names["latency-check"])
	assert.True(t, names["error-rate"])
}

func TestVerificationAction_Execute_TriggerJobCreated(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())
	job.Status = oapi.JobStatusPending

	triggerOn := oapi.JobCreated
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("startup-check")},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobCreated, actx)
	require.NoError(t, err)
	assert.Equal(t, 1, starter.callCount())
	assert.Equal(t, "startup-check", starter.lastCall().Specs[0].Name)
}

func TestVerificationAction_Execute_TriggerJobStarted(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())
	job.Status = oapi.JobStatusInProgress

	triggerOn := oapi.JobStarted
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("progress-check")},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobStarted, actx)
	require.NoError(t, err)
	assert.Equal(t, 1, starter.callCount())
	assert.Equal(t, "progress-check", starter.lastCall().Specs[0].Name)
}

func TestVerificationAction_Execute_TriggerJobFailure(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())
	job.Status = oapi.JobStatusFailure

	triggerOn := oapi.JobFailure
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("failure-analysis")},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobFailure, actx)
	require.NoError(t, err)
	assert.Equal(t, 1, starter.callCount())
	assert.Equal(t, "failure-analysis", starter.lastCall().Specs[0].Name)
}

func TestVerificationAction_Execute_PolicyWithMixedRules(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithRules([]oapi.PolicyRule{
		{
			Id:        uuid.New().String(),
			PolicyId:  uuid.New().String(),
			CreatedAt: time.Now().Format(time.RFC3339),
			AnyApproval: &oapi.AnyApprovalRule{
				MinApprovals: 2,
			},
		},
		{
			Id:        uuid.New().String(),
			PolicyId:  uuid.New().String(),
			CreatedAt: time.Now().Format(time.RFC3339),
			Verification: &oapi.VerificationRule{
				Metrics:   []oapi.VerificationMetricSpec{createTestMetric("health-check")},
				TriggerOn: &triggerOn,
			},
		},
	})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 1, starter.callCount())
	assert.Len(t, starter.lastCall().Specs, 1)
	assert.Equal(t, "health-check", starter.lastCall().Specs[0].Name)
}

func TestVerificationAction_Execute_MultipleVerificationRulesInPolicy(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithRules([]oapi.PolicyRule{
		{
			Id:        uuid.New().String(),
			PolicyId:  uuid.New().String(),
			CreatedAt: time.Now().Format(time.RFC3339),
			Verification: &oapi.VerificationRule{
				Metrics:   []oapi.VerificationMetricSpec{createTestMetric("health-check")},
				TriggerOn: &triggerOn,
			},
		},
		{
			Id:        uuid.New().String(),
			PolicyId:  uuid.New().String(),
			CreatedAt: time.Now().Format(time.RFC3339),
			Verification: &oapi.VerificationRule{
				Metrics: []oapi.VerificationMetricSpec{
					createTestMetric("latency-check"),
					createTestMetric("error-rate"),
				},
				TriggerOn: &triggerOn,
			},
		},
	})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	assert.Equal(t, 1, starter.callCount())
	call := starter.lastCall()
	assert.Len(t, call.Specs, 3)

	names := make(map[string]bool)
	for _, s := range call.Specs {
		names[s.Name] = true
	}
	assert.True(t, names["health-check"])
	assert.True(t, names["latency-check"])
	assert.True(t, names["error-rate"])
}

func TestVerificationAction_Execute_NilVerificationRule(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	policy := createPolicyWithRules([]oapi.PolicyRule{
		{
			Id:           uuid.New().String(),
			PolicyId:     uuid.New().String(),
			CreatedAt:    time.Now().Format(time.RFC3339),
			Verification: nil,
		},
	})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_EmptyMetricsArray(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithRules([]oapi.PolicyRule{
		{
			Id:        uuid.New().String(),
			PolicyId:  uuid.New().String(),
			CreatedAt: time.Now().Format(time.RFC3339),
			Verification: &oapi.VerificationRule{
				Metrics:   []oapi.VerificationMetricSpec{},
				TriggerOn: &triggerOn,
			},
		},
	})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_NilPoliciesSlice(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: nil,
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_PolicyWithNoRules(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	policy := createPolicyWithRules([]oapi.PolicyRule{})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)
	assert.Equal(t, 0, starter.callCount())
}

func TestVerificationAction_Execute_MetricSpecsAreCorrectlyPassed(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	provider := oapi.MetricProvider{}
	_ = provider.FromSleepMetricProvider(oapi.SleepMetricProvider{
		Type:            oapi.Sleep,
		DurationSeconds: 5,
	})
	failureLimit := 2
	metric := oapi.VerificationMetricSpec{
		Name:             "detailed-health-check",
		IntervalSeconds:  60,
		Count:            10,
		SuccessCondition: "result.statusCode == 200",
		FailureThreshold: &failureLimit,
		Provider:         provider,
	}

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{metric},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	assert.Equal(t, 1, starter.callCount())
	call := starter.lastCall()
	assert.Equal(t, job.Id, call.JobID)
	require.Len(t, call.Specs, 1)

	spec := call.Specs[0]
	assert.Equal(t, "detailed-health-check", spec.Name)
	assert.EqualValues(t, 60, spec.IntervalSeconds)
	assert.EqualValues(t, 10, spec.Count)
	assert.Equal(t, "result.statusCode == 200", spec.SuccessCondition)
	require.NotNil(t, spec.FailureThreshold)
	assert.Equal(t, 2, *spec.FailureThreshold)
}

func TestVerificationAction_Execute_MultipleMetrics(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{
			createTestMetric("health-check"),
			createTestMetric("latency-check"),
			createTestMetric("error-rate"),
		},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	assert.Equal(t, 1, starter.callCount())
	assert.Len(t, starter.lastCall().Specs, 3)
}

func TestVerificationAction_Execute_StarterError(t *testing.T) {
	ctx := context.Background()
	starter := &mockStarter{err: assert.AnError}
	vAction := verificationaction.NewVerificationAction(starter)

	release := newRelease()
	job := newJob(release.ID())

	triggerOn := oapi.JobSuccess
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("health-check")},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	assert.Error(t, err)
	assert.Equal(t, 1, starter.callCount())
}
