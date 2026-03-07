package policysummary

import (
	"context"
	"fmt"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/svc/controllers/policysummary/summaryeval"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var storeGetterTracer = otel.Tracer("policysummary.getters_store")

type storeEvalGetter = summaryeval.StoreGetter

var _ Getter = (*StoreGetter)(nil)

type StoreGetter struct {
	*storeEvalGetter
	ws *workspace.Workspace
}

func NewStoreGetter(ws *workspace.Workspace) *StoreGetter {
	return &StoreGetter{
		storeEvalGetter: summaryeval.NewStoreGetter(ws.Store()),
		ws:              ws,
	}
}

func (g *StoreGetter) GetVersion(ctx context.Context, versionID uuid.UUID) (*oapi.DeploymentVersion, error) {
	ver, ok := g.ws.DeploymentVersions().Get(versionID.String())
	if !ok {
		return nil, fmt.Errorf("version %s not found", versionID)
	}
	return ver, nil
}

func (g *StoreGetter) GetPoliciesForEnvironment(ctx context.Context, workspaceID, environmentID uuid.UUID) ([]*oapi.Policy, error) {
	ctx, span := storeGetterTracer.Start(ctx, "GetPoliciesForEnvironment")
	defer span.End()

	releaseTargets, err := g.ws.ReleaseTargets().GetForEnvironment(ctx, environmentID.String())
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to get release targets for environment")
		return nil, fmt.Errorf("get release targets for environment: %w", err)
	}

	span.SetAttributes(attribute.Int("release_targets_count", len(releaseTargets)))

	allPolicies := make(map[string]*oapi.Policy)

	for _, rt := range releaseTargets {
		policies, err := g.storeEvalGetter.GetPoliciesForReleaseTarget(ctx, rt)
		span.AddEvent("get_policies_for_release_target", trace.WithAttributes(attribute.Int("policies_count", len(policies))))
		if err != nil {
			return nil, fmt.Errorf("get policies for release target: %w", err)
		}
		for _, p := range policies {
			allPolicies[p.Id] = p
		}
	}

	policiesSlice := make([]*oapi.Policy, 0, len(allPolicies))
	for _, p := range allPolicies {
		policiesSlice = append(policiesSlice, p)
	}

	span.SetAttributes(attribute.Int("policies_count", len(policiesSlice)))

	return policiesSlice, nil
}

func (g *StoreGetter) GetPoliciesForDeployment(ctx context.Context, workspaceID, deploymentID uuid.UUID) ([]*oapi.Policy, error) {
	return g.GetPoliciesForEnvironment(ctx, workspaceID, deploymentID)
}
