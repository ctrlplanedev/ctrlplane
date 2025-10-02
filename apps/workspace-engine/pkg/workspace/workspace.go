package workspace

import (
	"context"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
)

type ReleaseTargets struct {
	ws *Workspace
}

func New() *Workspace {
	ws := &Workspace{
		resources:    cmap.New[*pb.Resource](),
		deployments:  cmap.New[*pb.Deployment](),
		environments: cmap.New[*pb.Environment](),
	}

	ws.Resources = &Resources{ws: ws}
	ws.Deployments = &Deployments{
		ws:        ws,
		resources: cmap.New[map[string]*pb.Resource](),
	}
	ws.Environments = &Environments{
		ws:        ws,
		resources: cmap.New[map[string]*pb.Resource](),
	}
	ws.ReleaseTargets = &ReleaseTargets{
		ws: ws,
	}

	return ws
}

type Workspace struct {
	ID string

	resources    cmap.ConcurrentMap[string, *pb.Resource]
	deployments  cmap.ConcurrentMap[string, *pb.Deployment]
	environments cmap.ConcurrentMap[string, *pb.Environment]

	Environments   *Environments
	Resources      *Resources
	Deployments    *Deployments
	ReleaseTargets *ReleaseTargets
}

func (w *Workspace) GetDeploymentAndEnvironmentReleaseTargets(
	ctx context.Context,
	deployment *pb.Deployment,
	environment *pb.Environment,
) ([]*pb.ReleaseTarget, error) {
	environmentResources := w.Environments.Resources(environment.Id)

	releaseTargets := make([]*pb.ReleaseTarget, len(environmentResources))
	for _, resource := range environmentResources {
		isInDeployment := w.Deployments.HasResources(deployment.Id, resource.Id)
		if isInDeployment && w.resources.Has(resource.Id){
			releaseTargets = append(releaseTargets, &pb.ReleaseTarget{
				DeploymentId:  deployment.Id,
				EnvironmentId: environment.Id,
				ResourceId:    resource.Id,

				Environment: environment,
				Deployment:  deployment,
			})
		}
	}

	return releaseTargets, nil
}

type Workspaces struct {
	cmap.ConcurrentMap[string, *Workspace]
}
