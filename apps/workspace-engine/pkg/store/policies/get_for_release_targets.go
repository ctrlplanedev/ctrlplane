package policies

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/policies/match"

	"github.com/charmbracelet/log"
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

	deploymentID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	deployment, err := db.GetQueries(ctx).GetDeploymentByID(ctx, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment by id: %w", err)
	}

	environmentID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	environment, err := db.GetQueries(ctx).GetEnvironmentByID(ctx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment by id: %w", err)
	}

	resourceID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	resource, err := db.GetQueries(ctx).GetResourceByID(ctx, resourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource by id: %w", err)
	}

	allPolicies, err := db.GetQueries(ctx).ListPoliciesWithRulesByWorkspaceID(ctx, environment.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("get policies for release target: %w", err)
	}

	policiesOapi := make([]*oapi.Policy, 0, len(allPolicies))
	for _, policy := range allPolicies {
		policiesOapi = append(policiesOapi, db.ToOapiPolicyWithRules(policy))
	}

	policies := match.Filter(ctx, policiesOapi, &match.Target{
		Environment: db.ToOapiEnvironment(environment),
		Deployment:  db.ToOapiDeployment(deployment),
		Resource:    db.ToOapiResource(resource),
	})

	policyIDs := make([]uuid.UUID, 0, len(policies))
	for _, policy := range policies {
		policyID, err := uuid.Parse(policy.Id)
		if err != nil {
			log.Error("failed to parse policy id", "policy_id", policy.Id, "error", err)
			continue
		}
		policyIDs = append(policyIDs, policyID)
	}

	log.Info("setting policies for release target", "policy_ids", len(policyIDs), "environment_id", environmentID, "deployment_id", deploymentID, "resource_id", resourceID)
	db.GetQueries(ctx).SetPoliciesForReleaseTarget(ctx, db.SetPoliciesForReleaseTargetParams{
		PolicyIds:     policyIDs,
		EnvironmentID: environmentID,
		DeploymentID:  deploymentID,
		ResourceID:    resourceID,
	})

	return policies, nil
}
