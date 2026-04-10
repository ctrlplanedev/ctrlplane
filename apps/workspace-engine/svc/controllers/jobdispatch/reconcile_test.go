package jobdispatch

import (
	"context"
	"fmt"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	release                 *oapi.Release
	releaseErr              error
	jobAgents               map[string]*oapi.JobAgent
	jobAgentErr             error
	verificationPolicies    []oapi.VerificationMetricSpec
	verificationPoliciesErr error
}

func (m *mockGetter) GetJob(_ context.Context, _ uuid.UUID) (*oapi.Job, error) {
	return nil, nil
}

func (m *mockGetter) GetRelease(_ context.Context, _ uuid.UUID) (*oapi.Release, error) {
	return m.release, m.releaseErr
}

func (m *mockGetter) GetJobAgent(_ context.Context, id uuid.UUID) (*oapi.JobAgent, error) {
	if m.jobAgentErr != nil {
		return nil, m.jobAgentErr
	}
	agent, ok := m.jobAgents[id.String()]
	if !ok {
		return nil, fmt.Errorf("agent %s not found", id)
	}
	return agent, nil
}

func (m *mockGetter) GetVerificationPolicies(
	_ context.Context,
	_ *ReleaseTarget,
) ([]oapi.VerificationMetricSpec, error) {
	return m.verificationPolicies, m.verificationPoliciesErr
}

func (m *mockGetter) IsWorkflowJob(_ context.Context, _ uuid.UUID) (bool, error) {
	return false, nil
}

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type createVerificationsCall struct {
	Job   *oapi.Job
	Specs []oapi.VerificationMetricSpec
}

type mockSetter struct {
	createCalls []createVerificationsCall
	createErr   error
}

func (m *mockSetter) UpdateJob(
	_ context.Context,
	_ string,
	_ oapi.JobStatus,
	_ string,
	_ map[string]string,
) error {
	return nil
}

func (m *mockSetter) CreateVerifications(
	_ context.Context,
	job *oapi.Job,
	specs []oapi.VerificationMetricSpec,
) error {
	m.createCalls = append(m.createCalls, createVerificationsCall{Job: job, Specs: specs})
	return m.createErr
}

// ---------------------------------------------------------------------------
// Mock Dispatcher
// ---------------------------------------------------------------------------

type mockDispatcher struct {
	dispatchCalls []*oapi.Job
	dispatchErr   error
}

func (m *mockDispatcher) Dispatch(_ context.Context, job *oapi.Job) error {
	m.dispatchCalls = append(m.dispatchCalls, job)
	return m.dispatchErr
}

// ---------------------------------------------------------------------------
// Mock AgentVerifier
// ---------------------------------------------------------------------------

type mockVerifier struct {
	specs map[string][]oapi.VerificationMetricSpec
}

func (m *mockVerifier) AgentVerifications(
	agentType string,
	_ oapi.JobAgentConfig,
) ([]oapi.VerificationMetricSpec, error) {
	return m.specs[agentType], nil
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

func testJob(releaseID string) *oapi.Job {
	now := time.Now()
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      releaseID,
		JobAgentId:     uuid.New().String(),
		JobAgentConfig: oapi.JobAgentConfig{},
		Status:         oapi.JobStatusPending,
		Metadata:       map[string]string{},
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func testRelease(deploymentID string) *oapi.Release {
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
			Id:           uuid.New().String(),
			DeploymentId: deploymentID,
			Tag:          "v1.0.0",
		},
	}
}

func setupGetterWithAgents(agents []oapi.JobAgent) (*oapi.Job, *mockGetter) {
	agentMap := make(map[string]*oapi.JobAgent, len(agents))
	for i := range agents {
		agentMap[agents[i].Id] = &agents[i]
	}

	deploymentID := uuid.New().String()
	release := testRelease(deploymentID)
	job := testJob(release.Id.String())

	if len(agents) > 0 {
		job.JobAgentId = agents[0].Id
	}

	getter := &mockGetter{
		release:   release,
		jobAgents: agentMap,
	}
	return job, getter
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestReconcile_GetReleaseFails(t *testing.T) {
	job := testJob(uuid.New().String())
	getter := &mockGetter{releaseErr: fmt.Errorf("release not found")}
	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{specs: map[string][]oapi.VerificationMetricSpec{}}

	_, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.Error(t, err)
	assert.Empty(t, dispatcher.dispatchCalls)
}

func TestReconcile_AgentNotFound(t *testing.T) {
	job, getter := setupGetterWithAgents(nil)
	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{specs: map[string][]oapi.VerificationMetricSpec{}}

	_, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.Error(t, err)
	assert.Empty(t, dispatcher.dispatchCalls)
}

func TestReconcile_DispatchesWithoutVerifications(t *testing.T) {
	agentID := uuid.New().String()
	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Config: oapi.JobAgentConfig{}},
	})
	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{specs: map[string][]oapi.VerificationMetricSpec{}}

	result, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.NoError(t, err)
	assert.NotNil(t, result)

	require.Len(t, dispatcher.dispatchCalls, 1)
	assert.Equal(t, job, dispatcher.dispatchCalls[0])

	require.Len(t, setter.createCalls, 1)
	assert.Empty(t, setter.createCalls[0].Specs)
}

func TestReconcile_DispatchesWithPolicyVerifications(t *testing.T) {
	agentID := uuid.New().String()
	prov := sleepProvider(t)
	policySpec := makeSpec("policy-check", prov)

	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Config: oapi.JobAgentConfig{}},
	})
	getter.verificationPolicies = []oapi.VerificationMetricSpec{policySpec}

	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{specs: map[string][]oapi.VerificationMetricSpec{}}

	result, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.NoError(t, err)
	assert.NotNil(t, result)

	require.Len(t, dispatcher.dispatchCalls, 1)
	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 1)
	assert.Equal(t, "policy-check", setter.createCalls[0].Specs[0].Name)
}

func TestReconcile_DispatchesWithAgentVerifications(t *testing.T) {
	agentID := uuid.New().String()
	prov := sleepProvider(t)

	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Type: "argo-cd", Config: oapi.JobAgentConfig{}},
	})

	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{
		specs: map[string][]oapi.VerificationMetricSpec{
			"argo-cd": {makeSpec("agent-health", prov)},
		},
	}

	result, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.NoError(t, err)
	assert.NotNil(t, result)

	require.Len(t, dispatcher.dispatchCalls, 1)
	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 1)
	assert.Equal(t, "agent-health", setter.createCalls[0].Specs[0].Name)
}

func TestReconcile_MergesAndDeduplicatesPolicyAndAgentSpecs(t *testing.T) {
	agentID := uuid.New().String()
	prov := sleepProvider(t)

	policySpec := makeSpec("shared-check", prov)
	policySpec.Count = 5

	agentDupSpec := makeSpec("shared-check", prov)
	agentDupSpec.Count = 99
	agentOnlySpec := makeSpec("agent-only", prov)
	agentOnlySpec.Count = 2

	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Type: "test-agent", Config: oapi.JobAgentConfig{}},
	})
	getter.verificationPolicies = []oapi.VerificationMetricSpec{policySpec}

	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{
		specs: map[string][]oapi.VerificationMetricSpec{
			"test-agent": {agentDupSpec, agentOnlySpec},
		},
	}

	result, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.NoError(t, err)
	assert.NotNil(t, result)

	require.Len(t, setter.createCalls, 1)
	specs := setter.createCalls[0].Specs
	require.Len(t, specs, 2)

	assert.Equal(t, "shared-check", specs[0].Name)
	assert.Equal(t, 5, specs[0].Count, "policy spec should win over agent for duplicate name")
	assert.Equal(t, "agent-only", specs[1].Name)
}

func TestReconcile_TemplatesConditionsFromDispatchContext(t *testing.T) {
	agentID := uuid.New().String()

	resource := &oapi.Resource{Name: "prod-server"}
	dispatchCtx := &oapi.DispatchContext{
		Resource: resource,
	}

	prov := sleepProvider(t)
	policySpec := oapi.VerificationMetricSpec{
		Name:             "resource-check",
		IntervalSeconds:  30,
		Count:            3,
		SuccessCondition: `result.json.resource == "{{ .resource.name }}"`,
		Provider:         prov,
	}

	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Config: oapi.JobAgentConfig{}},
	})
	job.DispatchContext = dispatchCtx
	getter.verificationPolicies = []oapi.VerificationMetricSpec{policySpec}

	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{specs: map[string][]oapi.VerificationMetricSpec{}}

	_, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.NoError(t, err)

	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 1)
	assert.Equal(
		t,
		`result.json.resource == "prod-server"`,
		setter.createCalls[0].Specs[0].SuccessCondition,
	)
}

func TestReconcile_AgentContributesMultipleSpecs(t *testing.T) {
	agentID := uuid.New().String()
	prov := sleepProvider(t)

	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Type: "argo-cd", Config: oapi.JobAgentConfig{}},
	})

	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{
		specs: map[string][]oapi.VerificationMetricSpec{
			"argo-cd": {makeSpec("argo-check", prov), makeSpec("argo-health", prov)},
		},
	}

	result, err := Reconcile(
		context.Background(),
		getter,
		setter,
		verifier,
		dispatcher,
		job,
	)
	require.NoError(t, err)
	assert.NotNil(t, result)

	require.Len(t, dispatcher.dispatchCalls, 1)
	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 2)
}
