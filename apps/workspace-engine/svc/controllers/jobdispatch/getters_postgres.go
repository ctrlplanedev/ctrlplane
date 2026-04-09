package jobdispatch

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/jobagents"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
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

func (p *PostgresGetter) GetRelease(
	ctx context.Context,
	releaseID uuid.UUID,
) (*oapi.Release, error) {
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

func (p *PostgresGetter) GetDeployment(
	ctx context.Context,
	deploymentID uuid.UUID,
) (*oapi.Deployment, error) {
	row, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

func (p *PostgresGetter) ListJobAgentsByWorkspaceID(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]oapi.JobAgent, error) {
	rows, err := db.GetQueries(ctx).ListJobAgentsByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	agents := make([]oapi.JobAgent, len(rows))
	for i, row := range rows {
		agents[i] = *db.ToOapiJobAgent(row)
	}
	return agents, nil
}

func (p *PostgresGetter) GetJobAgent(
	ctx context.Context,
	jobAgentID uuid.UUID,
) (*oapi.JobAgent, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetJobAgentByID(ctx, jobAgentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

func (p *PostgresGetter) GetVerificationPolicies(
	ctx context.Context,
	rt *ReleaseTarget,
) ([]oapi.VerificationMetricSpec, error) {
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

func (p *PostgresGetter) IsWorkflowJob(ctx context.Context, jobID uuid.UUID) (bool, error) {
	_, err := db.GetQueries(ctx).GetWorkflowJobByJobID(ctx, jobID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("check workflow job: %w", err)
	}
	return true, nil
}
