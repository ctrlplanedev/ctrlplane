package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewReleases(store *Store) *Releases {
	return &Releases{
		repo:  store.repo.Releases(),
		store: store,
	}
}

type Releases struct {
	repo  repository.ReleaseRepo
	store *Store
}

// SetRepo replaces the underlying ReleaseRepo implementation.
func (r *Releases) SetRepo(repo repository.ReleaseRepo) {
	r.repo = repo
}

func (r *Releases) Upsert(ctx context.Context, release *oapi.Release) error {
	if err := r.repo.Set(release); err != nil {
		return err
	}
	r.store.changeset.RecordUpsert(release)
	return nil
}

func (r *Releases) Get(id string) (*oapi.Release, bool) {
	return r.repo.Get(id)
}

func (r *Releases) GetByReleaseTargetKey(key string) ([]*oapi.Release, error) {
	return r.repo.GetByReleaseTargetKey(key)
}

func (r *Releases) Items() map[string]*oapi.Release {
	return r.repo.Items()
}

func (r *Releases) Remove(ctx context.Context, id string) {
	release, ok := r.repo.Get(id)
	if !ok || release == nil {
		return
	}

	r.repo.Remove(id)
	r.store.changeset.RecordDelete(release)
}

func (r *Releases) Jobs(releaseId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	jobItems, err := r.store.repo.Jobs.GetBy("release_id", releaseId)
	if err != nil {
		return jobs
	}
	for _, job := range jobItems {
		jobs[job.Id] = job
	}
	return jobs
}
