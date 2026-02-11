package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

func NewReleases(store *Store) *Releases {
	return &Releases{
		repo:  store.repo,
		store: store,
	}
}

type Releases struct {
	repo  *memory.InMemory
	store *Store
}

func (r *Releases) Upsert(ctx context.Context, release *oapi.Release) error {
	r.repo.Releases.Set(release)
	r.store.changeset.RecordUpsert(release)
	return nil
}

func (r *Releases) Get(id string) (*oapi.Release, bool) {
	return r.repo.Releases.Get(id)
}

func (r *Releases) Items() map[string]*oapi.Release {
	return r.repo.Releases.Items()
}

func (r *Releases) Remove(ctx context.Context, id string) {
	release, ok := r.repo.Releases.Get(id)
	if !ok || release == nil {
		return
	}

	r.repo.Releases.Remove(id)
	r.store.changeset.RecordDelete(release)
}

func (r *Releases) Jobs(releaseId string) map[string]*oapi.Job {
	jobs := make(map[string]*oapi.Job)
	jobItems, err := r.repo.Jobs.GetBy("release_id", releaseId)
	if err != nil {
		return jobs
	}
	for _, job := range jobItems {
		jobs[job.Id] = job
	}
	return jobs
}
