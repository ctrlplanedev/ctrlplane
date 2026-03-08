package policies

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/policies/match"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace-engine/pkg/store/policies")

type GetPoliciesForReleaseTarget interface {
	GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error)
}

var _ GetPoliciesForReleaseTarget = (*PostgresGetPoliciesForReleaseTarget)(nil)

type PostgresGetPoliciesForReleaseTarget struct{}

func (p *PostgresGetPoliciesForReleaseTarget) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	ctx, span := tracer.Start(ctx, "Store.GetPoliciesForReleaseTarget")
	defer span.End()

	deployment, err := db.GetQueries(ctx).GetDeploymentByID(ctx, uuid.MustParse(releaseTarget.DeploymentId))
	if err != nil {
		return nil, fmt.Errorf("get deployment by id: %w", err)
	}

	environment, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, uuid.MustParse(releaseTarget.EnvironmentId))
	if err != nil {
		return nil, fmt.Errorf("get environment by id: %w", err)
	}

	resource, err := db.GetQueries(ctx).GetResourceByID(ctx, uuid.MustParse(releaseTarget.ResourceId))
	if err != nil {
		return nil, fmt.Errorf("get resource by id: %w", err)
	}

	allPolicies, err := db.GetQueries(ctx).ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: environment.WorkspaceID,
	})
	if err != nil {
		return nil, fmt.Errorf("get policies for release target: %w", err)
	}

	policiesOapi := make([]*oapi.Policy, 0, len(allPolicies))
	for _, policy := range allPolicies {
		policiesOapi = append(policiesOapi, db.ToOapiPolicy(policy))
	}

	policies := match.Filter(ctx, policiesOapi, &match.Target{
		Environment: db.ToOapiEnvironment(environment),
		Deployment:  db.ToOapiDeployment(deployment),
		Resource:    db.ToOapiResource(resource),
	})

	return policies, nil
}
