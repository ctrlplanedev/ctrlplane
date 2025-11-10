package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type ReleaseVerifications struct {
	repo  *repository.InMemoryStore
	store *Store
}

func NewReleaseVerifications(store *Store) *ReleaseVerifications {
	return &ReleaseVerifications{
		repo:  store.repo,
		store: store,
	}
}

func (r *ReleaseVerifications) Upsert(ctx context.Context, verification *oapi.ReleaseVerification) {
	r.repo.ReleaseVerifications.Set(verification.Id, verification)
	r.store.changeset.RecordUpsert(verification)
}

func (r *ReleaseVerifications) Get(id string) (*oapi.ReleaseVerification, bool) {
	return r.repo.ReleaseVerifications.Get(id)
}

func (r *ReleaseVerifications) Items() map[string]*oapi.ReleaseVerification {
	return r.repo.ReleaseVerifications.Items()
}

func (r *ReleaseVerifications) GetByReleaseId(releaseId string) (*oapi.ReleaseVerification, bool) {
	for _, verification := range r.repo.ReleaseVerifications.Items() {
		if verification.ReleaseId == releaseId {
			return verification, true
		}
	}
	return nil, false
}

// GetMostRecentVerificationForRelease returns the most recent verification for a release
// based on CreatedAt timestamp. Returns nil if no verifications exist for the release.
func (r *ReleaseVerifications) GetMostRecentVerificationForRelease(releaseId string) *oapi.ReleaseVerification {
	var mostRecent *oapi.ReleaseVerification

	for _, verification := range r.repo.ReleaseVerifications.Items() {
		if verification.ReleaseId != releaseId {
			continue
		}

		if mostRecent == nil || verification.CreatedAt.After(mostRecent.CreatedAt) {
			mostRecent = verification
		}
	}

	return mostRecent
}
