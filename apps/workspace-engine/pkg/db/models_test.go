package db

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDeploymentVersionStatus_Scan(t *testing.T) {
	t.Run("scan from bytes", func(t *testing.T) {
		var s DeploymentVersionStatus
		err := s.Scan([]byte("ready"))
		require.NoError(t, err)
		assert.Equal(t, DeploymentVersionStatusReady, s)
	})

	t.Run("scan from string", func(t *testing.T) {
		var s DeploymentVersionStatus
		err := s.Scan("building")
		require.NoError(t, err)
		assert.Equal(t, DeploymentVersionStatusBuilding, s)
	})

	t.Run("scan from unsupported type", func(t *testing.T) {
		var s DeploymentVersionStatus
		err := s.Scan(123)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "unsupported")
	})
}

func TestNullDeploymentVersionStatus_Scan(t *testing.T) {
	t.Run("scan nil", func(t *testing.T) {
		var ns NullDeploymentVersionStatus
		err := ns.Scan(nil)
		require.NoError(t, err)
		assert.False(t, ns.Valid)
	})

	t.Run("scan valid string", func(t *testing.T) {
		var ns NullDeploymentVersionStatus
		err := ns.Scan("failed")
		require.NoError(t, err)
		assert.True(t, ns.Valid)
		assert.Equal(t, DeploymentVersionStatusFailed, ns.DeploymentVersionStatus)
	})
}

func TestNullDeploymentVersionStatus_Value(t *testing.T) {
	t.Run("invalid returns nil", func(t *testing.T) {
		ns := NullDeploymentVersionStatus{Valid: false}
		val, err := ns.Value()
		require.NoError(t, err)
		assert.Nil(t, val)
	})

	t.Run("valid returns string", func(t *testing.T) {
		ns := NullDeploymentVersionStatus{
			DeploymentVersionStatus: DeploymentVersionStatusReady,
			Valid:                   true,
		}
		val, err := ns.Value()
		require.NoError(t, err)
		assert.Equal(t, "ready", val)
	})
}
