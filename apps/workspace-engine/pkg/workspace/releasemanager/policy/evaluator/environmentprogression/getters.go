package environmentprogression

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/store"
	"workspace-engine/pkg/store/releasetargets"
	legacystore "workspace-engine/pkg/workspace/store"
)

var gettersTracer = otel.Tracer(
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression/getters",
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
	GetReleaseTargetsForDeployment(
		ctx context.Context,
		deploymentID string,
	) ([]*oapi.ReleaseTarget, error)
	GetJobsForReleaseTarget(
		ctx context.Context,
		releaseTarget *oapi.ReleaseTarget,
	) map[string]*oapi.Job
	GetAllPolicies(ctx context.Context, workspaceID string) (map[string]*oapi.Policy, error)
	GetReleaseByJobID(ctx context.Context, jobID string) (*oapi.Release, error)
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

func (p *PostgresGetters) GetReleaseTargetsForEnvironment(
	ctx context.Context,
	environmentID string,
) ([]*oapi.ReleaseTarget, error) {
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

func (p *PostgresGetters) GetReleaseTargetsForDeployment(
	ctx context.Context,
	deploymentID string,
) ([]*oapi.ReleaseTarget, error) {
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

func (p *PostgresGetters) GetJobsForReleaseTarget(
	ctx context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	ctx, span := gettersTracer.Start(ctx, "GetJobsForReleaseTarget")
	defer span.End()

	span.SetAttributes(attribute.String("release_target.deployment_id", releaseTarget.DeploymentId))
	span.SetAttributes(
		attribute.String("release_target.environment_id", releaseTarget.EnvironmentId),
	)
	span.SetAttributes(attribute.String("release_target.resource_id", releaseTarget.ResourceId))

	rows, err := p.queries.ListJobsByReleaseTarget(ctx, db.ListJobsByReleaseTargetParams{
		DeploymentID:  uuid.MustParse(releaseTarget.DeploymentId),
		EnvironmentID: uuid.MustParse(releaseTarget.EnvironmentId),
		ResourceID:    uuid.MustParse(releaseTarget.ResourceId),
	})
	if err != nil {
		return nil
	}
	span.SetAttributes(attribute.Int("jobs.count", len(rows)))

	jobs := make(map[string]*oapi.Job, len(rows))
	for _, row := range rows {
		jobs[row.ID.String()] = db.ToOapiJob(db.ListJobsByReleaseIDRow(row))
	}
	return jobs
}

func (p *PostgresGetters) GetAllPolicies(
	ctx context.Context,
	workspaceID string,
) (map[string]*oapi.Policy, error) {
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

func (p *PostgresGetters) GetReleaseByJobID(
	ctx context.Context,
	jobID string,
) (*oapi.Release, error) {
	row, err := p.queries.GetReleaseByJobID(ctx, uuid.MustParse(jobID))
	if err != nil {
		return nil, err
	}
	release := db.ToOapiRelease(row)

	versionRow, err := p.queries.GetDeploymentVersionByID(ctx, row.VersionID)
	if err != nil {
		return nil, err
	}
	release.Version = *db.ToOapiDeploymentVersion(versionRow)

	return release, nil
}

// ---------------------------------------------------------------------------
// In-memory store adapter (used by workspace-engine runtime)
// ---------------------------------------------------------------------------

var _ Getters = (*StoreGetters)(nil)

type StoreGetters struct {
	store *legacystore.Store
}

func NewStoreGetters(s *legacystore.Store) *StoreGetters {
	return &StoreGetters{store: s}
}

func (g *StoreGetters) GetEnvironment(_ context.Context, id string) (*oapi.Environment, error) {
	env, ok := g.store.Environments.Get(id)
	if !ok {
		return nil, fmt.Errorf("environment %s not found", id)
	}
	return env, nil
}

func (g *StoreGetters) GetAllEnvironments(_ context.Context, _ string) (map[string]*oapi.Environment, error) {
	return g.store.Environments.Items(), nil
}

func (g *StoreGetters) GetDeployment(_ context.Context, id string) (*oapi.Deployment, error) {
	d, ok := g.store.Deployments.Get(id)
	if !ok {
		return nil, fmt.Errorf("deployment %s not found", id)
	}
	return d, nil
}

func (g *StoreGetters) GetAllDeployments(_ context.Context, _ string) (map[string]*oapi.Deployment, error) {
	return g.store.Deployments.Items(), nil
}

func (g *StoreGetters) GetResource(_ context.Context, id string) (*oapi.Resource, error) {
	r, ok := g.store.Resources.Get(id)
	if !ok {
		return nil, fmt.Errorf("resource %s not found", id)
	}
	return r, nil
}

func (g *StoreGetters) GetRelease(_ context.Context, id string) (*oapi.Release, error) {
	r, ok := g.store.Releases.Get(id)
	if !ok {
		return nil, fmt.Errorf("release %s not found", id)
	}
	return r, nil
}

func (g *StoreGetters) GetReleaseTargetsForDeploymentAndEnvironment(
	_ context.Context,
	deploymentID string,
	environmentID string,
) ([]oapi.ReleaseTarget, error) {
	allTargets, err := g.store.ReleaseTargets.Items()
	if err != nil {
		return nil, err
	}
	var result []oapi.ReleaseTarget
	for _, rt := range allTargets {
		if rt.DeploymentId == deploymentID && rt.EnvironmentId == environmentID {
			result = append(result, *rt)
		}
	}
	return result, nil
}

func (g *StoreGetters) GetSystemIDsForEnvironment(environmentID string) []string {
	return g.store.SystemEnvironments.GetSystemIDsForEnvironment(environmentID)
}

func (g *StoreGetters) GetReleaseTargetsForDeployment(
	_ context.Context,
	deploymentID string,
) ([]*oapi.ReleaseTarget, error) {
	allTargets, err := g.store.ReleaseTargets.Items()
	if err != nil {
		return nil, err
	}
	var result []*oapi.ReleaseTarget
	for _, rt := range allTargets {
		if rt.DeploymentId == deploymentID {
			result = append(result, rt)
		}
	}
	return result, nil
}

func (g *StoreGetters) GetJobsForReleaseTarget(
	_ context.Context,
	releaseTarget *oapi.ReleaseTarget,
) map[string]*oapi.Job {
	return g.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
}

func (g *StoreGetters) GetAllPolicies(
	_ context.Context,
	_ string,
) (map[string]*oapi.Policy, error) {
	return g.store.Policies.Items(), nil
}

func (g *StoreGetters) GetReleaseByJobID(_ context.Context, jobID string) (*oapi.Release, error) {
	for _, release := range g.store.Releases.Items() {
		jobs := g.store.Jobs.GetJobsForReleaseTarget(&release.ReleaseTarget)
		if _, ok := jobs[jobID]; ok {
			return release, nil
		}
	}
	return nil, fmt.Errorf("release not found for job %s", jobID)
}
