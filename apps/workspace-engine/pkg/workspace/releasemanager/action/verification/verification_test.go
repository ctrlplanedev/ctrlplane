package verification_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/releasemanager/action"
	verificationaction "workspace-engine/pkg/workspace/releasemanager/action/verification"
	"workspace-engine/pkg/workspace/releasemanager/verification"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestStore() *store.Store {
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	return store.New(wsId, changeset)
}

func createTestRelease(s *store.Store, ctx context.Context) *oapi.Release {
	// Create system
	systemId := uuid.New().String()
	system := &oapi.System{
		Id:   systemId,
		Name: "test-system",
	}
	_ = s.Systems.Upsert(ctx, system)

	// Create resource
	resourceId := uuid.New().String()
	resource := &oapi.Resource{
		Id:         resourceId,
		Name:       "test-resource",
		Kind:       "kubernetes",
		Identifier: "test-res-1",
		CreatedAt:  time.Now(),
	}
	_, _ = s.Resources.Upsert(ctx, resource)

	// Create environment
	environmentId := uuid.New().String()
	environment := &oapi.Environment{
		Id:       environmentId,
		Name:     "test-env",
		SystemId: systemId,
	}
	selector := &oapi.Selector{}
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	environment.ResourceSelector = selector
	_ = s.Environments.Upsert(ctx, environment)

	// Create deployment
	deploymentId := uuid.New().String()
	deployment := &oapi.Deployment{
		Id:       deploymentId,
		Name:     "test-deployment",
		Slug:     "test-deployment",
		SystemId: systemId,
	}
	deploymentSelector := &oapi.Selector{}
	_ = deploymentSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	deployment.ResourceSelector = deploymentSelector
	_ = s.Deployments.Upsert(ctx, deployment)

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
	_ = s.ReleaseTargets.Upsert(ctx, releaseTarget)

	// Create release
	release := &oapi.Release{
		ReleaseTarget: *releaseTarget,
		Version:       *version,
		Variables:     map[string]oapi.LiteralValue{},
	}
	_ = s.Releases.Upsert(ctx, release)

	return release
}

func TestVerificationAction_Name(t *testing.T) {
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	action := verificationaction.NewVerificationAction(verificationMgr)

	assert.Equal(t, "verification", action.Name())
}

func TestVerificationAction_Execute_NoMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{},
	}

	// Should not error when no metrics
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func createPolicyWithVerification(metrics []oapi.VerificationMetricSpec, triggerOn *oapi.VerificationRuleTriggerOn) *oapi.Policy {
	return &oapi.Policy{
		Id:        uuid.New().String(),
		Name:      "test-policy",
		Enabled:   true,
		Priority:  1,
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{},
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

func TestVerificationAction_Execute_CreatesVerification(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with verification rule
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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 1, len(v.Metrics))
	assert.Equal(t, "health-check", v.Metrics[0].Name)

	// Verification should be in running status (scheduler started)
	assert.Equal(t, oapi.JobVerificationStatusRunning, v.Status(), "verification should be in running status")

	// Verification should be linked to the job
	assert.Equal(t, job.Id, v.JobId)

	// Verification ID should be set
	assert.NotEmpty(t, v.Id)

	// CreatedAt should be set
	assert.False(t, v.CreatedAt.IsZero())
}

func TestVerificationAction_Execute_SkipsDisabledPolicy(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a disabled policy with verification rule
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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func TestVerificationAction_Execute_SkipsWrongTrigger(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy that triggers on jobFailure, not jobSuccess
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

	// Execute with TriggerJobSuccess (mismatched trigger)
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created due to trigger mismatch
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func TestVerificationAction_Execute_DefaultsTriggerToJobSuccess(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with no triggerOn specified (should default to jobSuccess)
	policy := createPolicyWithVerification(
		[]oapi.VerificationMetricSpec{createTestMetric("health-check")},
		nil, // nil triggerOn
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	// Execute with TriggerJobSuccess
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be created (default trigger matches)
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 1, len(v.Metrics))
}

func TestVerificationAction_Execute_DeduplicatesMetrics(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create two policies with overlapping metric names
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
			createTestMetric("health-check"), // duplicate
			createTestMetric("error-rate"),
		},
		&triggerOn,
	)

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy1, policy2},
	}

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be created with deduplicated metrics
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 3, len(v.Metrics)) // health-check, latency-check, error-rate (deduplicated)

	// Check names are unique
	names := make(map[string]bool)
	for _, m := range v.Metrics {
		names[m.Name] = true
	}
	assert.True(t, names["health-check"])
	assert.True(t, names["latency-check"])
	assert.True(t, names["error-rate"])
}

// Tests for all trigger types

func TestVerificationAction_Execute_TriggerJobCreated(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusPending,
		CreatedAt: time.Now(),
	}

	// Create a policy that triggers on jobCreated
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

	// Execute with TriggerJobCreated
	err := vAction.Execute(ctx, action.TriggerJobCreated, actx)
	require.NoError(t, err)

	// Verification should be created and running
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 1, len(v.Metrics))
	assert.Equal(t, "startup-check", v.Metrics[0].Name)
	assert.Equal(t, oapi.JobVerificationStatusRunning, v.Status(), "verification should be running")
}

func TestVerificationAction_Execute_TriggerJobStarted(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusInProgress,
		CreatedAt: time.Now(),
	}

	// Create a policy that triggers on jobStarted
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

	// Execute with TriggerJobStarted
	err := vAction.Execute(ctx, action.TriggerJobStarted, actx)
	require.NoError(t, err)

	// Verification should be created and running
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 1, len(v.Metrics))
	assert.Equal(t, "progress-check", v.Metrics[0].Name)
	assert.Equal(t, oapi.JobVerificationStatusRunning, v.Status(), "verification should be running")
}

func TestVerificationAction_Execute_TriggerJobFailure(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusFailure,
		CreatedAt: time.Now(),
	}

	// Create a policy that triggers on jobFailure
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

	// Execute with TriggerJobFailure
	err := vAction.Execute(ctx, action.TriggerJobFailure, actx)
	require.NoError(t, err)

	// Verification should be created and running
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 1, len(v.Metrics))
	assert.Equal(t, "failure-analysis", v.Metrics[0].Name)
	assert.Equal(t, oapi.JobVerificationStatusRunning, v.Status(), "verification should be running")
}

// Helper function for creating policies with custom rules
func createPolicyWithRules(rules []oapi.PolicyRule) *oapi.Policy {
	return &oapi.Policy{
		Id:        uuid.New().String(),
		Name:      "test-policy",
		Enabled:   true,
		Priority:  1,
		CreatedAt: time.Now().Format(time.RFC3339),
		Selectors: []oapi.PolicyTargetSelector{},
		Rules:     rules,
		Metadata:  map[string]string{},
	}
}

// Test for mixed rule types

func TestVerificationAction_Execute_PolicyWithMixedRules(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with both verification and approval rules
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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be created (approval rule should be ignored by verification action)
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 1, len(v.Metrics))
	assert.Equal(t, "health-check", v.Metrics[0].Name)
}

// Test for multiple verification rules per policy

func TestVerificationAction_Execute_MultipleVerificationRulesInPolicy(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with multiple verification rules
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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be created with metrics from all rules
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, 3, len(v.Metrics))

	// Check all metrics are present
	names := make(map[string]bool)
	for _, m := range v.Metrics {
		names[m.Name] = true
	}
	assert.True(t, names["health-check"])
	assert.True(t, names["latency-check"])
	assert.True(t, names["error-rate"])
}

// Edge case tests

func TestVerificationAction_Execute_NilVerificationRule(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with a rule that has no verification (nil Verification field)
	policy := createPolicyWithRules([]oapi.PolicyRule{
		{
			Id:           uuid.New().String(),
			PolicyId:     uuid.New().String(),
			CreatedAt:    time.Now().Format(time.RFC3339),
			Verification: nil, // No verification rule
		},
	})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func TestVerificationAction_Execute_EmptyMetricsArray(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with verification rule but empty metrics
	triggerOn := oapi.JobSuccess
	policy := createPolicyWithRules([]oapi.PolicyRule{
		{
			Id:        uuid.New().String(),
			PolicyId:  uuid.New().String(),
			CreatedAt: time.Now().Format(time.RFC3339),
			Verification: &oapi.VerificationRule{
				Metrics:   []oapi.VerificationMetricSpec{}, // Empty metrics
				TriggerOn: &triggerOn,
			},
		},
	})

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created (no metrics)
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func TestVerificationAction_Execute_NilPoliciesSlice(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: nil, // nil policies
	}

	// Execute the action - should not panic
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

func TestVerificationAction_Execute_PolicyWithNoRules(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a policy with no rules
	policy := createPolicyWithRules([]oapi.PolicyRule{}) // Empty rules

	actx := action.ActionContext{
		Job:      job,
		Release:  release,
		Policies: []*oapi.Policy{policy},
	}

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// No verification should be created
	verifications := s.JobVerifications.GetByJobId(job.Id)
	assert.Empty(t, verifications)
}

// Verification lifecycle and metric spec tests

func TestVerificationAction_Execute_VerificationIsRunningWithCorrectMetricSpecs(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create a metric with specific configuration
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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should exist and be running
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1, "verification should exist")
	v := verifications[0]
	assert.Equal(t, oapi.JobVerificationStatusRunning, v.Status(), "verification should be in running status")

	// Verify metric specifications are correctly transferred
	require.Equal(t, 1, len(v.Metrics), "should have one metric")
	metricStatus := v.Metrics[0]
	assert.Equal(t, "detailed-health-check", metricStatus.Name)
	assert.EqualValues(t, 60, metricStatus.IntervalSeconds)
	assert.EqualValues(t, 10, metricStatus.Count)
	assert.Equal(t, "result.statusCode == 200", metricStatus.SuccessCondition)
	require.NotNil(t, metricStatus.FailureThreshold)
	assert.Equal(t, 2, *metricStatus.FailureThreshold)

	// Measurements should be empty initially (verification just started)
	assert.Empty(t, metricStatus.Measurements, "measurements should be empty initially")
}

func TestVerificationAction_Execute_VerificationRecordHasCorrectReleaseLink(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be correctly linked to the job
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]

	// Verify the job link is correct
	assert.Equal(t, job.Id, v.JobId, "verification should be linked to correct job")

	// Verification should also be retrievable by its own ID
	vById, existsById := s.JobVerifications.Get(v.Id)
	require.True(t, existsById, "verification should be retrievable by ID")
	assert.Equal(t, v.Id, vById.Id)
	assert.Equal(t, job.Id, vById.JobId)
}

func TestVerificationAction_Execute_MultipleMetricsAllRunning(t *testing.T) {
	ctx := context.Background()
	s := newTestStore()
	verificationMgr := verification.NewManager(s)
	vAction := verificationaction.NewVerificationAction(verificationMgr)

	release := createTestRelease(s, ctx)

	job := &oapi.Job{
		Id:        uuid.New().String(),
		ReleaseId: release.ID(),
		Status:    oapi.JobStatusSuccessful,
		CreatedAt: time.Now(),
	}

	// Create multiple metrics
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

	// Execute the action
	err := vAction.Execute(ctx, action.TriggerJobSuccess, actx)
	require.NoError(t, err)

	// Verification should be running
	verifications := s.JobVerifications.GetByJobId(job.Id)
	require.Len(t, verifications, 1)
	v := verifications[0]
	assert.Equal(t, oapi.JobVerificationStatusRunning, v.Status())

	// All metrics should be present
	require.Equal(t, 3, len(v.Metrics))

	// Each metric should have empty measurements (just started)
	for _, m := range v.Metrics {
		assert.Empty(t, m.Measurements, "metric %s should have empty measurements initially", m.Name)
	}
}
