package workflows

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"
)

func TestGetResourcesMatching_EmptySelectorReturnsSingleNil(t *testing.T) {
	getter := &PostgresGetter{}
	resources, err := getter.GetResourcesMatching(context.Background(), uuid.New().String(), "")

	require.NoError(t, err)
	require.Len(t, resources, 1)
	assert.Nil(t, resources[0])
}

const argoRoutingSelector = "resource.config.argo.server.contains(jobAgent.config.serverUrl)"

func resourceOnServer(name, server string) *oapi.Resource {
	return &oapi.Resource{
		Id:   uuid.New().String(),
		Name: name,
		Config: map[string]any{
			"argo": map[string]any{"server": server},
		},
	}
}

func argoAgent(serverURL string) (oapi.WorkflowJobAgent, db.JobAgent) {
	ref := uuid.New()
	agent := oapi.WorkflowJobAgent{
		Ref:      ref.String(),
		Name:     "delete-on-" + serverURL,
		Selector: argoRoutingSelector,
		Config:   map[string]any{},
	}
	runner := db.JobAgent{
		ID:     ref,
		Config: oapi.JobAgentConfig{"serverUrl": serverURL},
	}
	return agent, runner
}

func TestPlanDispatches_RoutesEachResourceToItsServer(t *testing.T) {
	prodAgent, prodRunner := argoAgent("argocd.prod.example.com")
	stagingAgent, stagingRunner := argoAgent("argocd.staging.example.com")

	resources := []*oapi.Resource{
		resourceOnServer("r1", "https://argocd.prod.example.com"),
		resourceOnServer("r2", "https://argocd.prod.example.com"),
		resourceOnServer("r3", "https://argocd.staging.example.com"),
	}
	runners := map[string]db.JobAgent{
		prodAgent.Ref:    prodRunner,
		stagingAgent.Ref: stagingRunner,
	}
	base := &oapi.DispatchContext{Workflow: &oapi.Workflow{Id: uuid.New().String()}}

	dispatches, err := planDispatches(
		context.Background(), base, resources,
		[]oapi.WorkflowJobAgent{prodAgent, stagingAgent}, runners,
	)

	require.NoError(t, err)
	require.Len(t, dispatches, 3) // each resource matches exactly one server

	for _, d := range dispatches {
		server := d.dispatchCtx.Resource.Config["argo"].(map[string]any)["server"].(string)
		serverURL := d.runner.Config["serverUrl"].(string)
		assert.Contains(t, server, serverURL, "resource routed to the wrong server")
	}
}

func TestPlanDispatches_NoMatchingServerYieldsNoDispatches(t *testing.T) {
	prodAgent, prodRunner := argoAgent("argocd.prod.example.com")

	resources := []*oapi.Resource{resourceOnServer("r1", "https://argocd.other.example.com")}
	runners := map[string]db.JobAgent{prodAgent.Ref: prodRunner}
	base := &oapi.DispatchContext{Workflow: &oapi.Workflow{Id: uuid.New().String()}}

	dispatches, err := planDispatches(
		context.Background(), base, resources,
		[]oapi.WorkflowJobAgent{prodAgent}, runners,
	)

	require.NoError(t, err)
	assert.Empty(t, dispatches)
}

func TestPlanDispatches_NilResourceRunsGateOnce(t *testing.T) {
	ref := uuid.New()
	agent := oapi.WorkflowJobAgent{
		Ref:      ref.String(),
		Name:     "always",
		Selector: "true",
		Config:   map[string]any{},
	}
	runners := map[string]db.JobAgent{ref.String(): {ID: ref}}
	base := &oapi.DispatchContext{Workflow: &oapi.Workflow{Id: uuid.New().String()}}

	dispatches, err := planDispatches(
		context.Background(), base,
		[]*oapi.Resource{nil}, []oapi.WorkflowJobAgent{agent}, runners,
	)

	require.NoError(t, err)
	require.Len(t, dispatches, 1)
	assert.Nil(t, dispatches[0].dispatchCtx.Resource)
}

func stringInput(key string, def *string) oapi.WorkflowInput {
	var input oapi.WorkflowInput
	_ = input.FromWorkflowStringInput(oapi.WorkflowStringInput{
		Key:     key,
		Type:    "string",
		Default: def,
	})
	return input
}

func numberInput(key string, def *float32) oapi.WorkflowInput {
	var input oapi.WorkflowInput
	_ = input.FromWorkflowNumberInput(oapi.WorkflowNumberInput{
		Key:     key,
		Type:    "number",
		Default: def,
	})
	return input
}

func booleanInput(key string, def *bool) oapi.WorkflowInput {
	var input oapi.WorkflowInput
	_ = input.FromWorkflowBooleanInput(oapi.WorkflowBooleanInput{
		Key:     key,
		Type:    "boolean",
		Default: def,
	})
	return input
}

func TestResolveInputs_ProvidedInputsPassThrough(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", new("staging")),
		},
	}
	provided := map[string]any{"env": "production"}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
}

func TestResolveInputs_MissingInputsGetDefaults(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", new("staging")),
			numberInput("retries", new(float32(3))),
			booleanInput("dryRun", new(true)),
		},
	}
	provided := map[string]any{}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "staging", resolved["env"])
	assert.InDelta(t, float32(3), resolved["retries"], 0)
	assert.Equal(t, true, resolved["dryRun"])
}

func TestResolveInputs_InputsWithoutDefaultsStayAbsent(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", nil),
			numberInput("retries", nil),
			booleanInput("dryRun", nil),
		},
	}
	provided := map[string]any{}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.NotContains(t, resolved, "env")
	assert.NotContains(t, resolved, "retries")
	assert.NotContains(t, resolved, "dryRun")
}

func TestResolveInputs_ProvidedOverridesDefault(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", new("staging")),
			numberInput("retries", new(float32(3))),
			booleanInput("dryRun", new(true)),
		},
	}
	provided := map[string]any{
		"env":     "production",
		"retries": 10,
		"dryRun":  false,
	}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
	assert.Equal(t, 10, resolved["retries"])
	assert.Equal(t, false, resolved["dryRun"])
}

func TestResolveInputs_MixedProvidedAndDefaults(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", new("staging")),
			numberInput("retries", new(float32(3))),
			booleanInput("verbose", nil),
		},
	}
	provided := map[string]any{"env": "production"}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
	assert.InDelta(t, float32(3), resolved["retries"], 0)
	assert.NotContains(t, resolved, "verbose")
}

func TestResolveInputs_DoesNotMutateProvidedMap(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", new("staging")),
		},
	}
	provided := map[string]any{"existing": "value"}

	_, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Len(t, provided, 1)
	assert.Equal(t, "value", provided["existing"])
}

func TestResolveInputs_EmptyWorkflowInputs(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{},
	}
	provided := map[string]any{"extra": "value"}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "value", resolved["extra"])
}

func TestMergeWorkflowJobAgentConfig_RunnerCredentialsPreserved(t *testing.T) {
	runner := oapi.JobAgentConfig{
		"serverUrl": "https://argo.example",
		"apiKey":    "secret",
	}
	perJob := oapi.JobAgentConfig{
		"template": "apiVersion: argoproj.io/v1alpha1",
		"name":     "deploy",
	}

	merged := mergeWorkflowJobAgentConfig(runner, perJob)

	assert.Equal(t, "https://argo.example", merged["serverUrl"])
	assert.Equal(t, "secret", merged["apiKey"])
	assert.Equal(t, "apiVersion: argoproj.io/v1alpha1", merged["template"])
	assert.Equal(t, "deploy", merged["name"])
}

func TestMergeWorkflowJobAgentConfig_PerJobOverridesRunner(t *testing.T) {
	runner := oapi.JobAgentConfig{
		"serverUrl": "https://shared.example",
		"apiKey":    "secret",
	}
	perJob := oapi.JobAgentConfig{
		"serverUrl": "https://override.example",
		"template":  "spec",
	}

	merged := mergeWorkflowJobAgentConfig(runner, perJob)

	assert.Equal(t, "https://override.example", merged["serverUrl"])
	assert.Equal(t, "secret", merged["apiKey"])
	assert.Equal(t, "spec", merged["template"])
}

func TestMergeWorkflowJobAgentConfig_NilInputs(t *testing.T) {
	merged := mergeWorkflowJobAgentConfig(nil, nil)
	assert.Empty(t, merged)

	runner := oapi.JobAgentConfig{"serverUrl": "https://argo.example"}
	merged = mergeWorkflowJobAgentConfig(runner, nil)
	assert.Equal(t, "https://argo.example", merged["serverUrl"])

	perJob := oapi.JobAgentConfig{"template": "spec"}
	merged = mergeWorkflowJobAgentConfig(nil, perJob)
	assert.Equal(t, "spec", merged["template"])
}

func TestBuildJobDispatchContext_PopulatesAgentAndMergedConfig(t *testing.T) {
	workflow := &oapi.Workflow{Id: uuid.New().String()}
	inputs := map[string]any{"env": "prod"}
	base := &oapi.DispatchContext{Workflow: workflow, Inputs: &inputs}

	runnerID := uuid.New()
	workspaceID := uuid.New()
	runner := db.JobAgent{
		ID:          runnerID,
		WorkspaceID: workspaceID,
		Name:        "argo-runner",
		Type:        "argo-workflow",
		Config:      oapi.JobAgentConfig{"serverUrl": "https://argo.example", "apiKey": "secret"},
	}
	merged := oapi.JobAgentConfig{
		"serverUrl": "https://argo.example",
		"apiKey":    "secret",
		"template":  "tmpl",
		"name":      "deploy",
	}

	got := buildJobDispatchContext(base, runner, merged)

	assert.Equal(t, "https://argo.example", got.JobAgentConfig["serverUrl"])
	assert.Equal(t, "secret", got.JobAgentConfig["apiKey"])
	assert.Equal(t, "tmpl", got.JobAgentConfig["template"])
	assert.Equal(t, runnerID.String(), got.JobAgent.Id)
	assert.Equal(t, "argo-workflow", got.JobAgent.Type)
	assert.Equal(t, workspaceID.String(), got.JobAgent.WorkspaceId)
	assert.Equal(t, workflow, got.Workflow)
	require.NotNil(t, got.Inputs)
	assert.Equal(t, "prod", (*got.Inputs)["env"])
}

func TestBuildJobDispatchContext_DoesNotMutateBase(t *testing.T) {
	base := &oapi.DispatchContext{Workflow: &oapi.Workflow{Id: uuid.New().String()}}
	runner := db.JobAgent{ID: uuid.New(), WorkspaceID: uuid.New(), Type: "argo-workflow"}
	merged := oapi.JobAgentConfig{"serverUrl": "https://argo.example"}

	_ = buildJobDispatchContext(base, runner, merged)

	assert.Empty(t, base.JobAgentConfig)
	assert.Empty(t, base.JobAgent.Id)
	assert.Empty(t, base.JobAgent.Type)
}

func TestResolveInputs_ExtraProvidedInputsPassThrough(t *testing.T) {
	workflow := &oapi.Workflow{
		Inputs: []oapi.WorkflowInput{
			stringInput("env", new("staging")),
		},
	}
	provided := map[string]any{
		"env":   "production",
		"extra": "unexpected",
	}

	resolved, err := resolveInputs(workflow, provided)

	require.NoError(t, err)
	assert.Equal(t, "production", resolved["env"])
	assert.Equal(t, "unexpected", resolved["extra"])
}
