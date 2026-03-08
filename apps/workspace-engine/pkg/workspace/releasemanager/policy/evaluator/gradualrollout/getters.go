package gradualrollout

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store/policies"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type approvalGetters = approval.Getters
type environmentProgressionGetters = environmentprogression.Getters

type Getters interface {
	approvalGetters
	environmentProgressionGetters

	GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error)
	GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error)
	HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error)
	GetReleaseTargets() ([]*oapi.ReleaseTarget, error)
}

// ---------------------------------------------------------------------------
// Store-backed implementation
// ---------------------------------------------------------------------------

type approvalStoreGetters = approval.StoreGetters
type environmentProgressionStoreGetters = environmentprogression.StoreGetters

var _ Getters = (*StoreGetters)(nil)

type StoreGetters struct {
	*approvalStoreGetters
	*environmentProgressionStoreGetters
	store *store.Store
}

func NewStoreGetters(store *store.Store) *StoreGetters {
	return &StoreGetters{
		approvalStoreGetters:               approval.NewStoreGetters(store),
		environmentProgressionStoreGetters: environmentprogression.NewStoreGetters(store),
		store:                              store,
	}
}

func (s *StoreGetters) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	return s.store.ReleaseTargets.GetPolicies(ctx, releaseTarget)
}

func (s *StoreGetters) GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error) {
	ps := s.store.PolicySkips.GetAllForTarget(versionID, environmentID, resourceID)
	return ps, nil
}

func (s *StoreGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	_, _, err := s.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	if err != nil {
		return false, nil
	}
	return true, nil
}

func (s *StoreGetters) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
	items, err := s.store.ReleaseTargets.Items()
	if err != nil {
		return nil, err
	}
	targets := make([]*oapi.ReleaseTarget, 0, len(items))
	for _, rt := range items {
		targets = append(targets, rt)
	}
	return targets, nil
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

func (p *PostgresGetters) GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error) {
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

func (p *PostgresGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
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
	releases, err := p.queries.ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    resourceIDUUID,
		EnvironmentID: environmentIDUUID,
		DeploymentID:  deploymentIDUUID,
	})
	if err != nil {
		return false, err
	}
	return len(releases) > 0, nil
}

func (p *PostgresGetters) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
	panic("not implemented: GetReleaseTargets")
}
