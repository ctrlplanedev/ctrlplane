package hybrid

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

type ReleaseRepo struct {
	dbRepo      *db.DBRepo
	memReleases repository.ReleaseRepo
}

func NewReleaseRepo(dbRepo *db.DBRepo, inMemoryRepo *memory.InMemory) *ReleaseRepo {
	return &ReleaseRepo{
		dbRepo:      dbRepo,
		memReleases: inMemoryRepo.Releases(),
	}
}

func (r *ReleaseRepo) Get(id string) (*oapi.Release, bool) {
	return r.memReleases.Get(id)
}

func (r *ReleaseRepo) Set(entity *oapi.Release) error {
	if err := r.memReleases.Set(entity); err != nil {
		return err
	}
	return r.dbRepo.Releases().Set(entity)
}

func (r *ReleaseRepo) Remove(id string) error {
	if err := r.memReleases.Remove(id); err != nil {
		return err
	}
	return r.dbRepo.Releases().Remove(id)
}

func (r *ReleaseRepo) Items() map[string]*oapi.Release {
	return r.memReleases.Items()
}

func (r *ReleaseRepo) GetByReleaseTargetKey(key string) ([]*oapi.Release, error) {
	return r.memReleases.GetByReleaseTargetKey(key)
}
