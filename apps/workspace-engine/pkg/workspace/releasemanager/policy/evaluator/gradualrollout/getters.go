package gradualrollout

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/store/releasetargets"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
)

func parseReleaseTargetUUIDs(rt *oapi.ReleaseTarget) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	resourceID, err := uuid.Parse(rt.ResourceId)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("parse resource id: %w", err)
	}
	environmentID, err := uuid.Parse(rt.EnvironmentId)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("parse environment id: %w", err)
	}
	deploymentID, err := uuid.Parse(rt.DeploymentId)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("parse deployment id: %w", err)
	}
	return resourceID, environmentID, deploymentID, nil
}

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
	GetCurrentVersionID(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*string, error)
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

func NewPostgresGetters(
	queries *db.Queries,
	rtForDep releasetargets.GetReleaseTargetsForDeployment,
	rtForDepEnv releasetargets.GetReleaseTargetsForDeploymentAndEnvironment,
	policiesForRT policies.GetPoliciesForReleaseTarget,
	jobsForRT releasetargets.GetJobsForReleaseTarget,
) *PostgresGetters {
	return &PostgresGetters{
		policiesForReleaseTargetGetter: policiesForRT,
		approvalPostgresGetters:        approval.NewPostgresGetters(queries),
		environmentProgressionPostgresGetters: environmentprogression.NewPostgresGetters(
			queries,
			rtForDep,
			rtForDepEnv,
			jobsForRT,
		),
		queries: queries,
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

func (p *PostgresGetters) GetCurrentVersionID(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) (*string, error) {
	resourceID, environmentID, deploymentID, err := parseReleaseTargetUUIDs(releaseTarget)
	if err != nil {
		return nil, err
	}
	versionID, err := p.queries.GetCurrentVersionIDByReleaseTarget(
		ctx,
		db.GetCurrentVersionIDByReleaseTargetParams{
			ResourceID:    resourceID,
			EnvironmentID: environmentID,
			DeploymentID:  deploymentID,
		},
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	s := versionID.String()
	return &s, nil
}

func (p *PostgresGetters) HasCurrentRelease(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) (bool, error) {
	resourceID, environmentID, deploymentID, err := parseReleaseTargetUUIDs(releaseTarget)
	if err != nil {
		return false, err
	}
	releases, err := p.queries.ListReleasesByReleaseTarget(
		ctx,
		db.ListReleasesByReleaseTargetParams{
			ResourceID:    resourceID,
			EnvironmentID: environmentID,
			DeploymentID:  deploymentID,
		},
	)
	if err != nil {
		return false, err
	}
	return len(releases) > 0, nil
}
