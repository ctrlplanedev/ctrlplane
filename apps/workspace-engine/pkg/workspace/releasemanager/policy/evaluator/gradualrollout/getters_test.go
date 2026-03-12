package gradualrollout

import (
	"context"
	"testing"

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
		_, _ = g.GetReleaseTargetsForDeployment(context.Background(), "not-a-uuid")
	})
}
