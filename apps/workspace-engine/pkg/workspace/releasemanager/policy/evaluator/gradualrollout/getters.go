package gradualrollout

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
)

type approvalGetters = approval.Getters
type environmentProgressionGetters = environmentprogression.Getters

type Getters interface {
	approvalGetters
	environmentProgressionGetters

	GetPoliciesForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) ([]*oapi.Policy, error)
	GetPolicySkips(
		ctx context.Context,
		versionID, environmentID, resourceID string,
	) ([]*oapi.PolicySkip, error)
	HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error)
	GetReleaseTargetsForDeployment(
		ctx context.Context,
		deploymentID string,
	) ([]*oapi.ReleaseTarget, error)
}

// ---------------------------------------------------------------------------
// Postgres-backed implementation
// ---------------------------------------------------------------------------

type approvalPostgresGetters = approval.PostgresGetters
type environmentProgressionPostgresGetters = environmentprogression.PostgresGetters
type policiesForReleaseTargetGetter = policies.GetPoliciesForReleaseTarget

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	*approvalPostgresGetters
	*environmentProgressionPostgresGetters
	policiesForReleaseTargetGetter
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		policiesForReleaseTargetGetter:        &policies.PostgresGetPoliciesForReleaseTarget{},
		approvalPostgresGetters:               approval.NewPostgresGetters(queries),
		environmentProgressionPostgresGetters: environmentprogression.NewPostgresGetters(queries),
		queries:                               queries,
	}
}

func (p *PostgresGetters) GetPolicySkips(
	ctx context.Context,
	versionID, environmentID, resourceID string,
) ([]*oapi.PolicySkip, error) {
	versionIDUUID, err := uuid.Parse(versionID)
	if err != nil {
		return nil, fmt.Errorf("parse version id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
	resourceIDUUID, err := uuid.Parse(resourceID)
	if err != nil {
		return nil, fmt.Errorf("parse resource id: %w", err)
	}
	skips, err := p.queries.ListPolicySkipsForTarget(ctx, db.ListPolicySkipsForTargetParams{
		VersionID:     versionIDUUID,
		EnvironmentID: environmentIDUUID,
		ResourceID:    resourceIDUUID,
	})
	if err != nil {
		return nil, err
	}
	ps := make([]*oapi.PolicySkip, 0, len(skips))
	for _, skip := range skips {
		ps = append(ps, db.ToOapiPolicySkip(skip))
	}
	return ps, nil
}

func (p *PostgresGetters) HasCurrentRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) (bool, error) {
	resourceIDUUID, err := uuid.Parse(releaseTarget.ResourceId)
	if err != nil {
		return false, fmt.Errorf("parse resource id: %w", err)
	}
	environmentIDUUID, err := uuid.Parse(releaseTarget.EnvironmentId)
	if err != nil {
		return false, fmt.Errorf("parse environment id: %w", err)
	}
	deploymentIDUUID, err := uuid.Parse(releaseTarget.DeploymentId)
	if err != nil {
		return false, fmt.Errorf("parse deployment id: %w", err)
	}
	releases, err := p.queries.ListReleasesByReleaseTarget(
		ctx,
		db.ListReleasesByReleaseTargetParams{
			ResourceID:    resourceIDUUID,
			EnvironmentID: environmentIDUUID,
			DeploymentID:  deploymentIDUUID,
		},
	)
	if err != nil {
		return false, err
	}
	return len(releases) > 0, nil
}

func (p *PostgresGetters) GetReleaseTargetsForDeployment(
	ctx context.Context,
	deploymentID string,
) ([]*oapi.ReleaseTarget, error) {
	deploymentUUID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	rows, err := p.queries.GetReleaseTargetsForDeployment(ctx, deploymentUUID)
	if err != nil {
		return nil, fmt.Errorf("get release targets for deployment: %w", err)
	}
	targets := make([]*oapi.ReleaseTarget, 0, len(rows))
	for _, row := range rows {
		targets = append(targets, &oapi.ReleaseTarget{
			DeploymentId:  row.DeploymentID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			ResourceId:    row.ResourceID.String(),
		})
	}
	return targets, nil
}
