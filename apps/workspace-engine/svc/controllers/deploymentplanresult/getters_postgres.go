package deploymentplanresult

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/jobagents"
	"workspace-engine/pkg/jobagents/argo"
	"workspace-engine/pkg/jobagents/terraformcloud"
	"workspace-engine/pkg/jobagents/testrunner"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/policies/match"
)

type PostgresGetter struct{}

func (g *PostgresGetter) GetDeploymentPlanTargetResult(
	ctx context.Context,
	id uuid.UUID,
) (db.DeploymentPlanTargetResult, error) {
	return db.GetQueries(ctx).GetDeploymentPlanTargetResult(ctx, id)
}

func (g *PostgresGetter) GetTargetContextByResultID(
	ctx context.Context,
	resultID uuid.UUID,
) (db.GetTargetContextByResultIDRow, error) {
	return db.GetQueries(ctx).GetTargetContextByResultID(ctx, resultID)
}

func (g *PostgresGetter) ListDeploymentPlanTargetResultsByTargetID(
	ctx context.Context,
	targetID uuid.UUID,
) ([]db.ListDeploymentPlanTargetResultsByTargetIDRow, error) {
	return db.GetQueries(ctx).ListDeploymentPlanTargetResultsByTargetID(ctx, targetID)
}

func (g *PostgresGetter) GetCurrentVersionForPlanTarget(
	ctx context.Context,
	planTargetID uuid.UUID,
) (*oapi.DeploymentVersion, error) {
	row, err := db.GetQueries(ctx).GetCurrentVersionForPlanTarget(ctx, planTargetID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("get current version for plan target: %w", err)
	}
	return db.ToOapiDeploymentVersion(row), nil
}

func (g *PostgresGetter) GetMatchingPlanValidationOpaRules(
	ctx context.Context,
	workspaceID uuid.UUID,
	target *match.Target,
) ([]oapi.PolicyRule, error) {
	rows, err := db.GetQueries(ctx).ListPlanValidationOpaRulesForWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list plan validation opa rules: %w", err)
	}
	if len(rows) == 0 {
		return nil, nil
	}

	selectorMatches := make(map[string]bool, len(rows))
	matched := make([]oapi.PolicyRule, 0, len(rows))
	for _, row := range rows {
		if _, seen := selectorMatches[row.PolicySelector]; !seen {
			selectorMatches[row.PolicySelector] = match.Match(
				ctx,
				&oapi.Policy{Selector: row.PolicySelector},
				target,
			)
		}
		if !selectorMatches[row.PolicySelector] {
			continue
		}

		var description *string
		if row.Description.Valid {
			d := row.Description.String
			description = &d
		}

		matched = append(matched, oapi.PolicyRule{
			Id:        row.ID.String(),
			PolicyId:  row.PolicyID.String(),
			CreatedAt: row.CreatedAt.Time.Format(time.RFC3339),
			PlanValidationOpa: &oapi.PlanValidationOpaRule{
				Name:        row.Name,
				Description: description,
				Rego:        row.Rego,
			},
		})
	}
	return matched, nil
}

func newRegistry() *jobagents.Registry {
	registry := jobagents.NewRegistry(nil, nil)
	registry.Register(
		argo.NewArgoCDPlanner(
			&argo.GoApplicationUpserter{},
			&argo.GoApplicationDeleter{},
			&argo.GoManifestGetter{},
		),
	)
	registry.Register(testrunner.New(nil))
	registry.Register(
		terraformcloud.NewTFCPlanner(
			&terraformcloud.GoWorkspaceSetup{},
			&terraformcloud.GoSpeculativeRunner{},
		),
	)
	return registry
}
