package db

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
)

func TestToOapiEnvironment(t *testing.T) {
	wsID := uuid.New()
	envID := uuid.New()
	now := time.Now().Truncate(time.Microsecond)

	row := Environment{
		ID:          envID,
		Name:        "production",
		WorkspaceID: wsID,
		Metadata:    map[string]string{"tier": "prod"},
		Description: pgtype.Text{String: "Production environment", Valid: true},
		CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
	}

	env := ToOapiEnvironment(row)

	assert.Equal(t, envID.String(), env.Id)
	assert.Equal(t, "production", env.Name)
	assert.Equal(t, wsID.String(), env.WorkspaceId, "WorkspaceId must be populated from the row")
	assert.Equal(t, map[string]string{"tier": "prod"}, env.Metadata)
	assert.NotNil(t, env.Description)
	assert.Equal(t, "Production environment", *env.Description)
	assert.Equal(t, now, env.CreatedAt)
}

func TestToOapiEnvironment_NilOptionalFields(t *testing.T) {
	wsID := uuid.New()
	envID := uuid.New()

	row := Environment{
		ID:          envID,
		Name:        "staging",
		WorkspaceID: wsID,
		Metadata:    map[string]string{},
	}

	env := ToOapiEnvironment(row)

	assert.Equal(t, envID.String(), env.Id)
	assert.Equal(t, wsID.String(), env.WorkspaceId)
	assert.Nil(t, env.Description)
	assert.True(t, env.CreatedAt.IsZero())
}

func TestToOapiDeployment(t *testing.T) {
	depID := uuid.New()
	agentID := uuid.New()

	row := Deployment{
		ID:             depID,
		Name:           "api-server",
		Description:    "Main API deployment",
		JobAgentID:     agentID,
		JobAgentConfig: map[string]any{"image": "api:latest"},
		Metadata:       map[string]string{"team": "platform"},
	}

	dep := ToOapiDeployment(row)

	assert.Equal(t, depID.String(), dep.Id)
	assert.Equal(t, "api-server", dep.Name)
	assert.NotNil(t, dep.Description)
	assert.Equal(t, "Main API deployment", *dep.Description)
	assert.NotNil(t, dep.JobAgentId)
	assert.Equal(t, agentID.String(), *dep.JobAgentId)
	assert.Equal(t, map[string]string{"team": "platform"}, dep.Metadata)
}

func TestToOapiDeployment_NilOptionalFields(t *testing.T) {
	depID := uuid.New()

	row := Deployment{
		ID:             depID,
		Name:           "worker",
		JobAgentConfig: map[string]any{},
		Metadata:       map[string]string{},
	}

	dep := ToOapiDeployment(row)

	assert.Equal(t, depID.String(), dep.Id)
	assert.Nil(t, dep.Description, "empty description should not be set")
	assert.Nil(t, dep.JobAgentId, "nil UUID agent should not be set")
}
