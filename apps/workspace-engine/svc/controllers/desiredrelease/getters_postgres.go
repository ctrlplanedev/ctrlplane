package desiredrelease

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/svc/controllers/desiredrelease/convert"

	"github.com/google/uuid"
)

type PostgresGetter struct{}

func (g *PostgresGetter) ReleaseTargetExists(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	return db.GetQueries(ctx).ReleaseTargetExists(ctx, db.ReleaseTargetExistsParams{
		DeploymentID:  rt.DeploymentID,
		EnvironmentID: rt.EnvironmentID,
		ResourceID:    rt.ResourceID,
	})
}

func (g *PostgresGetter) GetReleaseTargetScope(ctx context.Context, rt *ReleaseTarget) (*evaluator.EvaluatorScope, error) {
	q := db.GetQueries(ctx)

	depRow, err := q.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment %s: %w", rt.DeploymentID, err)
	}

	envRow, err := q.GetEnvironmentByID(ctx, rt.EnvironmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", rt.EnvironmentID, err)
	}

	resRow, err := q.GetResourceByID(ctx, rt.ResourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource %s: %w", rt.ResourceID, err)
	}

	return &evaluator.EvaluatorScope{
		Deployment:  convert.Deployment(depRow),
		Environment: convert.Environment(envRow),
		Resource:    convert.Resource(resRow),
	}, nil
}

func (g *PostgresGetter) GetCandidateVersions(ctx context.Context, deploymentID uuid.UUID) ([]*oapi.DeploymentVersion, error) {
	rows, err := db.GetQueries(ctx).ListDeploymentVersionsByDeploymentID(ctx, db.ListDeploymentVersionsByDeploymentIDParams{
		DeploymentID: deploymentID,
	})
	if err != nil {
		return nil, fmt.Errorf("list versions for deployment %s: %w", deploymentID, err)
	}

	versions := make([]*oapi.DeploymentVersion, 0, len(rows))
	for _, row := range rows {
		versions = append(versions, convert.DeploymentVersion(row))
	}
	return versions, nil
}

func (g *PostgresGetter) GetPolicies(ctx context.Context, rt *ReleaseTarget) ([]*oapi.Policy, error) {
	q := db.GetQueries(ctx)

	depRow, err := q.GetDeploymentByID(ctx, rt.DeploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment for workspace lookup: %w", err)
	}

	rows, err := q.ListPoliciesWithRulesByWorkspaceID(ctx, depRow.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("list policies: %w", err)
	}

	policies := make([]*oapi.Policy, 0, len(rows))
	for _, row := range rows {
		p, err := convert.PolicyWithRules(row)
		if err != nil {
			return nil, fmt.Errorf("convert policy %s: %w", row.ID, err)
		}
		policies = append(policies, p)
	}
	return policies, nil
}

func (g *PostgresGetter) GetApprovalRecords(_ context.Context, _, _ string) ([]*oapi.UserApprovalRecord, error) {
	// TODO: Approval records are not yet stored in the workspace-engine database.
	return nil, nil
}

func (g *PostgresGetter) GetPolicySkips(_ context.Context, _, _, _ string) ([]*oapi.PolicySkip, error) {
	// TODO: Policy skips are not yet stored in the workspace-engine database.
	return nil, nil
}

func (g *PostgresGetter) HasCurrentRelease(ctx context.Context, rt *ReleaseTarget) (bool, error) {
	releases, err := db.GetQueries(ctx).ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    rt.ResourceID,
		EnvironmentID: rt.EnvironmentID,
		DeploymentID:  rt.DeploymentID,
	})
	if err != nil {
		return false, fmt.Errorf("list releases for release target: %w", err)
	}
	return len(releases) > 0, nil
}

func (g *PostgresGetter) GetCurrentRelease(ctx context.Context, rt *ReleaseTarget) (*oapi.Release, error) {
	q := db.GetQueries(ctx)

	releases, err := q.ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    rt.ResourceID,
		EnvironmentID: rt.EnvironmentID,
		DeploymentID:  rt.DeploymentID,
	})
	if err != nil {
		return nil, fmt.Errorf("list releases for release target: %w", err)
	}
	if len(releases) == 0 {
		return nil, nil
	}

	latest := releases[0]
	versionRow, err := q.GetDeploymentVersionByID(ctx, latest.VersionID)
	if err != nil {
		return nil, fmt.Errorf("get version %s: %w", latest.VersionID, err)
	}

	createdAt := ""
	if latest.CreatedAt.Valid {
		createdAt = latest.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}

	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *convert.DeploymentVersion(versionRow),
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          createdAt,
	}, nil
}

func (g *PostgresGetter) GetDeploymentVariables(_ context.Context, _ string) ([]oapi.DeploymentVariableWithValues, error) {
	// TODO: implement DB-backed deployment variable fetching
	return nil, nil
}

func (g *PostgresGetter) GetResourceVariables(_ context.Context, _ string) (map[string]oapi.ResourceVariable, error) {
	// TODO: implement DB-backed resource variable fetching
	return nil, nil
}

func (g *PostgresGetter) GetRelatedEntity(_ context.Context, _, _ string) ([]*oapi.EntityRelation, error) {
	// TODO: implement DB-backed entity relationship fetching
	return nil, nil
}
