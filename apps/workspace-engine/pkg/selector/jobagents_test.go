package selector

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

func testAgent(name, agentType string, config oapi.JobAgentConfig) oapi.JobAgent {
	return oapi.JobAgent{
		Id:     uuid.New().String(),
		Name:   name,
		Type:   agentType,
		Config: config,
	}
}

func testResource(kind, identifier string, config map[string]any) *oapi.Resource {
	return &oapi.Resource{
		Id:         uuid.New().String(),
		Name:       identifier,
		Kind:       kind,
		Identifier: identifier,
		Config:     config,
		Metadata:   map[string]string{},
	}
}

func TestMatchJobAgentsWithResource_EmptySelector(t *testing.T) {
	agent := testAgent("a", "test", oapi.JobAgentConfig{})
	res := testResource("k8s", "cluster-1", map[string]any{})

	matched, err := MatchJobAgentsWithResource(context.Background(), "", []oapi.JobAgent{agent}, res)
	require.NoError(t, err)
	assert.Empty(t, matched)
}

func TestMatchJobAgentsWithResource_FalseSelector(t *testing.T) {
	agent := testAgent("a", "test", oapi.JobAgentConfig{})
	res := testResource("k8s", "cluster-1", map[string]any{})

	matched, err := MatchJobAgentsWithResource(context.Background(), "false", []oapi.JobAgent{agent}, res)
	require.NoError(t, err)
	assert.Empty(t, matched)
}

func TestMatchJobAgentsWithResource_TrueSelector(t *testing.T) {
	agents := []oapi.JobAgent{
		testAgent("a", "test", oapi.JobAgentConfig{}),
		testAgent("b", "test", oapi.JobAgentConfig{}),
	}
	res := testResource("k8s", "cluster-1", map[string]any{})

	matched, err := MatchJobAgentsWithResource(context.Background(), "true", agents, res)
	require.NoError(t, err)
	assert.Len(t, matched, 2)
}

func TestMatchJobAgentsWithResource_IDSelector(t *testing.T) {
	target := testAgent("target", "argo", oapi.JobAgentConfig{})
	other := testAgent("other", "github", oapi.JobAgentConfig{})
	res := testResource("k8s", "cluster-1", map[string]any{})

	sel := `jobAgent.id == "` + target.Id + `"`
	matched, err := MatchJobAgentsWithResource(context.Background(), sel, []oapi.JobAgent{target, other}, res)
	require.NoError(t, err)
	require.Len(t, matched, 1)
	assert.Equal(t, target.Id, matched[0].Id)
}

func TestMatchDetailed_MissingKeyDiagnostics(t *testing.T) {
	agent := testAgent("my-agent", "argo", oapi.JobAgentConfig{})
	res := testResource("k8s", "cluster-1", map[string]any{})

	result := MatchJobAgentsWithResourceDetailed(
		`jobAgent.config.server == resource.config.argocd.serverUrl`,
		[]oapi.JobAgent{agent},
		res,
	)
	require.NoError(t, result.Err)
	assert.Empty(t, result.Result.Matched)
	assert.Equal(t, 1, result.Result.Diagnostics.TotalAgents)
	assert.Equal(t, 0, result.Result.Diagnostics.MatchedCount)
	assert.Contains(t, result.Result.Diagnostics.MissingKeyAgents, "my-agent")
}

func TestMatchDetailed_ResourceAwareSelector(t *testing.T) {
	agentUS := testAgent("argo-us", "argo", oapi.JobAgentConfig{"server": "https://us.example.com"})
	agentEU := testAgent("argo-eu", "argo", oapi.JobAgentConfig{"server": "https://eu.example.com"})
	res := testResource("k8s", "us-cluster", map[string]any{
		"argocd": map[string]any{"serverUrl": "https://us.example.com"},
	})

	result := MatchJobAgentsWithResourceDetailed(
		`jobAgent.config.server == resource.config.argocd.serverUrl`,
		[]oapi.JobAgent{agentUS, agentEU},
		res,
	)
	require.NoError(t, result.Err)
	require.Len(t, result.Result.Matched, 1)
	assert.Equal(t, agentUS.Id, result.Result.Matched[0].Id)
	assert.Equal(t, 2, result.Result.Diagnostics.TotalAgents)
	assert.Equal(t, 1, result.Result.Diagnostics.MatchedCount)
	assert.Empty(t, result.Result.Diagnostics.MissingKeyAgents)
}

func TestMatchDetailed_CompileError(t *testing.T) {
	agent := testAgent("a", "test", oapi.JobAgentConfig{})
	res := testResource("k8s", "cluster", map[string]any{})

	result := MatchJobAgentsWithResourceDetailed(
		`this is not valid CEL !!!`,
		[]oapi.JobAgent{agent},
		res,
	)
	assert.Error(t, result.Err)
}
