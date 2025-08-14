package versionanyapproval_test

import (
	"context"
	"testing"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
	"workspace-engine/pkg/engine/policy/rules"
	versionanyapproval "workspace-engine/pkg/engine/policy/rules/version-any-approval"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"

	"github.com/google/uuid"
	"gotest.tools/assert"
)

type VersionAnyApprovalRuleTest struct {
	name                  string
	numApprovalsToCreate  int
	numRejectionsToCreate int
	minimumApprovalsCount int
	releaseTarget         rt.ReleaseTarget
	version               deployment.DeploymentVersion
	expectedDecision      rules.PolicyDecision
}

func randomID() string {
	return uuid.New().String()
}

func TestVersionAnyApprovalRule(t *testing.T) {
	deniesIfInsufficientApprovals := VersionAnyApprovalRuleTest{
		name:                  "denies if insufficient approvals",
		numApprovalsToCreate:  1,
		numRejectionsToCreate: 1,
		minimumApprovalsCount: 2,
		releaseTarget:         rt.ReleaseTarget{Environment: environment.Environment{ID: randomID()}},
		version:               deployment.DeploymentVersion{ID: randomID()},
		expectedDecision:      rules.PolicyDecisionDeny,
	}

	allowsIfEqualToMinimumApprovalsCount := VersionAnyApprovalRuleTest{
		name:                  "allows if equal to minimum approvals count",
		numApprovalsToCreate:  2,
		numRejectionsToCreate: 0,
		minimumApprovalsCount: 2,
		releaseTarget:         rt.ReleaseTarget{Environment: environment.Environment{ID: randomID()}},
		version:               deployment.DeploymentVersion{ID: randomID()},
		expectedDecision:      rules.PolicyDecisionAllow,
	}

	allowsIfGreaterThanMinimumApprovalsCount := VersionAnyApprovalRuleTest{
		name:                  "allows if greater than minimum approvals count",
		numApprovalsToCreate:  3,
		numRejectionsToCreate: 0,
		minimumApprovalsCount: 2,
		releaseTarget:         rt.ReleaseTarget{Environment: environment.Environment{ID: randomID()}},
		version:               deployment.DeploymentVersion{ID: randomID()},
		expectedDecision:      rules.PolicyDecisionAllow,
	}

	allowsIfEqualToMinimumApprovalsCountDespiteRejections := VersionAnyApprovalRuleTest{
		name:                  "allows if equal to minimum approvals count despite rejections",
		numApprovalsToCreate:  2,
		numRejectionsToCreate: 5,
		minimumApprovalsCount: 2,
		releaseTarget:         rt.ReleaseTarget{Environment: environment.Environment{ID: randomID()}},
		version:               deployment.DeploymentVersion{ID: randomID()},
		expectedDecision:      rules.PolicyDecisionAllow,
	}

	tests := []VersionAnyApprovalRuleTest{
		deniesIfInsufficientApprovals,
		allowsIfEqualToMinimumApprovalsCount,
		allowsIfGreaterThanMinimumApprovalsCount,
		allowsIfEqualToMinimumApprovalsCountDespiteRejections,
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			repo := versionanyapproval.NewVersionAnyApprovalRecordRepository()
			rule := versionanyapproval.NewVersionAnyApprovalRule(
				repo,
				test.minimumApprovalsCount,
				randomID(),
				randomID(),
			)

			environmentID := test.releaseTarget.Environment.GetID()
			versionID := test.version.GetID()

			for i := 0; i < test.numApprovalsToCreate; i++ {
				record := &versionanyapproval.VersionAnyApprovalRecord{
					ID:            randomID(),
					VersionID:     versionID,
					EnvironmentID: environmentID,
					UserID:        randomID(),
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusApproved,
				}

				err := repo.Create(ctx, record)
				assert.NilError(t, err)
			}

			for i := 0; i < test.numRejectionsToCreate; i++ {
				record := &versionanyapproval.VersionAnyApprovalRecord{
					ID:            randomID(),
					VersionID:     versionID,
					EnvironmentID: environmentID,
					UserID:        randomID(),
					Status:        versionanyapproval.VersionAnyApprovalRecordStatusRejected,
				}

				err := repo.Create(ctx, record)
				assert.NilError(t, err)
			}

			result, err := rule.Evaluate(ctx, test.releaseTarget, test.version)
			assert.NilError(t, err)
			assert.Equal(t, test.expectedDecision, result.Decision)
		})
	}
}
