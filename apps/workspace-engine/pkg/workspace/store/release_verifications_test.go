package store_test

import (
	"context"
	"testing"
	"time"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetMostRecentVerificationForRelease(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	releaseId := uuid.New().String()

	// Create multiple verifications with different timestamps
	oldTime := time.Now().Add(-2 * time.Hour)
	middleTime := time.Now().Add(-1 * time.Hour)
	newestTime := time.Now()

	oldVerification := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: releaseId,
		CreatedAt: oldTime,
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	middleVerification := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: releaseId,
		CreatedAt: middleTime,
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	newestVerification := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: releaseId,
		CreatedAt: newestTime,
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	// Insert in random order
	s.ReleaseVerifications.Upsert(ctx, middleVerification)
	s.ReleaseVerifications.Upsert(ctx, newestVerification)
	s.ReleaseVerifications.Upsert(ctx, oldVerification)

	// Get most recent verification
	result := s.ReleaseVerifications.GetMostRecentVerificationForRelease(releaseId)

	require.NotNil(t, result)
	assert.Equal(t, newestVerification.Id, result.Id)
	assert.Equal(t, newestTime.Unix(), result.CreatedAt.Unix())
}

func TestGetMostRecentVerificationForRelease_NoVerifications(t *testing.T) {
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	releaseId := uuid.New().String()

	// Get most recent verification when none exist
	result := s.ReleaseVerifications.GetMostRecentVerificationForRelease(releaseId)

	assert.Nil(t, result)
}

func TestGetMostRecentVerificationForRelease_MultipleReleases(t *testing.T) {
	ctx := context.Background()
	wsId := uuid.New().String()
	changeset := statechange.NewChangeSet[any]()
	s := store.New(wsId, changeset)

	release1Id := uuid.New().String()
	release2Id := uuid.New().String()

	oldTime := time.Now().Add(-2 * time.Hour)
	newestTime := time.Now()

	// Create verification for release1 (old)
	verification1 := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: release1Id,
		CreatedAt: oldTime,
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	// Create verification for release2 (newest, but for different release)
	verification2 := &oapi.ReleaseVerification{
		Id:        uuid.New().String(),
		ReleaseId: release2Id,
		CreatedAt: newestTime,
		Metrics:   []oapi.VerificationMetricStatus{},
	}

	s.ReleaseVerifications.Upsert(ctx, verification1)
	s.ReleaseVerifications.Upsert(ctx, verification2)

	// Get most recent verification for release1
	result := s.ReleaseVerifications.GetMostRecentVerificationForRelease(release1Id)

	require.NotNil(t, result)
	assert.Equal(t, verification1.Id, result.Id)
	assert.Equal(t, release1Id, result.ReleaseId)
}
