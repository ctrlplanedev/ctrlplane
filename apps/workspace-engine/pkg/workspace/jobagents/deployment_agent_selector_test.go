package jobagents

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/statechange"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ===== Test Helpers =====

func newTestStore() *store.Store {
	cs := statechange.NewChangeSet[any]()
	return store.New("test-workspace", cs)
}

func makeJobAgent(id, name, agentType string) *oapi.JobAgent {
	cfg := oapi.JobAgentConfig{}
	_ = json.Unmarshal([]byte(`{"type":"custom"}`), &cfg)
	return &oapi.JobAgent{
		Id:          id,
		WorkspaceId: "test-workspace",
		Name:        name,
		Type:        agentType,
		Config:      cfg,
	}
}

func makeDeployment(id, name string, jobAgentId *string, jobAgents *[]oapi.DeploymentJobAgent) *oapi.Deployment {
	sel := &oapi.Selector{}
	_ = sel.FromCelSelector(oapi.CelSelector{Cel: "true"})
	return &oapi.Deployment{
		Id:               id,
		Name:             name,
		Slug:             name,
		ResourceSelector: sel,
		JobAgentId:       jobAgentId,
		JobAgentConfig:   oapi.JobAgentConfig{},
		JobAgents:        jobAgents,
		Metadata:         map[string]string{},
	}
}

func makeEnvironment(id, name string) *oapi.Environment {
	sel := &oapi.Selector{}
	_ = sel.FromCelSelector(oapi.CelSelector{Cel: "true"})
	return &oapi.Environment{
		Id:               id,
		Name:             name,
		ResourceSelector: sel,
		Metadata:         map[string]string{},
	}
}

func makeResource(id, name string, metadata map[string]string) *oapi.Resource {
	return &oapi.Resource{
		Id:          id,
		Name:        name,
		Kind:        "Kubernetes",
		Identifier:  name,
		CreatedAt:   time.Now(),
		Config:      map[string]any{},
		Metadata:    metadata,
		WorkspaceId: "test-workspace",
	}
}

func makeRelease(deploymentId, environmentId, resourceId string) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  deploymentId,
			EnvironmentId: environmentId,
			ResourceId:    resourceId,
		},
		Version: oapi.DeploymentVersion{
			Id:  uuid.New().String(),
			Tag: "v1.0.0",
		},
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}

func strPtr(s string) *string { return &s }

// ===== Group 1: Legacy single-agent path =====

func TestSelectAgents_Legacy_AgentExists(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	agent := makeJobAgent(agentID, "legacy-agent", "runner")
	s.JobAgents.Upsert(ctx, agent)

	deployment := makeDeployment(uuid.New().String(), "deploy", strPtr(agentID), nil)
	release := makeRelease(deployment.Id, uuid.New().String(), uuid.New().String())

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, agentID, agents[0].Id)
	assert.Equal(t, "legacy-agent", agents[0].Name)
}

func TestSelectAgents_Legacy_AgentNotFound(t *testing.T) {
	s := newTestStore()

	missingID := uuid.New().String()
	deployment := makeDeployment(uuid.New().String(), "deploy", strPtr(missingID), nil)
	release := makeRelease(deployment.Id, uuid.New().String(), uuid.New().String())

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.Error(t, err)
	assert.Nil(t, agents)
	assert.Contains(t, err.Error(), "not found")
}

// ===== Group 2: No agent configured =====

func TestSelectAgents_NoAgent_NilJobAgentId_NilJobAgents(t *testing.T) {
	s := newTestStore()

	deployment := makeDeployment(uuid.New().String(), "deploy", nil, nil)
	release := makeRelease(deployment.Id, uuid.New().String(), uuid.New().String())

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	assert.Empty(t, agents)
}

func TestSelectAgents_NoAgent_NilJobAgentId_EmptyJobAgents(t *testing.T) {
	s := newTestStore()

	empty := &[]oapi.DeploymentJobAgent{}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, empty)
	release := makeRelease(deployment.Id, uuid.New().String(), uuid.New().String())

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	assert.Empty(t, agents)
}

func TestSelectAgents_NoAgent_EmptyStringJobAgentId_NilJobAgents(t *testing.T) {
	s := newTestStore()

	deployment := makeDeployment(uuid.New().String(), "deploy", strPtr(""), nil)
	release := makeRelease(deployment.Id, uuid.New().String(), uuid.New().String())

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	assert.Empty(t, agents)
}

// ===== Group 3: Multi-agent path -- basic selection (no if conditions) =====

func TestSelectAgents_MultiAgent_SingleNoIf(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{{Ref: agentID, Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, agentID, agents[0].Id)
}

func TestSelectAgents_MultiAgent_MultipleNoIf_PreservesOrder(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	ids := []string{uuid.New().String(), uuid.New().String(), uuid.New().String()}
	names := []string{"agent-a", "agent-b", "agent-c"}
	envID := uuid.New().String()
	resID := uuid.New().String()

	for i, id := range ids {
		s.JobAgents.Upsert(ctx, makeJobAgent(id, names[i], "runner"))
	}
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: ids[0], Config: oapi.JobAgentConfig{}},
		{Ref: ids[1], Config: oapi.JobAgentConfig{}},
		{Ref: ids[2], Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 3)
	for i, agent := range agents {
		assert.Equal(t, ids[i], agent.Id)
		assert.Equal(t, names[i], agent.Name)
	}
}

func TestSelectAgents_MultiAgent_RefNotFound(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	envID := uuid.New().String()
	resID := uuid.New().String()

	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	missingRef := uuid.New().String()
	ja := []oapi.DeploymentJobAgent{{Ref: missingRef, Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.Error(t, err)
	assert.Nil(t, agents)
	assert.Contains(t, err.Error(), "not found")
}

// ===== Group 4: Multi-agent path -- CEL if conditions =====

func TestSelectAgents_CEL_TrueLiteral(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{{Ref: agentID, If: "true", Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, agentID, agents[0].Id)
}

func TestSelectAgents_CEL_FalseLiteral(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{{Ref: agentID, If: "false", Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	selector := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := selector.SelectAgents()

	require.NoError(t, err)
	assert.Empty(t, agents)
}

func TestSelectAgents_CEL_MixedConditions(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentA := uuid.New().String()
	agentB := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentA, "agent-a", "runner"))
	s.JobAgents.Upsert(ctx, makeJobAgent(agentB, "agent-b", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	tests := []struct {
		name        string
		ifA         string
		ifB         string
		expectIDs   []string
		expectCount int
	}{
		{
			name:        "first true second false",
			ifA:         "true",
			ifB:         "false",
			expectIDs:   []string{agentA},
			expectCount: 1,
		},
		{
			name:        "first false second true",
			ifA:         "false",
			ifB:         "true",
			expectIDs:   []string{agentB},
			expectCount: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ja := []oapi.DeploymentJobAgent{
				{Ref: agentA, If: tt.ifA, Config: oapi.JobAgentConfig{}},
				{Ref: agentB, If: tt.ifB, Config: oapi.JobAgentConfig{}},
			}
			deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
			release := makeRelease(deployment.Id, envID, resID)

			sel := NewDeploymentAgentsSelector(s, deployment, release)
			agents, err := sel.SelectAgents()

			require.NoError(t, err)
			require.Len(t, agents, tt.expectCount)
			for i, id := range tt.expectIDs {
				assert.Equal(t, id, agents[i].Id)
			}
		})
	}
}

func TestSelectAgents_CEL_AllTrue(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	ids := []string{uuid.New().String(), uuid.New().String(), uuid.New().String()}
	envID := uuid.New().String()
	resID := uuid.New().String()

	for i, id := range ids {
		s.JobAgents.Upsert(ctx, makeJobAgent(id, fmt.Sprintf("agent-%d", i), "runner"))
	}
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: ids[0], If: "true", Config: oapi.JobAgentConfig{}},
		{Ref: ids[1], If: "true", Config: oapi.JobAgentConfig{}},
		{Ref: ids[2], If: "true", Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 3)
	for i, agent := range agents {
		assert.Equal(t, ids[i], agent.Id)
	}
}

func TestSelectAgents_CEL_AllFalse(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	ids := []string{uuid.New().String(), uuid.New().String(), uuid.New().String()}
	envID := uuid.New().String()
	resID := uuid.New().String()

	for i, id := range ids {
		s.JobAgents.Upsert(ctx, makeJobAgent(id, fmt.Sprintf("agent-%d", i), "runner"))
	}
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: ids[0], If: "false", Config: oapi.JobAgentConfig{}},
		{Ref: ids[1], If: "false", Config: oapi.JobAgentConfig{}},
		{Ref: ids[2], If: "false", Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	assert.Empty(t, agents)
}

func TestSelectAgents_CEL_ResourceMetadataMatch(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{"region": "us-east-1"}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: agentID, If: `resource.metadata.region == "us-east-1"`, Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, agentID, agents[0].Id)
}

func TestSelectAgents_CEL_ResourceMetadataNoMatch(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{"region": "eu-west-1"}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: agentID, If: `resource.metadata.region == "us-east-1"`, Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	assert.Empty(t, agents)
}

func TestSelectAgents_CEL_EnvironmentNameMatch(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "production"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: agentID, If: `environment.name == "production"`, Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, agentID, agents[0].Id)
}

func TestSelectAgents_CEL_DeploymentNameMatch(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: agentID, If: `deployment.name == "my-deploy"`, Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "my-deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, agentID, agents[0].Id)
}

// ===== Group 5: CEL context + error cases =====

func TestSelectAgents_CEL_EnvironmentNotInStore(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	missingEnvID := uuid.New().String()
	ja := []oapi.DeploymentJobAgent{{Ref: agentID, If: "true", Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, missingEnvID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.Error(t, err)
	assert.Nil(t, agents)
	assert.Contains(t, err.Error(), "environment")
	assert.Contains(t, err.Error(), "not found")
}

func TestSelectAgents_CEL_ResourceNotInStore(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))

	missingResID := uuid.New().String()
	ja := []oapi.DeploymentJobAgent{{Ref: agentID, If: "true", Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, missingResID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.Error(t, err)
	assert.Nil(t, agents)
	assert.Contains(t, err.Error(), "resource")
	assert.Contains(t, err.Error(), "not found")
}

func TestSelectAgents_CEL_InvalidSyntax(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentID, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{{Ref: agentID, If: "!@#$", Config: oapi.JobAgentConfig{}}}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.Error(t, err)
	assert.Nil(t, agents)
	assert.Contains(t, err.Error(), "failed to compile")
}

func TestSelectAgents_CEL_FirstPassesSecondBadRef(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	agentA := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(agentA, "agent-a", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	missingRef := uuid.New().String()
	ja := []oapi.DeploymentJobAgent{
		{Ref: agentA, If: "true", Config: oapi.JobAgentConfig{}},
		{Ref: missingRef, If: "true", Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", nil, &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.Error(t, err)
	assert.Nil(t, agents)
	assert.Contains(t, err.Error(), "not found")
}

// ===== Group 6: Priority / precedence =====

func TestSelectAgents_LegacyTakesPrecedenceOverJobAgents(t *testing.T) {
	s := newTestStore()
	ctx := context.Background()

	legacyAgentID := uuid.New().String()
	newAgentID := uuid.New().String()
	envID := uuid.New().String()
	resID := uuid.New().String()

	s.JobAgents.Upsert(ctx, makeJobAgent(legacyAgentID, "legacy-agent", "runner"))
	s.JobAgents.Upsert(ctx, makeJobAgent(newAgentID, "new-agent", "runner"))
	_ = s.Environments.Upsert(ctx, makeEnvironment(envID, "staging"))
	_, _ = s.Resources.Upsert(ctx, makeResource(resID, "res-1", map[string]string{}))

	ja := []oapi.DeploymentJobAgent{
		{Ref: newAgentID, Config: oapi.JobAgentConfig{}},
	}
	deployment := makeDeployment(uuid.New().String(), "deploy", strPtr(legacyAgentID), &ja)
	release := makeRelease(deployment.Id, envID, resID)

	sel := NewDeploymentAgentsSelector(s, deployment, release)
	agents, err := sel.SelectAgents()

	require.NoError(t, err)
	require.Len(t, agents, 1)
	assert.Equal(t, legacyAgentID, agents[0].Id)
	assert.Equal(t, "legacy-agent", agents[0].Name)
}
