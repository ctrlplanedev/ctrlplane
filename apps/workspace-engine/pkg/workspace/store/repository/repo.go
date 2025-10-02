package repository

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
)

func New() *Repository {
	return &Repository{
		Resources:          cmap.New[*pb.Resource](),
		Deployments:        cmap.New[*pb.Deployment](),
		Environments:       cmap.New[*pb.Environment](),
		Policies:           cmap.New[*pb.Policy](),
		DeploymentVersions: cmap.New[*pb.DeploymentVersion](),
		Systems:            cmap.New[*pb.System](),
	}
}

type Repository struct {
	Resources          cmap.ConcurrentMap[string, *pb.Resource]
	Deployments        cmap.ConcurrentMap[string, *pb.Deployment]
	Environments       cmap.ConcurrentMap[string, *pb.Environment]
	Policies           cmap.ConcurrentMap[string, *pb.Policy]
	DeploymentVersions cmap.ConcurrentMap[string, *pb.DeploymentVersion]
	Systems            cmap.ConcurrentMap[string, *pb.System]
}