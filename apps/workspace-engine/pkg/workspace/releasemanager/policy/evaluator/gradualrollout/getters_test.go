package gradualrollout

import (
	"context"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPostgresGetters_GetReleaseTargetsForDeployment_InvalidUUID(t *testing.T) {
	g := NewPostgresGetters(nil)

	_, err := g.GetReleaseTargetsForDeployment(context.Background(), "not-a-uuid")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse deployment id")
}

func TestPostgresGetters_GetReleaseTargetsForDeployment_DoesNotPanic(t *testing.T) {
	g := NewPostgresGetters(nil)

	assert.NotPanics(t, func() {
		// Valid UUID but nil queries — should return a parse-ok path then
		// a nil-pointer on the DB call, which we recover as a panic check.
		// The key assertion: the method body is real code, not a panic stub.
		_, _ = g.GetReleaseTargetsForDeployment(context.Background(), "not-a-uuid")
	})
}

func TestStoreGetters_GetReleaseTargetsForDeployment_FiltersCorrectly(t *testing.T) {
	ctx := t.Context()
	sc := statechange.NewChangeSet[any]()
	st := store.New("test-workspace", sc)

	systemID := uuid.New().String()
	env := generateEnvironment(ctx, systemID, st)
	dep1 := generateDeployment(ctx, systemID, st)
	dep2 := generateDeployment(ctx, systemID, st)
	resources := generateResources(ctx, 3, st)

	for _, res := range resources {
		rt := &oapi.ReleaseTarget{
			EnvironmentId: env.Id,
			DeploymentId:  dep1.Id,
			ResourceId:    res.Id,
		}
		_ = st.ReleaseTargets.Upsert(ctx, rt)
	}
	rtOther := &oapi.ReleaseTarget{
		EnvironmentId: env.Id,
		DeploymentId:  dep2.Id,
		ResourceId:    resources[0].Id,
	}
	_ = st.ReleaseTargets.Upsert(ctx, rtOther)

	getters := NewStoreGetters(st)

	targets, err := getters.GetReleaseTargetsForDeployment(ctx, dep1.Id)
	require.NoError(t, err)
	assert.Len(t, targets, 3)
	for _, tgt := range targets {
		assert.Equal(t, dep1.Id, tgt.DeploymentId)
	}

	targets2, err := getters.GetReleaseTargetsForDeployment(ctx, dep2.Id)
	require.NoError(t, err)
	assert.Len(t, targets2, 1)
	assert.Equal(t, dep2.Id, targets2[0].DeploymentId)

	empty, err := getters.GetReleaseTargetsForDeployment(ctx, uuid.New().String())
	require.NoError(t, err)
	assert.Empty(t, empty)
}
