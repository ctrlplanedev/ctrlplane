package environmentprogression

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type environmentGetter = store.EnvironmentGetter
type deploymentGetter = store.DeploymentGetter
type resourceGetter = store.ResourceGetter
type releaseGetter = store.ReleaseGetter

type Getters interface {
	environmentGetter
	deploymentGetter
	resourceGetter
	releaseGetter

	GetSystemIDsForEnvironment(environmentID string) []string
	GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error)
	GetReleaseTargetsForDeployment(ctx context.Context, deploymentID string) ([]*oapi.ReleaseTarget, error)
	GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job
	GetAllPolicies(ctx context.Context, workspaceID string) (map[string]*oapi.Policy, error)
}

// ---------------------------------------------------------------------------
// Store-backed implementation
// ---------------------------------------------------------------------------

var _ Getters = (*StoreGetters)(nil)

type StoreGetters struct {
	environmentGetter
	deploymentGetter
	resourceGetter
	releaseGetter

	store *legacystore.Store
}

func NewStoreGetters(ls *legacystore.Store) *StoreGetters {
	return &StoreGetters{
		store:             ls,
		environmentGetter: store.NewStoreEnvironmentGetter(ls),
		deploymentGetter:  store.NewStoreDeploymentGetter(ls),
		resourceGetter:    store.NewStoreResourceGetter(ls),
		releaseGetter:     store.NewStoreReleaseGetter(ls),
	}
}

func (s *StoreGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	return s.store.SystemEnvironments.GetSystemIDsForEnvironment(environmentID)
}

func (s *StoreGetters) GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error) {
	return s.store.ReleaseTargets.GetForEnvironment(ctx, environmentID)
}

func (s *StoreGetters) GetReleaseTargetsForDeployment(ctx context.Context, deploymentID string) ([]*oapi.ReleaseTarget, error) {
	return s.store.ReleaseTargets.GetForDeployment(ctx, deploymentID)
}

func (s *StoreGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	return s.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}

func (s *StoreGetters) GetAllPolicies(ctx context.Context, workspaceID string) (map[string]*oapi.Policy, error) {
	pol := s.store.Policies.Items()
	return pol, nil
}

// ---------------------------------------------------------------------------
// Postgres-backed implementation
// ---------------------------------------------------------------------------

var _ Getters = (*PostgresGetters)(nil)

type PostgresGetters struct {
	environmentGetter
	deploymentGetter
	resourceGetter
	releaseGetter

	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		queries:           queries,
		environmentGetter: store.NewPostgresEnvironmentGetter(queries),
		deploymentGetter:  store.NewPostgresDeploymentGetter(queries),
		resourceGetter:    store.NewPostgresResourceGetter(queries),
		releaseGetter:     store.NewPostgresReleaseGetter(queries),
	}
}

func (p *PostgresGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	ctx := context.TODO()
	ids, err := p.queries.GetSystemIDsForEnvironment(ctx, uuid.MustParse(environmentID))
	if err != nil {
		return nil
	}
	result := make([]string, len(ids))
	for i, id := range ids {
		result[i] = id.String()
	}
	return result
}

func (p *PostgresGetters) GetReleaseTargetsForEnvironment(ctx context.Context, environmentID string) ([]*oapi.ReleaseTarget, error) {
	envUUID := uuid.MustParse(environmentID)
	systemIDs, err := p.queries.GetSystemIDsForEnvironment(ctx, envUUID)
	if err != nil {
		return nil, err
	}

	seen := make(map[string]struct{})
	var targets []*oapi.ReleaseTarget

	for _, systemID := range systemIDs {
		deploymentIDs, err := p.queries.GetDeploymentIDsForSystem(ctx, systemID)
		if err != nil {
			return nil, err
		}
		for _, depID := range deploymentIDs {
			rows, err := p.queries.GetReleaseTargetsForDeployment(ctx, depID)
			if err != nil {
				return nil, err
			}
			for _, row := range rows {
				if row.EnvironmentID != envUUID {
					continue
				}
				key := row.DeploymentID.String() + "/" + row.EnvironmentID.String() + "/" + row.ResourceID.String()
				if _, ok := seen[key]; ok {
					continue
				}
				seen[key] = struct{}{}
				targets = append(targets, &oapi.ReleaseTarget{
					DeploymentId:  row.DeploymentID.String(),
					EnvironmentId: row.EnvironmentID.String(),
					ResourceId:    row.ResourceID.String(),
				})
			}
		}
	}
	return targets, nil
}

func (p *PostgresGetters) GetReleaseTargetsForDeployment(ctx context.Context, deploymentID string) ([]*oapi.ReleaseTarget, error) {
	rows, err := p.queries.GetReleaseTargetsForDeployment(ctx, uuid.MustParse(deploymentID))
	if err != nil {
		return nil, err
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

func (p *PostgresGetters) GetJobsForReleaseTarget(releaseTarget *oapi.ReleaseTarget) map[string]*oapi.Job {
	ctx := context.TODO()
	releases, err := p.queries.ListReleasesByReleaseTarget(ctx, db.ListReleasesByReleaseTargetParams{
		ResourceID:    uuid.MustParse(releaseTarget.ResourceId),
		EnvironmentID: uuid.MustParse(releaseTarget.EnvironmentId),
		DeploymentID:  uuid.MustParse(releaseTarget.DeploymentId),
	})
	if err != nil {
		return nil
	}

	result := make(map[string]*oapi.Job)
	for _, rel := range releases {
		jobs, err := p.queries.ListJobsByReleaseID(ctx, rel.ID)
		if err != nil {
			continue
		}
		for _, row := range jobs {
			j := db.ToOapiJob(row)
			result[j.Id] = j
		}
	}
	return result
}

func (p *PostgresGetters) GetAllPolicies(ctx context.Context, workspaceID string) (map[string]*oapi.Policy, error) {
	rows, err := p.queries.ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: uuid.MustParse(workspaceID),
	})
	if err != nil {
		return nil, err
	}
	result := make(map[string]*oapi.Policy, len(rows))
	for _, row := range rows {
		pol := db.ToOapiPolicy(row)
		result[pol.Id] = pol
	}
	return result, nil
}
