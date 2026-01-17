package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type ReleaseRollbacks struct {
	repo  *repository.InMemoryStore
	store *Store
}

func NewReleaseRollbacks(store *Store) *ReleaseRollbacks {
	return &ReleaseRollbacks{
		repo:  store.repo,
		store: store,
	}
}

func (r *ReleaseRollbacks) Items() map[string]*oapi.ReleaseRollback {
	return r.repo.ReleaseRollbacks.Items()
}

func (r *ReleaseRollbacks) Get(releaseId string) (*oapi.ReleaseRollback, bool) {
	return r.repo.ReleaseRollbacks.Get(releaseId)
}

func (r *ReleaseRollbacks) Upsert(ctx context.Context, releaseRollback *oapi.ReleaseRollback) error {
	if releaseRollback.RolledBackAt.IsZero() {
		releaseRollback.RolledBackAt = time.Now()
	}

	r.repo.ReleaseRollbacks.Set(releaseRollback.ReleaseId, releaseRollback)
	r.store.changeset.RecordUpsert(releaseRollback)
	return nil
}

func (r *ReleaseRollbacks) Remove(ctx context.Context, releaseId string) error {
	releaseRollback, ok := r.repo.ReleaseRollbacks.Get(releaseId)
	if !ok || releaseRollback == nil {
		return nil
	}

	r.repo.ReleaseRollbacks.Remove(releaseId)
	r.store.changeset.RecordDelete(releaseRollback)
	return nil
}
