package desiredrelease

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships/eval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
)

// ---------------------------------------------------------------------------
// Mock getter
// ---------------------------------------------------------------------------

type mockReconcileGetter struct {
	scope      *evaluator.EvaluatorScope
	versions   []*oapi.DeploymentVersion
	policyList []*oapi.Policy

	policySkips []*oapi.PolicySkip
	deployVars  []oapi.DeploymentVariableWithValues
	resourceVar map[string]oapi.ResourceVariable

	rtExists bool
}

func (m *mockReconcileGetter) ReleaseTargetExists(
	_ context.Context,
	_ *ReleaseTarget,
) (bool, error) {
	return m.rtExists, nil
}

func (m *mockReconcileGetter) GetReleaseTargetScope(
	_ context.Context,
	_ *ReleaseTarget,
) (*evaluator.EvaluatorScope, error) {
	return m.scope, nil
}

func (m *mockReconcileGetter) GetCandidateVersions(
	_ context.Context,
	_ uuid.UUID,
) ([]*oapi.DeploymentVersion, error) {
	return m.versions, nil
}

func (m *mockReconcileGetter) GetPoliciesForReleaseTarget(
	_ context.Context,
	_ *oapi.ReleaseTarget,
) ([]*oapi.Policy, error) {
	return m.policyList, nil
}

func (m *mockReconcileGetter) GetPolicySkips(
	_ context.Context,
	_, _, _ string,
) ([]*oapi.PolicySkip, error) {
	return m.policySkips, nil
}

func (m *mockReconcileGetter) GetDeploymentVariables(
	_ context.Context,
	_ string,
) ([]oapi.DeploymentVariableWithValues, error) {
	return m.deployVars, nil
}

func (m *mockReconcileGetter) GetResourceVariables(
	_ context.Context,
	_ string,
) (map[string]oapi.ResourceVariable, error) {
	return m.resourceVar, nil
}

func (m *mockReconcileGetter) GetRelationshipRules(
	_ context.Context,
	_ uuid.UUID,
) ([]eval.Rule, error) {
	return nil, nil
}

func (m *mockReconcileGetter) LoadCandidates(
	_ context.Context,
	_ uuid.UUID,
	_ string,
) ([]eval.EntityData, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetEntityByID(
	_ context.Context,
	_ uuid.UUID,
	_ string,
) (*eval.EntityData, error) {
	return nil, nil
}

// policyeval.Getter methods.
func (m *mockReconcileGetter) GetApprovalRecords(
	_ context.Context,
	_, _ string,
) ([]*oapi.UserApprovalRecord, error) {
	return nil, nil
}

func (m *mockReconcileGetter) HasCurrentRelease(
	_ context.Context,
	_ *oapi.ReleaseTarget,
) (bool, error) {
	return false, nil
}

func (m *mockReconcileGetter) GetEnvironment(
	_ context.Context,
	_ string,
) (*oapi.Environment, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetAllEnvironments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Environment, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetAllDeployments(
	_ context.Context,
	_ string,
) (map[string]*oapi.Deployment, error) {
	return nil, nil
}
func (m *mockReconcileGetter) GetDeployment(_ context.Context, _ string) (*oapi.Deployment, error) {
	return nil, nil
}
func (m *mockReconcileGetter) GetResource(_ context.Context, _ string) (*oapi.Resource, error) {
	return nil, nil
}
func (m *mockReconcileGetter) GetRelease(_ context.Context, _ string) (*oapi.Release, error) {
	return nil, nil
}
func (m *mockReconcileGetter) GetSystemIDsForEnvironment(_ string) []string {
	return nil
}

func (m *mockReconcileGetter) GetReleaseTargetsForEnvironment(
	_ context.Context,
	_ string,
) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetReleaseTargetsForDeployment(
	_ context.Context,
	_ string,
) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetReleaseTargetsForDeploymentAndEnvironment(
	_ context.Context,
	_, _ string,
) ([]oapi.ReleaseTarget, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetJobsForReleaseTarget(
	_ context.Context,
	_ *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	return nil
}

func (m *mockReconcileGetter) GetAllPolicies(
	_ context.Context,
	_ string,
) (map[string]*oapi.Policy, error) {
	return nil, nil
}
func (m *mockReconcileGetter) GetJobVerificationStatus(_ string) oapi.JobVerificationStatus {
	return ""
}

func (m *mockReconcileGetter) GetAllReleaseTargets(
	_ context.Context,
	_ string,
) ([]*oapi.ReleaseTarget, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetReleaseTargetsForResource(
	_ context.Context,
	_ string,
) []*oapi.ReleaseTarget {
	return nil
}

func (m *mockReconcileGetter) GetLatestCompletedJobForReleaseTarget(
	_ *oapi.ReleaseTarget,
) *oapi.Job {
	return nil
}

func (m *mockReconcileGetter) GetReleaseByJobID(
	_ context.Context,
	_ string,
) (*oapi.Release, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetJobsForEnvironmentAndVersion(
	_ context.Context,
	_, _ string,
) ([]environmentprogression.ReleaseTargetJob, error) {
	return nil, nil
}

func (m *mockReconcileGetter) GetVariableSetsWithVariables(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]oapi.VariableSetWithVariables, error) {
	return nil, nil
}

var _ Getter = (*mockReconcileGetter)(nil)

// ---------------------------------------------------------------------------
// Mock setter
// ---------------------------------------------------------------------------

type mockReconcileSetter struct {
	releases []*oapi.Release
}

func (s *mockReconcileSetter) SetDesiredRelease(
	_ context.Context,
	_ *ReleaseTarget,
	r *oapi.Release,
) error {
	if r != nil {
		s.releases = append(s.releases, r)
	}
	return nil
}

func (s *mockReconcileSetter) EnqueueJobEligibility(
	_ context.Context,
	_ string,
	_ *ReleaseTarget,
) error {
	return nil
}

var _ Setter = (*mockReconcileSetter)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func testRT() *ReleaseTarget {
	return &ReleaseTarget{
		WorkspaceID:   uuid.New(),
		DeploymentID:  uuid.New(),
		EnvironmentID: uuid.New(),
		ResourceID:    uuid.New(),
	}
}

func testScope() *evaluator.EvaluatorScope {
	return &evaluator.EvaluatorScope{
		Environment: &oapi.Environment{Id: uuid.New().String()},
		Deployment:  &oapi.Deployment{Id: uuid.New().String()},
		Resource:    &oapi.Resource{Id: uuid.New().String()},
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestReconcile_NoVersions(t *testing.T) {
	ctx := context.Background()
	rt := testRT()
	getter := &mockReconcileGetter{
		scope:    testScope(),
		versions: nil,
	}
	setter := &mockReconcileSetter{}

	result, err := Reconcile(ctx, rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.NextReconcileAt)
	assert.Empty(t, setter.releases, "no release should be created when no versions exist")
}

func TestReconcile_AllPoliciesAllow(t *testing.T) {
	ctx := context.Background()
	rt := testRT()
	versionID := uuid.New().String()

	getter := &mockReconcileGetter{
		scope: testScope(),
		versions: []*oapi.DeploymentVersion{
			{Id: versionID, Tag: "v1.0.0"},
		},
	}
	setter := &mockReconcileSetter{}

	result, err := Reconcile(ctx, rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Nil(t, result.NextReconcileAt)

	require.Len(t, setter.releases, 1, "exactly one release should be persisted")
	assert.Equal(t, versionID, setter.releases[0].Version.Id)
	assert.Equal(t, rt.DeploymentID.String(), setter.releases[0].ReleaseTarget.DeploymentId)
	assert.Equal(t, rt.EnvironmentID.String(), setter.releases[0].ReleaseTarget.EnvironmentId)
	assert.Equal(t, rt.ResourceID.String(), setter.releases[0].ReleaseTarget.ResourceId)
}

func TestReconcile_PolicyDeniesAllVersions(t *testing.T) {
	ctx := context.Background()
	rt := testRT()

	getter := &mockReconcileGetter{
		scope: testScope(),
		versions: []*oapi.DeploymentVersion{
			{Id: uuid.New().String(), Tag: "v1.0.0"},
		},
		policyList: []*oapi.Policy{
			{
				Id:      uuid.New().String(),
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						Id:          uuid.New().String(),
						AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
					},
				},
			},
		},
	}
	setter := &mockReconcileSetter{}

	result, err := Reconcile(ctx, rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)

	assert.Empty(
		t,
		setter.releases,
		"no release should be persisted when policies deny all versions",
	)
}

func TestReconcile_SelectsFirstPassingVersion(t *testing.T) {
	ctx := context.Background()
	rt := testRT()
	v1 := uuid.New().String()
	v2 := uuid.New().String()

	getter := &mockReconcileGetter{
		scope: testScope(),
		versions: []*oapi.DeploymentVersion{
			{Id: v1, Tag: "v1.0.0"},
			{Id: v2, Tag: "v2.0.0"},
		},
	}
	setter := &mockReconcileSetter{}

	result, err := Reconcile(ctx, rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.NotNil(t, result)

	require.Len(t, setter.releases, 1)
	assert.Equal(
		t,
		v1,
		setter.releases[0].Version.Id,
		"should select the first (newest) passing version",
	)
}

func TestReconcile_AllVersionsDenied_NoRelease(t *testing.T) {
	ctx := context.Background()
	rt := testRT()
	v1 := uuid.New().String()
	v2 := uuid.New().String()

	getter := &mockReconcileGetter{
		scope: testScope(),
		versions: []*oapi.DeploymentVersion{
			{Id: v1, Tag: "v1.0.0"},
			{Id: v2, Tag: "v2.0.0"},
		},
		policyList: []*oapi.Policy{
			{
				Id:      uuid.New().String(),
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						Id:          uuid.New().String(),
						AnyApproval: &oapi.AnyApprovalRule{MinApprovals: 1},
					},
				},
			},
		},
	}
	setter := &mockReconcileSetter{}

	result, err := Reconcile(ctx, rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)
	assert.Nil(t, result.NextReconcileAt)
	assert.Empty(t, setter.releases, "no version should pass the approval gate")
}

func TestReconcile_UpsertsEvaluationsForPassingVersion(t *testing.T) {
	ctx := context.Background()
	rt := testRT()
	v1 := uuid.New().String()

	getter := &mockReconcileGetter{
		scope: testScope(),
		versions: []*oapi.DeploymentVersion{
			{Id: v1, Tag: "v1.0.0"},
		},
	}
	setter := &mockReconcileSetter{}

	_, err := Reconcile(ctx, rt.WorkspaceID.String(), getter, setter, rt)
	require.NoError(t, err)

	require.Len(t, setter.releases, 1, "version should pass with no policies")
}
