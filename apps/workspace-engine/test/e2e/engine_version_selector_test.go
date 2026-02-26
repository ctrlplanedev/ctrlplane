package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestEngine_VersionSelector_FlipppingBetweenVersions(t *testing.T) {
	jobAgentID := uuid.New().String()
	deploymentID := uuid.New().String()
	environmentID := uuid.New().String()
	resourceID := uuid.New().String()
	policyID := uuid.New().String()
	ruleID := uuid.New().String()

	v1SelectorString := "version.tag.startsWith('v1.')"
	v2SelectorString := "version.tag.startsWith('v2.')"

	engine := integration.NewTestWorkspace(t,
		integration.WithJobAgent(
			integration.JobAgentID(jobAgentID),
		),
		integration.WithSystem(
			integration.WithDeployment(
				integration.DeploymentID(deploymentID),
				integration.DeploymentJobAgent(jobAgentID),
				integration.DeploymentCelResourceSelector("true"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID(environmentID),
				integration.EnvironmentCelResourceSelector("true"),
			),
		),
		integration.WithResource(
			integration.ResourceID(resourceID),
		),
		integration.WithPolicy(
			integration.PolicyID(policyID),
			integration.PolicyName("version-selector"),
			integration.WithPolicySelector("true"),
			integration.WithPolicyRule(
				integration.PolicyRuleID(ruleID),
				integration.WithRuleVersionSelector(
					v1SelectorString,
				),
			),
		),
	)

	ctx := context.Background()

	version1 := c.NewDeploymentVersion()
	version1.DeploymentId = deploymentID
	version1.Tag = "v1.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version1)

	version2 := c.NewDeploymentVersion()
	version2.DeploymentId = deploymentID
	version2.Tag = "v2.0.0"
	engine.PushEvent(ctx, handler.DeploymentVersionCreate, version2)

	jobs := engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 1, len(jobs), "Expected 1 job for v1.0.0")

	jobsSlice := make([]*oapi.Job, 0)
	for _, job := range jobs {
		jobsSlice = append(jobsSlice, job)
	}

	job1 := jobsSlice[0]
	assert.Equal(t, job1.DispatchContext.Version.Tag, "v1.0.0")

	now := time.Now()
	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &job1.Id,
		Job: oapi.Job{
			Id:          job1.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	v2Selector := &oapi.Selector{}
	_ = v2Selector.FromCelSelector(oapi.CelSelector{
		Cel: v2SelectorString,
	})
	engine.PushEvent(ctx, handler.PolicyUpdate, oapi.Policy{
		Id: policyID,
		Rules: []oapi.PolicyRule{
			{
				Id: ruleID,
				VersionSelector: &oapi.VersionSelectorRule{
					Selector: *v2Selector,
				},
			},
		},
		Selector: "true",
		Enabled:  true,
	})

	jobs = engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 1, len(jobs), "Expected 1 job for v2.0.0")

	jobsSlice = make([]*oapi.Job, 0)
	for _, job := range jobs {
		jobsSlice = append(jobsSlice, job)
	}

	job2 := jobsSlice[0]
	assert.Equal(t, job2.DispatchContext.Version.Tag, "v2.0.0")

	engine.PushEvent(ctx, handler.JobUpdate, oapi.JobUpdateEvent{
		Id: &job2.Id,
		Job: oapi.Job{
			Id:          job2.Id,
			Status:      oapi.JobStatusSuccessful,
			CompletedAt: &now,
		},
		FieldsToUpdate: &[]oapi.JobUpdateEventFieldsToUpdate{
			oapi.JobUpdateEventFieldsToUpdateStatus,
			oapi.JobUpdateEventFieldsToUpdateCompletedAt,
		},
	})

	v1Selector := &oapi.Selector{}
	_ = v1Selector.FromCelSelector(oapi.CelSelector{
		Cel: v1SelectorString,
	})
	engine.PushEvent(ctx, handler.PolicyUpdate, oapi.Policy{
		Id: policyID,
		Rules: []oapi.PolicyRule{
			{
				Id: ruleID,
				VersionSelector: &oapi.VersionSelectorRule{
					Selector: *v1Selector,
				},
			},
		},
		Selector: "true",
		Enabled:  true,
	})

	jobs = engine.Workspace().Jobs().GetPending()
	assert.Equal(t, 1, len(jobs), "Expected 1 job for v1.0.0")

	jobsSlice = make([]*oapi.Job, 0)
	for _, job := range jobs {
		jobsSlice = append(jobsSlice, job)
	}

	job3 := jobsSlice[0]
	assert.Equal(t, job3.DispatchContext.Version.Tag, "v1.0.0")
}
