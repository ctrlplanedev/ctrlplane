package workspace

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/store"
)

func New() *Workspace {
	s := store.New()
	rm := releasemanager.New(s)
	ws := &Workspace{
		store:          s,
		releasemanager: rm,
	}
	return ws
}

type Workspace struct {
	ID string

	store          *store.Store
	releasemanager *releasemanager.Manager
}

func (w *Workspace) DeploymentVersions() *store.DeploymentVersions {
	return w.store.DeploymentVersions
}

func (w *Workspace) Environments() *store.Environments {
	return w.store.Environments
}

func (w *Workspace) Deployments() *store.Deployments {
	return w.store.Deployments
}

func (w *Workspace) Resources() *store.Resources {
	return w.store.Resources
}

func (w *Workspace) ReleaseTargets() *store.ReleaseTargets {
	return w.store.ReleaseTargets
}

func (w *Workspace) GetDeploymentAndEnvironmentReleaseTargets(
	ctx context.Context,
	deployment *pb.Deployment,
	environment *pb.Environment,
) ([]*pb.ReleaseTarget, error) {
	environmentResources := w.Environments().Resources(environment.Id)

	releaseTargets := make([]*pb.ReleaseTarget, len(environmentResources))
	for _, resource := range environmentResources {
		isInDeployment := w.Deployments().HasResource(deployment.Id, resource.Id)
		if isInDeployment {
			releaseTargets = append(releaseTargets, &pb.ReleaseTarget{
				DeploymentId:  deployment.Id,
				EnvironmentId: environment.Id,
				ResourceId:    resource.Id,
			})
		}
	}

	return releaseTargets, nil
}

var workspaces = cmap.New[*Workspace]()

func GetWorkspace(id string) *Workspace {
	workspace, _ := workspaces.Get(id)
	if workspace == nil {
		workspace = New()
		workspaces.Set(id, workspace)
	}
	return workspace
}
