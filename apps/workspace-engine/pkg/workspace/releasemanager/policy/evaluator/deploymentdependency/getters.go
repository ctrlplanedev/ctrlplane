package deploymentdependency

import (
	"context"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
)

type Getters interface {
	GetDeployments() map[string]*oapi.Deployment
	GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget
	GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) GetDeployments() map[string]*oapi.Deployment {
	return s.store.Deployments.Items()
}

func (s *storeGetters) GetReleaseTargetsForResource(ctx context.Context, resourceID string) []*oapi.ReleaseTarget {
	return s.store.ReleaseTargets.GetForResource(ctx, resourceID)
}

func (s *storeGetters) GetLatestCompletedJobForReleaseTarget(releaseTarget *oapi.ReleaseTarget) *oapi.Job {
	return s.store.Jobs.GetLatestCompletedJobForReleaseTarget(releaseTarget)
}

var _ Getters = (*postgresGetters)(nil)

type postgresGetters struct {
	queries *db.Queries
	workspaceID string
}

func NewPostgresGetters(wsID string, queries *db.Queries) *postgresGetters {
	return &postgresGetters{workspaceID: wsID, queries: queries}
}

func (g *postgresGetters) GetDeployments() (map[string]*oapi.Deployment, error) {
	deployments, err := g.queries.ListDeploymentsByWorkspaceID(context.Background(), db.ListDeploymentsByWorkspaceIDParams{
		WorkspaceID: uuid.MustParse(g.workspaceID),
	})
	if err != nil {
		return make(map[string]*oapi.Deployment), err
	}
	deploymentsOAPI := make(map[string]*oapi.Deployment, len(deployments))
	for _, deployment := range deployments {
		deploymentsOAPI[deployment.ID.String()] = db.ToOapiDeployment(deployment)
	}
	return deploymentsOAPI, nil
}
