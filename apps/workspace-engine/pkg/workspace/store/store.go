package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
)

func New() *Store {
	store := &Store{
		resources:          cmap.New[*pb.Resource](),
		deployments:        cmap.New[*pb.Deployment](),
		environments:       cmap.New[*pb.Environment](),
		policies:           cmap.New[*pb.Policy](),
		deploymentVersions: cmap.New[*pb.DeploymentVersion](),
		systems:            cmap.New[*pb.System](),
	}

	store.Deployments = &Deployments{
		store:     store,
		resources: cmap.New[map[string]*pb.Resource](),
	}
	store.Environments = &Environments{
		store:     store,
		resources: cmap.New[map[string]*pb.Resource](),
	}
	store.Resources = &Resources{store: store}
	store.Policies = &Policies{store: store}
	store.ReleaseTargets = &ReleaseTargets{store: store}
	store.DeploymentVersions = &DeploymentVersions{
		store:              store,
		deployableVersions: cmap.New[*pb.DeploymentVersion](),
	}
	store.Systems = &Systems{store: store}

	return store
}

type Store struct {
	resources          cmap.ConcurrentMap[string, *pb.Resource]
	deployments        cmap.ConcurrentMap[string, *pb.Deployment]
	environments       cmap.ConcurrentMap[string, *pb.Environment]
	policies           cmap.ConcurrentMap[string, *pb.Policy]
	deploymentVersions cmap.ConcurrentMap[string, *pb.DeploymentVersion]
	systems            cmap.ConcurrentMap[string, *pb.System]

	Policies           *Policies
	Resources          *Resources
	Deployments        *Deployments
	Environments       *Environments
	ReleaseTargets     *ReleaseTargets
	DeploymentVersions *DeploymentVersions
	Systems            *Systems
}
