package policysummary

import (
	"context"
	"fmt"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/svc/controllers/policysummary/summaryeval"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var postgresGetterTracer = otel.Tracer("policysummary.getters_postgres")

type summaryevalGetter = summaryeval.PostgresGetter

var _ Getter = (*PostgresGetter)(nil)

type PostgresGetter struct {
	*summaryevalGetter
	queries *db.Queries
}

func NewPostgresGetter(queries *db.Queries) *PostgresGetter {
	return &PostgresGetter{
		summaryevalGetter: summaryeval.NewPostgresGetter(queries),
		queries:           queries,
	}
}

func (g *PostgresGetter) GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error) {
	ver, err := g.queries.GetDeploymentVersionByID(ctx, versionID)
	if err != nil {
		return nil, fmt.Errorf("get version %s: %w", versionID, err)
	}
	return db.ToOapiDeploymentVersion(ver), nil
}

func (g *PostgresGetter) GetPoliciesForEnvironment(ctx context.Context, workspaceID, environmentID uuid.UUID) ([]*oapi.Policy, error) {
	ctx, span := postgresGetterTracer.Start(ctx, "GetPoliciesForEnvironment")
	defer span.End()

	policyRows, err := g.queries.ListPoliciesWithRulesByWorkspaceID(ctx, workspaceID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to list policies for workspace")
		return nil, fmt.Errorf("list policies for workspace %s: %w", workspaceID, err)
	}

	span.SetAttributes(attribute.Int("policies_count", len(policyRows)))

	allPolicies := make([]*oapi.Policy, 0, len(policyRows))
	for _, row := range policyRows {
		allPolicies = append(allPolicies, db.ToOapiPolicyWithRules(row))
	}

	releaseTargets, err := g.queries.GetReleaseTargetsForEnvironment(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("get release targets for environment %s: %w", environmentID, err)
	}

	span.SetAttributes(attribute.Int("release_targets_count", len(releaseTargets)))

	envRow, err := g.queries.GetEnvironmentByID(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment %s: %w", environmentID, err)
	}
	environment := db.ToOapiEnvironment(envRow)

	span.SetAttributes(attribute.String("environment.id", environment.Id))

	seen := make(map[string]struct{})
	var matched []*oapi.Policy

	for _, rt := range releaseTargets {
		depRow, err := g.queries.GetDeploymentByID(ctx, rt.DeploymentID)
		if err != nil {
			continue
		}
		resRow, err := g.queries.GetResourceByID(ctx, rt.ResourceID)
		if err != nil {
			continue
		}
		deployment := db.ToOapiDeployment(depRow)
		resource := db.ToOapiResource(resRow)
		resolved := selector.NewResolvedReleaseTarget(environment, deployment, resource)

		for _, p := range allPolicies {
			if _, ok := seen[p.Id]; ok {
				continue
			}
			if selector.MatchPolicy(ctx, p, resolved) {
				seen[p.Id] = struct{}{}
				matched = append(matched, p)
			}
		}
	}

	span.SetAttributes(attribute.Int("matched_policies_count", len(matched)))

	return matched, nil
}

func (g *PostgresGetter) GetPoliciesForDeployment(ctx context.Context, workspaceID, deploymentID uuid.UUID) ([]*oapi.Policy, error) {
	return g.GetPoliciesForEnvironment(ctx, workspaceID, deploymentID)
}
