package policies

import (
	"context"
	"fmt"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	gocache "github.com/patrickmn/go-cache"
	"go.opentelemetry.io/otel"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/policies/match"
)

var tracer = otel.Tracer("workspace-engine/pkg/store/policies")

type GetPoliciesForReleaseTarget interface {
	GetPoliciesForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) ([]*oapi.Policy, error)
}

var _ GetPoliciesForReleaseTarget = (*PostgresGetPoliciesForReleaseTarget)(nil)

type PostgresGetPoliciesForReleaseTarget struct {
	cache *gocache.Cache
}

func NewPostgresGetPoliciesForReleaseTarget(opts ...Option) *PostgresGetPoliciesForReleaseTarget {
	return &PostgresGetPoliciesForReleaseTarget{cache: buildCache(opts)}
}

func (p *PostgresGetPoliciesForReleaseTarget) listWorkspacePolicies(
	ctx context.Context,
	workspaceID uuid.UUID,
) ([]*oapi.Policy, error) {
	cacheKey := workspaceID.String()
	if p.cache != nil {
		if v, ok := p.cache.Get(cacheKey); ok {
			return v.([]*oapi.Policy), nil
		}
	}

	rows, err := db.GetQueries(ctx).
		ListPoliciesWithRulesByWorkspaceID(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("list policies with rules: %w", err)
	}
	policies := make([]*oapi.Policy, 0, len(rows))
	for _, row := range rows {
		policies = append(policies, db.ToOapiPolicyWithRules(row))
	}

	if p.cache != nil {
		p.cache.SetDefault(cacheKey, policies)
	}

	return policies, nil
}

func (p *PostgresGetPoliciesForReleaseTarget) GetPoliciesForReleaseTarget(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) ([]*oapi.Policy, error) {
	ctx, span := tracer.Start(ctx, "Store.GetPoliciesForReleaseTarget")
	defer span.End()

	deploymentSpanCtx, deploymentSpan := tracer.Start(ctx, "GetDeploymentByID")
	deploymentID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	deployment, err := db.GetQueries(deploymentSpanCtx).
		GetDeploymentByID(deploymentSpanCtx, deploymentID)
	if err != nil {
		return nil, fmt.Errorf("get deployment by id: %w", err)
	}
	deploymentSpan.End()

	environmentSpanCtx, environmentSpan := tracer.Start(ctx, "GetEnvironmentByID")
	environmentID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	environment, err := db.GetQueries(environmentSpanCtx).
		GetEnvironmentByID(environmentSpanCtx, environmentID)
	if err != nil {
		return nil, fmt.Errorf("get environment by id: %w", err)
	}
	environmentSpan.End()

	resourceSpanCtx, resourceSpan := tracer.Start(ctx, "GetResourceByID")
	resourceID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	resource, err := db.GetQueries(resourceSpanCtx).GetResourceByID(resourceSpanCtx, resourceID)
	if err != nil {
		return nil, fmt.Errorf("get resource by id: %w", err)
	}
	resourceSpan.End()

	allPoliciesSpanCtx, allPoliciesSpan := tracer.Start(ctx, "ListPoliciesWithRulesByWorkspaceID")
	policiesOapi, err := p.listWorkspacePolicies(allPoliciesSpanCtx, environment.WorkspaceID)
	if err != nil {
		return nil, fmt.Errorf("get policies for release target: %w", err)
	}
	allPoliciesSpan.End()

	filterPoliciesSpanCtx, filterPoliciesSpan := tracer.Start(ctx, "FilterPolicies")
	policies := match.Filter(filterPoliciesSpanCtx, policiesOapi, &match.Target{
		Environment: db.ToOapiEnvironment(environment),
		Deployment:  db.ToOapiDeployment(deployment),
		Resource:    db.ToOapiResource(resource),
	})
	filterPoliciesSpan.End()

	policyIDs := make([]uuid.UUID, 0, len(policies))
	for _, policy := range policies {
		policyID, err := uuid.Parse(policy.Id)
		if err != nil {
			log.Error("failed to parse policy id", "policy_id", policy.Id, "error", err)
			continue
		}
		policyIDs = append(policyIDs, policyID)
	}

	log.Info(
		"setting policies for release target",
		"policy_ids",
		len(policyIDs),
		"environment_id",
		environmentID,
		"deployment_id",
		deploymentID,
		"resource_id",
		resourceID,
	)
	setPoliciesSpanCtx, setPoliciesSpan := tracer.Start(ctx, "SetPoliciesForReleaseTarget")
	db.GetQueries(setPoliciesSpanCtx).
		SetPoliciesForReleaseTarget(setPoliciesSpanCtx, db.SetPoliciesForReleaseTargetParams{
			PolicyIds:     policyIDs,
			EnvironmentID: environmentID,
			DeploymentID:  deploymentID,
			ResourceID:    resourceID,
		})
	setPoliciesSpan.End()

	return policies, nil
}
