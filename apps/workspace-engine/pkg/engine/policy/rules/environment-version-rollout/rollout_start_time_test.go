package environmentversionrollout

import (
	"context"
	"testing"
	"time"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	versionanyapproval "workspace-engine/pkg/engine/policy/rules/version-any-approval"
	"workspace-engine/pkg/engine/workspace"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"

	"github.com/google/uuid"
	"gotest.tools/assert"
)

func alwaysTrueCondition() conditions.JSONCondition {
	return conditions.JSONCondition{
		ConditionType: conditions.ConditionTypeID,
		Operator:      string(conditions.StringConditionOperatorStartsWith),
		Value:         "",
	}
}

func randomID() string {
	return uuid.New().String()
}

type timePtrsEqualTest struct {
	t        *testing.T
	expected *time.Time
	actual   *time.Time
}

func (t timePtrsEqualTest) assert() {
	expected := t.expected
	actual := t.actual

	if expected == nil {
		assert.Assert(t.t, actual == nil)
		return
	}

	assert.Equal(t.t, *expected, *actual)
}

type rolloutStartTimeTest struct {
	name                     string
	approvalRecords          []*versionanyapproval.VersionAnyApprovalRecord
	numApprovalsRequired     []int // number of approvals required for each policy
	expectedRolloutStartTime *time.Time
	releaseTarget            rt.ReleaseTarget
	version                  deployment.DeploymentVersion
}

type testBundle struct {
	t    *testing.T
	ctx  context.Context
	test rolloutStartTimeTest

	approvalRecordRepository *versionanyapproval.VersionAnyApprovalRecordRepository
	wsPolicyManager          *workspace.PolicyManager
	workspaceRepository      *workspace.WorkspaceRepository
	ruleRepository           *rules.RuleRepository
	selectorManager          *workspace.SelectorManager
}

func (b *testBundle) insertReleaseTarget() *testBundle {
	b.test.releaseTarget.Resource = resource.Resource{
		ID: randomID(),
	}
	b.workspaceRepository.ReleaseTarget.Create(b.ctx, &b.test.releaseTarget)
	b.selectorManager.UpsertResources(b.ctx, []resource.Resource{b.test.releaseTarget.Resource})
	return b
}

func (b *testBundle) insertPolicies() *testBundle {
	alwaysTrue := alwaysTrueCondition()
	policyID := randomID()
	for _, numApprovalsRequired := range b.test.numApprovalsRequired {
		policy := policy.Policy{
			ID: policyID,
			PolicyTargets: []policy.PolicyTarget{
				{
					ID:               randomID(),
					PolicyID:         policyID,
					ResourceSelector: &alwaysTrue,
				},
			},
		}
		b.workspaceRepository.Policy.Create(b.ctx, &policy)
		b.selectorManager.UpsertPolicyTargets(b.ctx, policy.PolicyTargets)

		rule := versionanyapproval.NewVersionAnyApprovalRule(b.approvalRecordRepository, numApprovalsRequired, policyID, randomID())
		var ruleInterface rules.Rule = rule
		b.ruleRepository.Create(b.ctx, &ruleInterface)
	}
	return b
}

func (b *testBundle) insertApprovalRecords() *testBundle {
	for _, record := range b.test.approvalRecords {
		b.approvalRecordRepository.Create(b.ctx, record)
	}
	return b
}

func (b *testBundle) run() {
	f := getRolloutStartTimeFunction(b.wsPolicyManager, b.ruleRepository, b.approvalRecordRepository)
	rolloutStartTime, err := f(b.ctx, b.test.releaseTarget, b.test.version)
	assert.NilError(b.t, err)
	timePtrsEqualTest{
		t:        b.t,
		expected: b.test.expectedRolloutStartTime,
		actual:   rolloutStartTime,
	}.assert()
}

func TestRolloutStartTime(t *testing.T) {
	earliestTime := time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC)
	middleTime := time.Date(2021, 1, 2, 0, 0, 0, 0, time.UTC)
	latestTime := time.Date(2021, 1, 3, 0, 0, 0, 0, time.UTC)

	returnsVersionCreatedAtIfNoRules := rolloutStartTimeTest{
		name:            "returns version created at if no rules",
		approvalRecords: []*versionanyapproval.VersionAnyApprovalRecord{},
		version: deployment.DeploymentVersion{
			ID:        "version-1",
			CreatedAt: earliestTime,
		},
		expectedRolloutStartTime: &earliestTime,
		releaseTarget: rt.ReleaseTarget{
			Environment: environment.Environment{ID: "environment-1"},
		},
	}

	returnsNilIfSomeRulesFail := rolloutStartTimeTest{
		name: "returns nil if some rules fail",
		approvalRecords: []*versionanyapproval.VersionAnyApprovalRecord{
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-1").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-1").
				WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
				WithUpdatedAt(middleTime).
				WithApprovedAt(middleTime).
				Build(),
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-2").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-2").
				WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
				WithUpdatedAt(middleTime).
				Build(),
		},
		version: deployment.DeploymentVersion{
			ID:        "version-1",
			CreatedAt: earliestTime,
		},
		expectedRolloutStartTime: nil,
		releaseTarget: rt.ReleaseTarget{
			Environment: environment.Environment{ID: "environment-1"},
		},
		numApprovalsRequired: []int{1, 2},
	}

	returnsNilIfNoApprovals := rolloutStartTimeTest{
		name:            "returns nil if no approvals",
		approvalRecords: []*versionanyapproval.VersionAnyApprovalRecord{},
		version: deployment.DeploymentVersion{
			ID:        "version-1",
			CreatedAt: earliestTime,
		},
		expectedRolloutStartTime: nil,
		releaseTarget: rt.ReleaseTarget{
			Environment: environment.Environment{ID: "environment-1"},
		},
		numApprovalsRequired: []int{1},
	}

	returnsLatestApprovalTimeIfAllRulesPass := rolloutStartTimeTest{
		name: "returns latest approval time if all rules pass",
		approvalRecords: []*versionanyapproval.VersionAnyApprovalRecord{
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-1").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-1").
				WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
				WithUpdatedAt(latestTime).
				WithApprovedAt(latestTime).
				Build(),
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-2").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-2").
				WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
				WithUpdatedAt(middleTime).
				WithApprovedAt(middleTime).
				Build(),
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-3").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-3").
				WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
				WithUpdatedAt(earliestTime).
				WithApprovedAt(earliestTime).
				Build(),
		},
		expectedRolloutStartTime: &latestTime,
		releaseTarget: rt.ReleaseTarget{
			Environment: environment.Environment{ID: "environment-1"},
		},
		numApprovalsRequired: []int{1, 2, 3},
		version: deployment.DeploymentVersion{
			ID:        "version-1",
			CreatedAt: earliestTime,
		},
	}

	returnsLatestApprovalEvenIfARejectionIsLatest := rolloutStartTimeTest{
		name: "returns latest approval time if all rules pass despite a rejection being the latest",
		approvalRecords: []*versionanyapproval.VersionAnyApprovalRecord{
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-1").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-1").
				WithStatus(versionanyapproval.ApprovalRecordStatusRejected).
				WithUpdatedAt(latestTime).
				Build(),
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-2").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-2").
				WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
				WithUpdatedAt(middleTime).
				WithApprovedAt(middleTime).
				Build(),
			versionanyapproval.NewVersionAnyApprovalRecordBuilder().
				WithID("record-3").
				WithVersionID("version-1").
				WithEnvironmentID("environment-1").
				WithUserID("user-3").
				WithStatus(versionanyapproval.ApprovalRecordStatusApproved).
				WithUpdatedAt(earliestTime).
				WithApprovedAt(earliestTime).
				Build(),
		},
		expectedRolloutStartTime: &middleTime,
		releaseTarget: rt.ReleaseTarget{
			Environment: environment.Environment{ID: "environment-1"},
		},
		numApprovalsRequired: []int{1, 2},
		version: deployment.DeploymentVersion{
			ID:        "version-1",
			CreatedAt: earliestTime,
		},
	}

	tests := []rolloutStartTimeTest{
		returnsVersionCreatedAtIfNoRules,
		returnsNilIfSomeRulesFail,
		returnsNilIfNoApprovals,
		returnsLatestApprovalTimeIfAllRulesPass,
		returnsLatestApprovalEvenIfARejectionIsLatest,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			workspaceRepository := workspace.NewWorkspaceRepository()
			selectorManager := workspace.NewSelectorManager()
			b := testBundle{
				t:                        t,
				ctx:                      ctx,
				test:                     test,
				approvalRecordRepository: versionanyapproval.NewVersionAnyApprovalRecordRepository(),
				wsPolicyManager:          workspace.NewPolicyManager(workspaceRepository, selectorManager),
				workspaceRepository:      workspaceRepository,
				ruleRepository:           rules.NewRuleRepository(),
				selectorManager:          selectorManager,
			}

			b.
				insertReleaseTarget().
				insertPolicies().
				insertApprovalRecords().
				run()
		})
	}
}
