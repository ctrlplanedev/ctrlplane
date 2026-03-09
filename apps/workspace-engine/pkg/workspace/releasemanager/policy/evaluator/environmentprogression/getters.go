package environmentprogression

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	"workspace-engine/pkg/store/releasetargets"
	legacystore "workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type environmentGetter = store.EnvironmentGetter
type deploymentGetter = store.DeploymentGetter
type resourceGetter = store.ResourceGetter
type releaseGetter = store.ReleaseGetter
type releaseTargetForDeploymentAndEnvironmentGetter = releasetargets.GetReleaseTargetsForDeploymentAndEnvironment

type Getters interface {
	environmentGetter
	deploymentGetter
	resourceGetter
	releaseGetter

	releaseTargetForDeploymentAndEnvironmentGetter

	GetSystemIDsForEnvironment(environmentID string) []string
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

func (s *StoreGetters) GetReleaseTargetsForDeploymentAndEnvironment(ctx context.Context, deploymentID, environmentID string) ([]oapi.ReleaseTarget, error) {
	envTargets, err := s.store.ReleaseTargets.GetForEnvironment(ctx, environmentID)
	if err != nil {
		return nil, err
	}
	rts := make([]oapi.ReleaseTarget, 0, len(envTargets))
	for _, target := range envTargets {
		if target.DeploymentId == deploymentID {
			rts = append(rts, *target)
		}
	}
	return rts, nil
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
	releaseTargetForDeploymentAndEnvironmentGetter

	queries *db.Queries
}

func NewPostgresGetters(queries *db.Queries) *PostgresGetters {
	return &PostgresGetters{
		queries:           queries,
		environmentGetter: store.NewPostgresEnvironmentGetter(queries),
		deploymentGetter:  store.NewPostgresDeploymentGetter(queries),
		resourceGetter:    store.NewPostgresResourceGetter(queries),
		releaseGetter:     store.NewPostgresReleaseGetter(queries),
		releaseTargetForDeploymentAndEnvironmentGetter: &releasetargets.PostgresGetReleaseTargetsForDeploymentAndEnvironment{},
	}
}

func (p *PostgresGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	ctx := context.TODO()
	envUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil
	}
	ids, err := p.queries.GetSystemIDsForEnvironment(ctx, envUUID)
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
	envUUID, err := uuid.Parse(environmentID)
	if err != nil {
		return nil, fmt.Errorf("parse environment id: %w", err)
	}
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
	depUUID, err := uuid.Parse(deploymentID)
	if err != nil {
		return nil, fmt.Errorf("parse deployment id: %w", err)
	}
	rows, err := p.queries.GetReleaseTargetsForDeployment(ctx, depUUID)
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
	wsUUID, err := uuid.Parse(workspaceID)
	if err != nil {
		return nil, fmt.Errorf("parse workspace id: %w", err)
	}
	rows, err := p.queries.ListPoliciesByWorkspaceID(ctx, db.ListPoliciesByWorkspaceIDParams{
		WorkspaceID: wsUUID,
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
