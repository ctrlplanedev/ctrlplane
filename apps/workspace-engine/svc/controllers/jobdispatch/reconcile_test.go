package jobdispatch

import (
	"context"
	"testing"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	releaseTargetExists     bool
	releaseTargetExistsErr  error
	desiredRelease          *oapi.Release
	desiredReleaseErr       error
	jobsForRelease          []oapi.Job
	jobsForReleaseErr       error
	activeJobs              []oapi.Job
	activeJobsErr           error
	agents                  []oapi.JobAgent
	agentsErr               error
	verificationPolicies    []oapi.VerificationMetricSpec
	verificationPoliciesErr error
}

func (m *mockGetter) ReleaseTargetExists(_ context.Context, _ *ReleaseTarget) (bool, error) {
	return m.releaseTargetExists, m.releaseTargetExistsErr
}

func (m *mockGetter) GetDesiredRelease(_ context.Context, _ *ReleaseTarget) (*oapi.Release, error) {
	return m.desiredRelease, m.desiredReleaseErr
}

func (m *mockGetter) GetJobsForRelease(_ context.Context, _ uuid.UUID) ([]oapi.Job, error) {
	return m.jobsForRelease, m.jobsForReleaseErr
}

func (m *mockGetter) GetActiveJobsForTarget(_ context.Context, _ *ReleaseTarget) ([]oapi.Job, error) {
	return m.activeJobs, m.activeJobsErr
}

func (m *mockGetter) GetJobAgentsForDeployment(_ context.Context, _ uuid.UUID) ([]oapi.JobAgent, error) {
	return m.agents, m.agentsErr
}

func (m *mockGetter) GetVerificationPolicies(_ context.Context, _ *ReleaseTarget) ([]oapi.VerificationMetricSpec, error) {
	return m.verificationPolicies, m.verificationPoliciesErr
}

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type createJobWithVerificationCall struct {
	Job   *oapi.Job
	Specs []oapi.VerificationMetricSpec
}

type mockSetter struct {
	createCalls []createJobWithVerificationCall
	createErr   error
}

func (m *mockSetter) UpdateJob(_ context.Context, _ string, _ oapi.JobStatus, _ string) error {
	return nil
}

func (m *mockSetter) CreateJobWithVerification(_ context.Context, job *oapi.Job, specs []oapi.VerificationMetricSpec) error {
	m.createCalls = append(m.createCalls, createJobWithVerificationCall{Job: job, Specs: specs})
	return m.createErr
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func sleepProvider(t *testing.T) oapi.MetricProvider {
	t.Helper()
	var p oapi.MetricProvider
	require.NoError(t, p.FromSleepMetricProvider(oapi.SleepMetricProvider{
		DurationSeconds: 5,
	}))
	return p
}

func makeSpec(name string, provider oapi.MetricProvider) oapi.VerificationMetricSpec {
	return oapi.VerificationMetricSpec{
		Name:             name,
		IntervalSeconds:  30,
		Count:            3,
		SuccessCondition: "true",
		Provider:         provider,
	}
}

func testRelease() *oapi.Release {
	return &oapi.Release{
		CreatedAt: "2025-01-01T00:00:00Z",
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  uuid.New().String(),
			EnvironmentId: uuid.New().String(),
			ResourceId:    uuid.New().String(),
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		Version: oapi.DeploymentVersion{
			Id:  uuid.New().String(),
			Tag: "v1.0.0",
		},
	}
}

func testReleaseTarget() *ReleaseTarget {
	return &ReleaseTarget{
		DeploymentID:  uuid.New(),
		EnvironmentID: uuid.New(),
		ResourceID:    uuid.New(),
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestReconcile_NoDesiredRelease(t *testing.T) {
	getter := &mockGetter{desiredRelease: nil}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.createCalls)
}

func TestReconcile_AlreadySuccessful(t *testing.T) {
	rel := testRelease()
	getter := &mockGetter{
		desiredRelease: rel,
		jobsForRelease: []oapi.Job{
			{Id: uuid.New().String(), Status: oapi.JobStatusSuccessful},
		},
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.RequeueAfter)
	assert.Empty(t, setter.createCalls)
}

func TestReconcile_ActiveJobsRequeue(t *testing.T) {
	rel := testRelease()
	getter := &mockGetter{
		desiredRelease: rel,
		jobsForRelease: []oapi.Job{},
		activeJobs: []oapi.Job{
			{Id: uuid.New().String(), Status: oapi.JobStatusInProgress},
		},
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	require.NotNil(t, result.RequeueAfter)
	assert.Empty(t, setter.createCalls)
}

func TestReconcile_CreatesJobWithoutVerifications(t *testing.T) {
	rel := testRelease()
	agentID := uuid.New().String()

	getter := &mockGetter{
		desiredRelease:       rel,
		jobsForRelease:       []oapi.Job{},
		activeJobs:           []oapi.Job{},
		agents:               []oapi.JobAgent{{Id: agentID, Config: oapi.JobAgentConfig{}}},
		verificationPolicies: nil,
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	require.Len(t, setter.createCalls, 1)
	assert.Equal(t, agentID, setter.createCalls[0].Job.JobAgentId)
	assert.Empty(t, setter.createCalls[0].Specs)
}

func TestReconcile_CreatesJobWithPolicyVerifications(t *testing.T) {
	rel := testRelease()
	agentID := uuid.New().String()
	prov := sleepProvider(t)

	policySpec := makeSpec("policy-check", prov)
	getter := &mockGetter{
		desiredRelease:       rel,
		jobsForRelease:       []oapi.Job{},
		activeJobs:           []oapi.Job{},
		agents:               []oapi.JobAgent{{Id: agentID, Config: oapi.JobAgentConfig{}}},
		verificationPolicies: []oapi.VerificationMetricSpec{policySpec},
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 1)
	assert.Equal(t, "policy-check", setter.createCalls[0].Specs[0].Name)
}

func TestReconcile_CreatesJobWithAgentConfigVerifications(t *testing.T) {
	rel := testRelease()
	agentID := uuid.New().String()

	agentConfig := oapi.JobAgentConfig{
		"verifications": []interface{}{
			map[string]interface{}{
				"name":             "agent-health",
				"intervalSeconds":  30,
				"count":            5,
				"successCondition": "result.ok == true",
				"provider": map[string]interface{}{
					"type":            "sleep",
					"durationSeconds": 1,
				},
			},
		},
	}

	getter := &mockGetter{
		desiredRelease:       rel,
		jobsForRelease:       []oapi.Job{},
		activeJobs:           []oapi.Job{},
		agents:               []oapi.JobAgent{{Id: agentID, Config: agentConfig}},
		verificationPolicies: nil,
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 1)
	assert.Equal(t, "agent-health", setter.createCalls[0].Specs[0].Name)
}

func TestReconcile_MergesAndDeduplicatesPolicyAndAgentSpecs(t *testing.T) {
	rel := testRelease()
	agentID := uuid.New().String()
	prov := sleepProvider(t)

	policySpec := makeSpec("shared-check", prov)
	policySpec.Count = 5

	agentConfig := oapi.JobAgentConfig{
		"verifications": []interface{}{
			map[string]interface{}{
				"name":             "shared-check",
				"intervalSeconds":  60,
				"count":            99,
				"successCondition": "true",
				"provider": map[string]interface{}{
					"type":            "sleep",
					"durationSeconds": 1,
				},
			},
			map[string]interface{}{
				"name":             "agent-only",
				"intervalSeconds":  10,
				"count":            2,
				"successCondition": "true",
				"provider": map[string]interface{}{
					"type":            "sleep",
					"durationSeconds": 1,
				},
			},
		},
	}

	getter := &mockGetter{
		desiredRelease:       rel,
		jobsForRelease:       []oapi.Job{},
		activeJobs:           []oapi.Job{},
		agents:               []oapi.JobAgent{{Id: agentID, Config: agentConfig}},
		verificationPolicies: []oapi.VerificationMetricSpec{policySpec},
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	require.Len(t, setter.createCalls, 1)
	specs := setter.createCalls[0].Specs
	require.Len(t, specs, 2)

	assert.Equal(t, "shared-check", specs[0].Name)
	assert.Equal(t, 5, specs[0].Count, "policy spec should win over agent for duplicate name")
	assert.Equal(t, "agent-only", specs[1].Name)
}

func TestReconcile_MultipleAgents(t *testing.T) {
	rel := testRelease()
	prov := sleepProvider(t)

	getter := &mockGetter{
		desiredRelease: rel,
		jobsForRelease: []oapi.Job{},
		activeJobs:     []oapi.Job{},
		agents: []oapi.JobAgent{
			{Id: uuid.New().String(), Config: oapi.JobAgentConfig{}},
			{Id: uuid.New().String(), Config: oapi.JobAgentConfig{}},
		},
		verificationPolicies: []oapi.VerificationMetricSpec{makeSpec("check", prov)},
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), getter, setter, testReleaseTarget())
	require.NoError(t, err)
	assert.Nil(t, result.RequeueAfter)

	require.Len(t, setter.createCalls, 2)
	for _, call := range setter.createCalls {
		require.Len(t, call.Specs, 1)
		assert.Equal(t, "check", call.Specs[0].Name)
	}
}
