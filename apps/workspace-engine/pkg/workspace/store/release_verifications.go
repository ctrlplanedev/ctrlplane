package store

import (
	"context"
	"fmt"
	"sort"
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

func (r *ReleaseVerifications) Update(ctx context.Context, id string, cb func(valueInMap *oapi.ReleaseVerification) *oapi.ReleaseVerification) (*oapi.ReleaseVerification, error) {
	verification, ok := r.Get(id)
	if !ok {
		return nil, fmt.Errorf("verification not found: %s", id)
	}
	newVerification := r.repo.ReleaseVerifications.Upsert(
		verification.Id, nil,
		func(exist bool, valueInMap *oapi.ReleaseVerification, newValue *oapi.ReleaseVerification) *oapi.ReleaseVerification {
			clone := *valueInMap
			return cb(&clone)
		},
	)
	r.store.changeset.RecordUpsert(newVerification)
	return newVerification, nil
}

func (r *ReleaseVerifications) Get(id string) (*oapi.ReleaseVerification, bool) {
	return r.repo.ReleaseVerifications.Get(id)
}

func (r *ReleaseVerifications) Items() map[string]*oapi.ReleaseVerification {
	return r.repo.ReleaseVerifications.Items()
}

func (r *ReleaseVerifications) GetByReleaseId(releaseId string) (*oapi.ReleaseVerification, bool) {
	verifications := r.repo.ReleaseVerifications.Items()
	verificationsSlice := make([]*oapi.ReleaseVerification, 0, len(verifications))
	for _, verification := range verifications {
		if verification.ReleaseId == releaseId {
			verificationsSlice = append(verificationsSlice, verification)
		}
	}
	sort.Slice(verificationsSlice, func(i, j int) bool {
		return verificationsSlice[i].CreatedAt.After(verificationsSlice[j].CreatedAt)
	})

	for _, verification := range verificationsSlice {
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
