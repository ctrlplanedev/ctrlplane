package jobeligibility

import (
	"context"
	"fmt"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/reconcile"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Mock Getter
// ---------------------------------------------------------------------------

type mockGetter struct {
	rtExists    bool
	rtExistsErr error

	release    *oapi.Release
	releaseErr error

	jobs           []*oapi.Job
	processingJobs []*oapi.Job

	policies    []*oapi.Policy
	policiesErr error

	deployment    *oapi.Deployment
	deploymentErr error

	jobAgents   map[string]*oapi.JobAgent
	jobAgentErr error

	environment    *oapi.Environment
	environmentErr error

	resource    *oapi.Resource
	resourceErr error
}

func (m *mockGetter) ReleaseTargetExists(_ context.Context, _ *ReleaseTarget) (bool, error) {
	return m.rtExists, m.rtExistsErr
}

func (m *mockGetter) GetDesiredRelease(_ context.Context, _ *ReleaseTarget) (*oapi.Release, error) {
	return m.release, m.releaseErr
}

func (m *mockGetter) GetJobsForReleaseTarget(_ context.Context, _ *oapi.ReleaseTarget) map[string]*oapi.Job {
	result := make(map[string]*oapi.Job, len(m.jobs))
	for _, j := range m.jobs {
		result[j.Id] = j
	}
	return result
}

func (m *mockGetter) GetJobsInProcessingStateForReleaseTarget(_ context.Context, _ *oapi.ReleaseTarget) map[string]*oapi.Job {
	result := make(map[string]*oapi.Job, len(m.processingJobs))
	for _, j := range m.processingJobs {
		result[j.Id] = j
	}
	return result
}

func (m *mockGetter) GetPoliciesForReleaseTarget(_ context.Context, _ *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	return m.policies, m.policiesErr
}

func (m *mockGetter) GetDeployment(_ context.Context, _ uuid.UUID) (*oapi.Deployment, error) {
	return m.deployment, m.deploymentErr
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

func (m *mockGetter) GetEnvironment(_ context.Context, _ uuid.UUID) (*oapi.Environment, error) {
	return m.environment, m.environmentErr
}

func (m *mockGetter) GetResource(_ context.Context, _ uuid.UUID) (*oapi.Resource, error) {
	return m.resource, m.resourceErr
}

var _ Getter = (*mockGetter)(nil)

// ---------------------------------------------------------------------------
// Mock Setter
// ---------------------------------------------------------------------------

type enqueueCall struct {
	WorkspaceID string
	JobID       string
}

type mockSetter struct {
	createdJobs  []*oapi.Job
	createJobErr error

	enqueueCalls []enqueueCall
	enqueueErr   error
}

func (m *mockSetter) CreateJob(_ context.Context, job *oapi.Job, release *oapi.Release) error {
	if m.createJobErr != nil {
		return m.createJobErr
	}
	m.createdJobs = append(m.createdJobs, job)
	return nil
}

func (m *mockSetter) EnqueueJobDispatch(_ context.Context, workspaceID string, jobID string) error {
	if m.enqueueErr != nil {
		return m.enqueueErr
	}
	m.enqueueCalls = append(m.enqueueCalls, enqueueCall{WorkspaceID: workspaceID, JobID: jobID})
	return nil
}

var _ Setter = (*mockSetter)(nil)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func testRT() *ReleaseTarget {
	return &ReleaseTarget{
		WorkspaceID:   uuid.New(),
		DeploymentID:  uuid.New(),
		EnvironmentID: uuid.New(),
		ResourceID:    uuid.New(),
	}
}

func testRelease(rt *ReleaseTarget) *oapi.Release {
	return &oapi.Release{
		Id:        uuid.New(),
		CreatedAt: time.Now().Format(time.RFC3339),
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		Version: oapi.DeploymentVersion{
			Id:           uuid.New().String(),
			DeploymentId: rt.DeploymentID.String(),
			Tag:          "v1.0.0",
		},
	}
}

func testJobForRelease(release *oapi.Release, status oapi.JobStatus, createdAt time.Time) *oapi.Job {
	return &oapi.Job{
		Id:             uuid.New().String(),
		ReleaseId:      release.Id.String(),
		JobAgentId:     uuid.New().String(),
		JobAgentConfig: oapi.JobAgentConfig{},
		Status:         status,
		CreatedAt:      createdAt,
		UpdatedAt:      createdAt,
		Metadata:       map[string]string{},
	}
}

func testJobWithCompletion(release *oapi.Release, status oapi.JobStatus, createdAt, completedAt time.Time) *oapi.Job {
	job := testJobForRelease(release, status, createdAt)
	job.CompletedAt = &completedAt
	return job
}

func testDeployment(rt *ReleaseTarget, agentRefs ...string) *oapi.Deployment {
	agents := make([]oapi.DeploymentJobAgent, len(agentRefs))
	for i, ref := range agentRefs {
		agents[i] = oapi.DeploymentJobAgent{Ref: ref, Config: oapi.JobAgentConfig{}}
	}
	return &oapi.Deployment{
		Id:             rt.DeploymentID.String(),
		Name:           "test-deployment",
		Slug:           "test-deployment",
		Metadata:       map[string]string{},
		JobAgentConfig: oapi.JobAgentConfig{},
		JobAgents:      &agents,
	}
}

func testPolicy(enabled bool, retryRule *oapi.RetryRule) *oapi.Policy {
	rules := []oapi.PolicyRule{}
	if retryRule != nil {
		rules = append(rules, oapi.PolicyRule{
			Id:       uuid.New().String(),
			PolicyId: uuid.New().String(),
			Retry:    retryRule,
		})
	}
	return &oapi.Policy{
		Id:       uuid.New().String(),
		Enabled:  enabled,
		Name:     "test-policy",
		Rules:    rules,
		Metadata: map[string]string{},
		Selector: "true",
	}
}

func testAgent() *oapi.JobAgent {
	return &oapi.JobAgent{
		Id:     uuid.New().String(),
		Name:   "test-agent",
		Type:   "test",
		Config: oapi.JobAgentConfig{},
	}
}

func setupHappyPath(rt *ReleaseTarget, release *oapi.Release) (*mockGetter, *mockSetter) {
	agent := testAgent()
	deployment := testDeployment(rt, agent.Id)
	getter := &mockGetter{
		rtExists:    true,
		release:     release,
		jobs:        []*oapi.Job{},
		policies:    []*oapi.Policy{},
		deployment:  deployment,
		jobAgents:   map[string]*oapi.JobAgent{agent.Id: agent},
		environment: &oapi.Environment{Id: rt.EnvironmentID.String(), Name: "test-env", Metadata: map[string]string{}},
		resource:    &oapi.Resource{Id: rt.ResourceID.String(), Name: "test-resource", Identifier: "test", Kind: "test", Metadata: map[string]string{}, Config: map[string]interface{}{}},
	}
	setter := &mockSetter{}
	return getter, setter
}

func int32Ptr(v int32) *int32 { return &v }

func backoffStrategy(s oapi.RetryRuleBackoffStrategy) *oapi.RetryRuleBackoffStrategy { return &s }

func scopeID(rt *ReleaseTarget) string {
	return fmt.Sprintf("%s:%s:%s", rt.DeploymentID, rt.EnvironmentID, rt.ResourceID)
}

// ---------------------------------------------------------------------------
// 1. ReleaseTarget parsing
// ---------------------------------------------------------------------------

func TestNewReleaseTarget_Valid(t *testing.T) {
	depID := uuid.New()
	envID := uuid.New()
	resID := uuid.New()
	key := fmt.Sprintf("%s:%s:%s", depID, envID, resID)

	rt, err := NewReleaseTarget(key)
	require.NoError(t, err)
	assert.Equal(t, depID, rt.DeploymentID)
	assert.Equal(t, envID, rt.EnvironmentID)
	assert.Equal(t, resID, rt.ResourceID)
}

func TestNewReleaseTarget_MissingSegment(t *testing.T) {
	key := fmt.Sprintf("%s:%s", uuid.New(), uuid.New())
	_, err := NewReleaseTarget(key)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid release target key")
}

func TestNewReleaseTarget_NonUUID(t *testing.T) {
	key := fmt.Sprintf("not-a-uuid:%s:%s", uuid.New(), uuid.New())
	_, err := NewReleaseTarget(key)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid deployment id")
}

func TestNewReleaseTarget_Empty(t *testing.T) {
	_, err := NewReleaseTarget("")
	require.Error(t, err)
}

func TestNewReleaseTarget_NonUUIDMiddle(t *testing.T) {
	key := fmt.Sprintf("%s:bad:%s", uuid.New(), uuid.New())
	_, err := NewReleaseTarget(key)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid environment id")
}

func TestNewReleaseTarget_NonUUIDLast(t *testing.T) {
	key := fmt.Sprintf("%s:%s:bad", uuid.New(), uuid.New())
	_, err := NewReleaseTarget(key)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "invalid resource id")
}

// ---------------------------------------------------------------------------
// 2. Controller.Process entry point
// ---------------------------------------------------------------------------

func TestProcess_InvalidScopeID(t *testing.T) {
	getter := &mockGetter{}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	item := reconcile.Item{
		ID:          1,
		WorkspaceID: uuid.New().String(),
		ScopeID:     "not-valid",
	}

	_, err := ctrl.Process(context.Background(), item)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse release target")
	assert.Empty(t, setter.createdJobs)
}

func TestProcess_ReleaseTargetNotFound(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{rtExists: false}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	item := reconcile.Item{
		ID:          1,
		WorkspaceID: rt.WorkspaceID.String(),
		ScopeID:     scopeID(rt),
	}

	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.Zero(t, result.RequeueAfter)
	assert.Empty(t, setter.createdJobs)
}

func TestProcess_ReleaseTargetExistsCheckFails(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{rtExistsErr: fmt.Errorf("db error")}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	item := reconcile.Item{
		ID:          1,
		WorkspaceID: rt.WorkspaceID.String(),
		ScopeID:     scopeID(rt),
	}

	_, err := ctrl.Process(context.Background(), item)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "check release target exists")
}

func TestProcess_ReconcileError(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{
		rtExists:   true,
		releaseErr: fmt.Errorf("release fetch failed"),
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	item := reconcile.Item{
		ID:          1,
		WorkspaceID: rt.WorkspaceID.String(),
		ScopeID:     scopeID(rt),
	}

	_, err := ctrl.Process(context.Background(), item)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "reconcile job eligibility")
}

func TestProcess_RequeueOnBackoff(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	completedAt := time.Now().Add(-10 * time.Second)
	failedJob := testJobWithCompletion(release, oapi.JobStatusFailure, completedAt.Add(-time.Second), completedAt)

	agent := testAgent()
	deployment := testDeployment(rt, agent.Id)

	getter := &mockGetter{
		rtExists:   true,
		release:    release,
		jobs:       []*oapi.Job{failedJob},
		policies:   []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 3, BackoffSeconds: int32Ptr(120)})},
		deployment: deployment,
		jobAgents:  map[string]*oapi.JobAgent{agent.Id: agent},
	}
	setter := &mockSetter{}
	ctrl := NewController(getter, setter)

	item := reconcile.Item{
		ID:          1,
		WorkspaceID: rt.WorkspaceID.String(),
		ScopeID:     scopeID(rt),
	}

	result, err := ctrl.Process(context.Background(), item)
	require.NoError(t, err)
	assert.True(t, result.RequeueAfter > 0, "should requeue with positive duration when in backoff")
	assert.Empty(t, setter.createdJobs, "should not create a job during backoff")
}

// ---------------------------------------------------------------------------
// 3. Core Reconcile flow
// ---------------------------------------------------------------------------

func TestReconcile_NoDesiredRelease(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{release: nil}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.NextReconcileAt)
	assert.Empty(t, setter.createdJobs)
}

func TestReconcile_GetDesiredReleaseFails(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{releaseErr: fmt.Errorf("db down")}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get desired release")
}

func TestReconcile_GetPoliciesFails(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter := &mockGetter{release: release, jobs: []*oapi.Job{}, policiesErr: fmt.Errorf("policies error")}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get policies for release target")
}

func TestReconcile_InvalidWorkspaceID(t *testing.T) {
	rt := testRT()
	getter := &mockGetter{}
	setter := &mockSetter{}

	_, err := Reconcile(context.Background(), "not-a-uuid", getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse workspace id")
}

func TestReconcile_HappyPath_CreatesAndDispatchesJob(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.NextReconcileAt)

	require.Len(t, setter.createdJobs, 1, "should create exactly one job")
	require.Len(t, setter.enqueueCalls, 1, "should enqueue exactly one dispatch")
	assert.Equal(t, rt.WorkspaceID.String(), setter.enqueueCalls[0].WorkspaceID)
	assert.Equal(t, setter.createdJobs[0].Id, setter.enqueueCalls[0].JobID)
}

// ---------------------------------------------------------------------------
// 4. Concurrency gate — active job blocks new jobs
// ---------------------------------------------------------------------------

func TestReconcile_ActiveJobBlocks(t *testing.T) {
	processingStatuses := []oapi.JobStatus{
		oapi.JobStatusPending,
		oapi.JobStatusInProgress,
		oapi.JobStatusActionRequired,
	}

	for _, status := range processingStatuses {
		t.Run(string(status), func(t *testing.T) {
			rt := testRT()
			release := testRelease(rt)
			activeJob := testJobForRelease(release, status, time.Now())

			getter, setter := setupHappyPath(rt, release)
			getter.jobs = []*oapi.Job{activeJob}

			result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.Nil(t, result.NextReconcileAt)
			assert.Empty(t, setter.createdJobs, "should not create a job when there is an active %s job", status)
		})
	}
}

func TestReconcile_TerminalStatusDoesNotBlock(t *testing.T) {
	terminalStatuses := []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusCancelled,
		oapi.JobStatusSkipped,
		oapi.JobStatusInvalidJobAgent,
		oapi.JobStatusInvalidIntegration,
		oapi.JobStatusExternalRunNotFound,
	}

	for _, status := range terminalStatuses {
		t.Run(string(status), func(t *testing.T) {
			rt := testRT()
			release := testRelease(rt)

			getter, setter := setupHappyPath(rt, release)
			getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 10})}

			terminalJob := testJobForRelease(release, status, time.Now().Add(-time.Minute))
			getter.jobs = []*oapi.Job{terminalJob}

			result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.NotEmpty(t, setter.createdJobs, "terminal status %s should not block job creation", status)
		})
	}
}

func TestReconcile_ActiveJobFromDifferentReleaseStillBlocks(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)

	otherRelease := testRelease(rt)
	activeJob := testJobForRelease(otherRelease, oapi.JobStatusInProgress, time.Now())

	getter, setter := setupHappyPath(rt, release)
	getter.jobs = []*oapi.Job{activeJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "an active job from a different release should still block")
	assert.Nil(t, result.NextReconcileAt)
}

// ---------------------------------------------------------------------------
// 5. Retry logic without a policy (strict mode)
// ---------------------------------------------------------------------------

func TestReconcile_NoPolicyNoJobs_FirstAttemptAllowed(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.jobs = []*oapi.Job{}
	getter.policies = []*oapi.Policy{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)
	require.Len(t, setter.createdJobs, 1, "first attempt should be allowed")
}

func TestReconcile_NoPolicyOneCompletedJob_Denied(t *testing.T) {
	statuses := []oapi.JobStatus{
		oapi.JobStatusSuccessful,
		oapi.JobStatusFailure,
		oapi.JobStatusCancelled,
		oapi.JobStatusSkipped,
		oapi.JobStatusInvalidJobAgent,
		oapi.JobStatusInvalidIntegration,
		oapi.JobStatusExternalRunNotFound,
	}

	for _, status := range statuses {
		t.Run(string(status), func(t *testing.T) {
			rt := testRT()
			release := testRelease(rt)
			completedJob := testJobForRelease(release, status, time.Now().Add(-time.Minute))

			getter, setter := setupHappyPath(rt, release)
			getter.jobs = []*oapi.Job{completedJob}
			getter.policies = []*oapi.Policy{}

			result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
			require.NoError(t, err)
			assert.NotNil(t, result)
			assert.Empty(t, setter.createdJobs, "with no policy, a second attempt after %s should be denied", status)
		})
	}
}

// ---------------------------------------------------------------------------
// 6. Retry logic with a policy
// ---------------------------------------------------------------------------

func TestReconcile_PolicyMaxRetries3_NoFailures_Allowed(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 3})}
	getter.jobs = []*oapi.Job{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1)
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_PolicyMaxRetries3_AtLimit_Allowed(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 3})}

	jobs := make([]*oapi.Job, 3)
	for i := 0; i < 3; i++ {
		jobs[i] = testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Duration(3-i)*time.Minute))
	}
	getter.jobs = jobs

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "at exactly maxRetries attempts, one more should be allowed")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_PolicyMaxRetries3_Exceeded_Denied(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 3})}

	jobs := make([]*oapi.Job, 4)
	for i := 0; i < 4; i++ {
		jobs[i] = testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Duration(4-i)*time.Minute))
	}
	getter.jobs = jobs

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "exceeding maxRetries should deny job creation")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_PolicyMaxRetries0_OneAttemptOnly(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 0})}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "maxRetries=0 should only allow one attempt")
	assert.Nil(t, result.NextReconcileAt)
}

// ---------------------------------------------------------------------------
// 7. retryOnStatuses filtering
// ---------------------------------------------------------------------------

func TestReconcile_ExplicitRetryOnStatuses_OnlyCountsThose(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:      3,
		RetryOnStatuses: &statuses,
	})}

	// cancelled job first (newest), then a failed job
	// The cancelled job is not in retryOnStatuses, so counting breaks immediately
	cancelledJob := testJobForRelease(release, oapi.JobStatusCancelled, time.Now().Add(-30*time.Second))
	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{cancelledJob, failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "cancelled job should break the retry chain, so attempt count = 0 -> allowed")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_DefaultRetryOnStatuses_MaxRetriesGT0(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 5})}

	// Successful job should NOT count (not in defaults for maxRetries > 0), breaking chain -> first attempt
	successfulJob := testJobForRelease(release, oapi.JobStatusSuccessful, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{successfulJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "successful job should not count toward retry limit when maxRetries > 0")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_DefaultRetryOnStatuses_MaxRetries0_SuccessfulCounts(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 0})}

	successfulJob := testJobForRelease(release, oapi.JobStatusSuccessful, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{successfulJob}

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "successful job should count when maxRetries=0 (smart default)")
}

// ---------------------------------------------------------------------------
// 8. Retry counting stops at different release
// ---------------------------------------------------------------------------

func TestReconcile_DifferentReleaseBreaksRetryChain(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	oldRelease := testRelease(rt)

	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 1})}

	// Old release's failed job first (newer timestamp), then nothing from current release
	oldJob := testJobForRelease(oldRelease, oapi.JobStatusFailure, time.Now().Add(-30*time.Second))
	getter.jobs = []*oapi.Job{oldJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "jobs from a different release should not count; this is a first attempt for the current release")
	assert.Nil(t, result.NextReconcileAt)
}

// ---------------------------------------------------------------------------
// 9. Backoff — linear
// ---------------------------------------------------------------------------

func TestReconcile_LinearBackoff_WithinWindow_Denied(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	backoff := int32(60)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &backoff,
	})}

	completedAt := time.Now().Add(-30 * time.Second) // 30s ago, backoff is 60s
	failedJob := testJobWithCompletion(release, oapi.JobStatusFailure,
		completedAt.Add(-time.Second), completedAt)
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "should not create job during backoff window")
	require.NotNil(t, result.NextReconcileAt, "should schedule requeue")
	assert.True(t, result.NextReconcileAt.After(time.Now()), "next reconcile should be in the future")
}

func TestReconcile_LinearBackoff_PastWindow_Allowed(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	backoff := int32(60)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &backoff,
	})}

	completedAt := time.Now().Add(-90 * time.Second) // 90s ago, backoff is 60s
	failedJob := testJobWithCompletion(release, oapi.JobStatusFailure,
		completedAt.Add(-time.Second), completedAt)
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "should create job after backoff window")
	assert.Nil(t, result.NextReconcileAt)
}

// ---------------------------------------------------------------------------
// 10. Backoff — exponential
// ---------------------------------------------------------------------------

func TestReconcile_ExponentialBackoff_SecondAttempt(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	backoff := int32(10)
	strategy := oapi.RetryRuleBackoffStrategyExponential
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:      5,
		BackoffSeconds:  &backoff,
		BackoffStrategy: &strategy,
	})}

	// 2 failed jobs: attempt 2 backoff = 10 * 2^1 = 20s
	now := time.Now()
	job1 := testJobWithCompletion(release, oapi.JobStatusFailure, now.Add(-25*time.Second), now.Add(-24*time.Second))
	job2 := testJobWithCompletion(release, oapi.JobStatusFailure, now.Add(-5*time.Second), now.Add(-4*time.Second))
	getter.jobs = []*oapi.Job{job2, job1} // newest first

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "should be in exponential backoff (20s, only 4s elapsed)")
	require.NotNil(t, result.NextReconcileAt)
}

func TestReconcile_ExponentialBackoff_WithMaxCap(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	backoff := int32(10)
	maxBackoff := int32(25)
	strategy := oapi.RetryRuleBackoffStrategyExponential
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:        10,
		BackoffSeconds:    &backoff,
		BackoffStrategy:   &strategy,
		MaxBackoffSeconds: &maxBackoff,
	})}

	// 4 failed jobs: uncapped backoff = 10 * 2^3 = 80s, but capped at 25s
	now := time.Now()
	jobs := make([]*oapi.Job, 4)
	for i := 0; i < 4; i++ {
		created := now.Add(-time.Duration(100-i*10) * time.Second)
		completed := created.Add(time.Second)
		jobs[3-i] = testJobWithCompletion(release, oapi.JobStatusFailure, created, completed)
	}
	// Override the most recent job's completion to be 20s ago (within 25s cap)
	recentCompleted := now.Add(-20 * time.Second)
	jobs[0].CompletedAt = &recentCompleted
	getter.jobs = jobs

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "should still be in backoff (capped at 25s, only 20s elapsed)")
	require.NotNil(t, result.NextReconcileAt)
}

// ---------------------------------------------------------------------------
// 11. Disabled and multiple policies
// ---------------------------------------------------------------------------

func TestReconcile_DisabledPolicyIgnored(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	// Disabled policy with generous retry, but it should be ignored
	getter.policies = []*oapi.Policy{
		testPolicy(false, &oapi.RetryRule{MaxRetries: 100}),
	}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "disabled policy should be ignored, so no retry rule -> strict mode denies")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_FirstEnabledPolicyRetryRuleWins(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	// First enabled policy: maxRetries=0 (deny after 1 attempt)
	// Second enabled policy: maxRetries=100 (very generous)
	getter.policies = []*oapi.Policy{
		testPolicy(true, &oapi.RetryRule{MaxRetries: 0}),
		testPolicy(true, &oapi.RetryRule{MaxRetries: 100}),
	}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "first enabled policy's retry rule should win (maxRetries=0)")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_DisabledPolicySkipped_EnabledUsed(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	// Disabled policy: maxRetries=0 (would deny)
	// Enabled policy: maxRetries=5 (allows retries)
	getter.policies = []*oapi.Policy{
		testPolicy(false, &oapi.RetryRule{MaxRetries: 0}),
		testPolicy(true, &oapi.RetryRule{MaxRetries: 5}),
	}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "disabled policy should be skipped; enabled policy allows retry")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_PolicyWithNoRetryRule_SkippedToNextPolicy(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	// First policy: no retry rule at all
	// Second policy: has a retry rule with maxRetries=5
	policyNoRetry := testPolicy(true, nil)
	policyWithRetry := testPolicy(true, &oapi.RetryRule{MaxRetries: 5})
	getter.policies = []*oapi.Policy{policyNoRetry, policyWithRetry}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Minute))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "should use second policy's retry rule")
	assert.Nil(t, result.NextReconcileAt)
}

// ---------------------------------------------------------------------------
// 12. Job building and dispatch
// ---------------------------------------------------------------------------

func TestReconcile_CreatedJobHasPendingStatus(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1)
	assert.Equal(t, oapi.JobStatusPending, setter.createdJobs[0].Status)
}

func TestReconcile_CreatedJobHasCorrectReleaseID(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1)
	assert.Equal(t, release.Id.String(), setter.createdJobs[0].ReleaseId)
}

func TestReconcile_CreatedJobHasDispatchContext(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1)

	job := setter.createdJobs[0]
	require.NotNil(t, job.DispatchContext)
	assert.NotNil(t, job.DispatchContext.Release, "dispatch context should include release")
	assert.NotNil(t, job.DispatchContext.Deployment, "dispatch context should include deployment")
	assert.NotNil(t, job.DispatchContext.Environment, "dispatch context should include environment")
	assert.NotNil(t, job.DispatchContext.Resource, "dispatch context should include resource")
	assert.NotNil(t, job.DispatchContext.Version, "dispatch context should include version")
	assert.NotNil(t, job.DispatchContext.Variables, "dispatch context should include variables")
	assert.Equal(t, release.Id.String(), job.DispatchContext.Release.Id.String())
	assert.Equal(t, release.Version.Tag, job.DispatchContext.Version.Tag)
}

func TestReconcile_CreatedJobHasValidUUID(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1)

	_, parseErr := uuid.Parse(setter.createdJobs[0].Id)
	assert.NoError(t, parseErr, "job ID should be a valid UUID")
}

func TestReconcile_NoJobAgents_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	emptyAgents := []oapi.DeploymentJobAgent{}
	getter.deployment.JobAgents = &emptyAgents

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no job agents configured")
	assert.Empty(t, setter.createdJobs)
}

func TestReconcile_NilJobAgents_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.deployment.JobAgents = nil

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "no job agents configured")
	assert.Empty(t, setter.createdJobs)
}

func TestReconcile_MultipleJobAgents_CreatesMultipleJobs(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	agent1 := testAgent()
	agent2 := testAgent()
	deployment := testDeployment(rt, agent1.Id, agent2.Id)

	getter := &mockGetter{
		rtExists:    true,
		release:     release,
		jobs:        []*oapi.Job{},
		policies:    []*oapi.Policy{},
		deployment:  deployment,
		jobAgents:   map[string]*oapi.JobAgent{agent1.Id: agent1, agent2.Id: agent2},
		environment: &oapi.Environment{Id: rt.EnvironmentID.String(), Name: "test-env", Metadata: map[string]string{}},
		resource:    &oapi.Resource{Id: rt.ResourceID.String(), Name: "test-resource", Identifier: "test", Kind: "test", Metadata: map[string]string{}, Config: map[string]interface{}{}},
	}
	setter := &mockSetter{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Nil(t, result.NextReconcileAt)
	require.Len(t, setter.createdJobs, 2, "should create one job per agent")
	require.Len(t, setter.enqueueCalls, 2, "should enqueue one dispatch per job")

	assert.NotEqual(t, setter.createdJobs[0].Id, setter.createdJobs[1].Id, "jobs should have unique IDs")
	assert.NotEqual(t, setter.createdJobs[0].JobAgentId, setter.createdJobs[1].JobAgentId, "jobs should have different agent IDs")
}

func TestReconcile_GetDeploymentFails_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.deploymentErr = fmt.Errorf("deployment not found")
	getter.deployment = nil

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get deployment")
}

func TestReconcile_GetJobAgentFails_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.jobAgentErr = fmt.Errorf("agent unavailable")

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get job agent")
}

func TestReconcile_GetEnvironmentFails_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.environmentErr = fmt.Errorf("env not found")
	getter.environment = nil

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get environment")
}

func TestReconcile_GetResourceFails_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.resourceErr = fmt.Errorf("resource not found")
	getter.resource = nil

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get resource")
}

func TestReconcile_CreateJobFails_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	setter.createJobErr = fmt.Errorf("create failed")

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "create job")
}

func TestReconcile_EnqueueFails_Error(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	setter.enqueueErr = fmt.Errorf("enqueue failed")

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "enqueue job dispatch")
}

// ---------------------------------------------------------------------------
// Edge cases and additional behavioral tests
// ---------------------------------------------------------------------------

func TestReconcile_JobsSortedByCreatedAt(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{MaxRetries: 5})}

	// Jobs returned out of order — the reconciler should sort them newest-first
	old := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-2*time.Minute))
	newer := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-1*time.Minute))
	getter.jobs = []*oapi.Job{old, newer} // intentionally out of order

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "both jobs are retryable, attempt count=2, maxRetries=5, should allow")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_BackoffUsesCompletedAtWhenAvailable(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	backoff := int32(60)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &backoff,
	})}

	// Job was created long ago but only completed 10s ago
	createdAt := time.Now().Add(-5 * time.Minute)
	completedAt := time.Now().Add(-10 * time.Second)
	failedJob := testJobWithCompletion(release, oapi.JobStatusFailure, createdAt, completedAt)
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Empty(t, setter.createdJobs, "should use completedAt for backoff timing, not createdAt")
	require.NotNil(t, result.NextReconcileAt)
}

func TestReconcile_NoBackoffWhenBackoffSecondsNil(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries: 3,
	})}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Second))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "without backoff configured, retry should be immediate")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_NoBackoffWhenBackoffSecondsZero(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	zero := int32(0)
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:     3,
		BackoffSeconds: &zero,
	})}

	failedJob := testJobForRelease(release, oapi.JobStatusFailure, time.Now().Add(-time.Second))
	getter.jobs = []*oapi.Job{failedJob}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "backoffSeconds=0 should not delay retry")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_MixedJobStatuses_ConsecutiveCounting(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	statuses := []oapi.JobStatus{oapi.JobStatusFailure}
	getter.policies = []*oapi.Policy{testPolicy(true, &oapi.RetryRule{
		MaxRetries:      2,
		RetryOnStatuses: &statuses,
	})}

	// Newest to oldest: failure, failure, successful, failure
	// Only the first 2 consecutive failures (newest) should count; successful breaks chain
	now := time.Now()
	j1 := testJobForRelease(release, oapi.JobStatusFailure, now.Add(-10*time.Second))
	j2 := testJobForRelease(release, oapi.JobStatusFailure, now.Add(-20*time.Second))
	j3 := testJobForRelease(release, oapi.JobStatusSuccessful, now.Add(-30*time.Second))
	j4 := testJobForRelease(release, oapi.JobStatusFailure, now.Add(-40*time.Second))
	getter.jobs = []*oapi.Job{j1, j2, j3, j4}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1, "only 2 consecutive failures counted, maxRetries=2 allows one more")
	assert.Nil(t, result.NextReconcileAt)
}

func TestReconcile_EnqueueCalledWithCorrectWorkspaceID(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)

	_, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.enqueueCalls, 1)
	assert.Equal(t, rt.WorkspaceID.String(), setter.enqueueCalls[0].WorkspaceID)
}

func TestReconcile_NoJobsNoPolices_FirstAttempt(t *testing.T) {
	rt := testRT()
	release := testRelease(rt)
	getter, setter := setupHappyPath(rt, release)
	getter.jobs = []*oapi.Job{}
	getter.policies = []*oapi.Policy{}

	result, err := Reconcile(context.Background(), rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	require.Len(t, setter.createdJobs, 1)
	assert.Nil(t, result.NextReconcileAt)
}
