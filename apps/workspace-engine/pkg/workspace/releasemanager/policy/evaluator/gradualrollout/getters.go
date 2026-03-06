package gradualrollout

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
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
	GetPolicySkips(versionID, environmentID, resourceID string) []*oapi.PolicySkip
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

func (s *StoreGetters) GetPolicySkips(versionID, environmentID, resourceID string) []*oapi.PolicySkip {
	return s.store.PolicySkips.GetAllForTarget(versionID, environmentID, resourceID)
}

func (s *StoreGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	_, _, err := s.store.ReleaseTargets.GetCurrentRelease(ctx, releaseTarget)
	return err == nil, err
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

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	*approvalPostgresGetters
	*environmentProgressionPostgresGetters
	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries, workspaceID uuid.UUID) *PostgresGetters {
	return &PostgresGetters{
		approvalPostgresGetters:               approval.NewPostgresGetters(queries),
		environmentProgressionPostgresGetters: environmentprogression.NewPostgresGetters(queries),
		queries:                               queries,
	}
}

func (p *PostgresGetters) GetPoliciesForReleaseTarget(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	panic("not implemented: GetPoliciesForReleaseTarget")
}

func (p *PostgresGetters) GetPolicySkips(versionID, environmentID, resourceID string) []*oapi.PolicySkip {
	panic("not implemented: GetPolicySkips")
}

func (p *PostgresGetters) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (bool, error) {
	releases, err := p.queries.ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    uuid.MustParse(releaseTarget.ResourceId),
		EnvironmentID: uuid.MustParse(releaseTarget.EnvironmentId),
		DeploymentID:  uuid.MustParse(releaseTarget.DeploymentId),
	})
	if err != nil {
		return false, err
	}
	return len(releases) > 0, nil
}

func (p *PostgresGetters) GetReleaseTargets() ([]*oapi.ReleaseTarget, error) {
	panic("not implemented: GetReleaseTargets")
}
