package jobdispatch

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/svc/controllers/jobdispatch/jobagents"

	"github.com/google/uuid"
)

var _ Getter = &PostgresGetter{}

var _ jobagents.Getter = &PostgresGetter{}

type PostgresGetter struct{}

func (p *PostgresGetter) GetJob(ctx context.Context, jobID uuid.UUID) (*oapi.Job, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobFromGetJobByIDRow(row), nil
}

func (p *PostgresGetter) GetRelease(ctx context.Context, releaseID uuid.UUID) (*oapi.Release, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetReleaseByID(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	release := db.ToOapiRelease(row)

	versionRow, err := queries.GetDeploymentVersionByID(ctx, row.VersionID)
	if err != nil {
		return nil, fmt.Errorf("get version %s for release %s: %w", row.VersionID, releaseID, err)
	}
	release.Version = *db.ToOapiDeploymentVersion(versionRow)

	return release, nil
}

func (p *PostgresGetter) GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (p *PostgresGetter) GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetJobAgentByID(ctx, jobAgentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

func (p *PostgresGetter) GetVerificationPolicies(ctx context.Context, rt *ReleaseTarget) ([]oapi.VerificationMetricSpec, error) {
	queries := db.GetQueries(ctx)

	resourceRow, err := queries.GetResourceByID(ctx, rt.ResourceID)
	if err != nil {
		return nil, err
	}
	resource := db.ToOapiResource(resourceRow)

	environmentRow, err := queries.GetEnvironmentByID(ctx, rt.EnvironmentID)
	if err != nil {
		return nil, err
	}
	environment := db.ToOapiEnvironment(environmentRow)

	deploymentRow, err := queries.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, err
	}
	deployment := db.ToOapiDeployment(deploymentRow)

	policyRows, err := queries.ListPoliciesWithRulesByWorkspaceID(ctx, resourceRow.WorkspaceID)
	if err != nil {
		return nil, err
	}

	specs := make([]oapi.VerificationMetricSpec, 0)
	for _, policyRow := range policyRows {
		policy := db.ToOapiPolicyWithRules(policyRow)
		for _, rule := range policy.Rules {
			if rule.Verification == nil {
				continue
			}

			resolved := selector.NewResolvedReleaseTarget(environment, deployment, resource)
			if selector.MatchPolicy(ctx, policy, resolved) {
				specs = append(specs, rule.Verification.Metrics...)
			}
		}
	}

	return specs, nil
}
