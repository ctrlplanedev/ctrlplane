package jobdispatch

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/svc/controllers/jobdispatch/jobagents"

	"github.com/google/uuid"
)

var _ Getter = &PostgresGetter{}

var _ jobagents.Getter = &PostgresGetter{}

type PostgresGetter struct{}

// GetJob implements [Getter].
func (p *PostgresGetter) GetJob(ctx context.Context, jobID uuid.UUID) (*oapi.Job, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetJobByID(ctx, jobID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobFromGetJobByIDRow(row), nil
}

// GetRelease implements [Getter].
func (p *PostgresGetter) GetRelease(ctx context.Context, releaseID uuid.UUID) (*oapi.Release, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetReleaseByID(ctx, releaseID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiRelease(row), nil
}

// GetDeployment implements [Getter].
func (p *PostgresGetter) GetDeployment(ctx context.Context, deploymentID uuid.UUID) (*oapi.Deployment, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiDeployment(row), nil
}

// GetJobAgent implements [Getter].
func (p *PostgresGetter) GetJobAgent(ctx context.Context, jobAgentID uuid.UUID) (*oapi.JobAgent, error) {
	queries := db.GetQueries(ctx)
	row, err := queries.GetJobAgentByID(ctx, jobAgentID)
	if err != nil {
		return nil, err
	}
	return db.ToOapiJobAgent(row), nil
}

// // GetEnvironment implements [jobagents.Getter].
// func (p *PostgresGetter) GetEnvironment(id string) (*oapi.Environment, bool) {
// 	panic("unimplemented")
// }

// // GetJobAgent implements [jobagents.Getter].
// func (p *PostgresGetter) GetJobAgent(id string) (*oapi.JobAgent, bool) {
// 	panic("unimplemented")
// }

// // GetResource implements [jobagents.Getter].
// func (p *PostgresGetter) GetResource(id string) (*oapi.Resource, bool) {
// 	panic("unimplemented")
// }

// // GetActiveJobsForTarget implements [Getter].
// func (p *PostgresGetter) GetActiveJobsForTarget(ctx context.Context, rt *ReleaseTarget) ([]oapi.Job, error) {
// 	panic("unimplemented")
// }

// // GetDesiredRelease implements [Getter].
// func (p *PostgresGetter) GetDesiredRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error) {
// 	panic("unimplemented")
// }

// // GetJobAgentsForDeployment implements [Getter].
// func (p *PostgresGetter) GetJobAgentsForDeployment(ctx context.Context, deploymentID uuid.UUID) ([]oapi.JobAgent, error) {
// 	queries := db.GetQueries(ctx)
// }

// // GetJobsForRelease implements [Getter].
// func (p *PostgresGetter) GetJobsForRelease(ctx context.Context, releaseID uuid.UUID) ([]oapi.Job, error) {
// 	panic("unimplemented")
// }

// // ReleaseTargetExists implements [Getter].
// func (p *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
// 	panic("unimplemented")
// }

// // GetVerificationPolicies implements [Getter].
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
