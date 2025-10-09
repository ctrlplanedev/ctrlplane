package store

import (
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewResourceVariables(store *Store) *ResourceVariables {
	return &ResourceVariables{
		repo: store.repo,
	}
}

type ResourceVariables struct {
	repo *repository.Repository
}

func (r *ResourceVariables) IterBuffered() <-chan cmap.Tuple[string, *pb.ResourceVariable] {
	return r.repo.ResourceVariables.IterBuffered()
}

func (r *ResourceVariables) Upsert(resourceVariable *pb.ResourceVariable) {
	r.repo.ResourceVariables.Set(resourceVariable.ID(), resourceVariable)
}

func (r *ResourceVariables) Get(resourceId string, key string) (*pb.ResourceVariable, bool) {
	return r.repo.ResourceVariables.Get(resourceId + "-" + key)
}

func (r *ResourceVariables) Remove(resourceId string, key string) {
	r.repo.ResourceVariables.Remove(resourceId + "-" + key)
}
