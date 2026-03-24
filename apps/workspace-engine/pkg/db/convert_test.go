package db

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// ToOapiEnvironment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ToOapiDeployment
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// ToOapiPolicyWithRules — version selector rules
// ---------------------------------------------------------------------------

func mustMarshal(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	require.NoError(t, err)
	return b
}

func TestToOapiPolicyWithRules_VersionSelectorPlainCEL(t *testing.T) {
	policyID := uuid.New()
	wsID := uuid.New()
	ruleID := uuid.New().String()
	celExpr := "version.tag == 'c40ec83e2d03284f9cc188c5b08e9412b2263a49'"

	row := ListPoliciesWithRulesByWorkspaceIDRow{
		ID:          policyID,
		Name:        "test-policy",
		Selector:    "true",
		Metadata:    map[string]string{},
		Priority:    1,
		Enabled:     true,
		WorkspaceID: wsID,
		CreatedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true},
		VersionSelectorRules: mustMarshal(t, []map[string]any{
			{"id": ruleID, "description": "test", "selector": celExpr},
		}),
		ApprovalRules:               []byte("[]"),
		DeploymentWindowRules:       []byte("[]"),
		DeploymentDependencyRules:   []byte("[]"),
		EnvironmentProgressionRules: []byte("[]"),
		GradualRolloutRules:         []byte("[]"),
		VersionCooldownRules:        []byte("[]"),
	}

	p := ToOapiPolicyWithRules(row)
	require.Len(t, p.Rules, 1)
	require.NotNil(t, p.Rules[0].VersionSelector)

	cs := p.Rules[0].VersionSelector.Selector
	assert.Equal(t, celExpr, cs)
}

func TestToOapiPolicyWithRules_VersionSelectorJSONCelFormat(t *testing.T) {
	policyID := uuid.New()
	wsID := uuid.New()
	ruleID := uuid.New().String()
	celExpr := "version.tag == 'abc'"

	row := ListPoliciesWithRulesByWorkspaceIDRow{
		ID:          policyID,
		Name:        "test-policy",
		Selector:    "true",
		Metadata:    map[string]string{},
		Priority:    1,
		Enabled:     true,
		WorkspaceID: wsID,
		CreatedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true},
		VersionSelectorRules: mustMarshal(t, []map[string]any{
			{"id": ruleID, "description": "test", "selector": celExpr},
		}),
		ApprovalRules:               []byte("[]"),
		DeploymentWindowRules:       []byte("[]"),
		DeploymentDependencyRules:   []byte("[]"),
		EnvironmentProgressionRules: []byte("[]"),
		GradualRolloutRules:         []byte("[]"),
		VersionCooldownRules:        []byte("[]"),
	}

	p := ToOapiPolicyWithRules(row)
	require.Len(t, p.Rules, 1)
	require.NotNil(t, p.Rules[0].VersionSelector)

	cs := p.Rules[0].VersionSelector.Selector
	assert.Equal(t, celExpr, cs)
}

// ---------------------------------------------------------------------------
// ToOapiPolicyWithRules — environment progression selector
// ---------------------------------------------------------------------------

func TestToOapiPolicyWithRules_EnvironmentProgressionPlainCEL(t *testing.T) {
	policyID := uuid.New()
	wsID := uuid.New()
	ruleID := uuid.New().String()
	celExpr := `environment.name == "staging"`

	row := ListPoliciesWithRulesByWorkspaceIDRow{
		ID:          policyID,
		Name:        "test-policy",
		Selector:    "true",
		Metadata:    map[string]string{},
		Priority:    1,
		Enabled:     true,
		WorkspaceID: wsID,
		CreatedAt:   pgtype.Timestamptz{Time: time.Now(), Valid: true},
		EnvironmentProgressionRules: mustMarshal(t, []map[string]any{
			{"id": ruleID, "dependsOnEnvironmentSelector": celExpr},
		}),
		ApprovalRules:             []byte("[]"),
		DeploymentWindowRules:     []byte("[]"),
		DeploymentDependencyRules: []byte("[]"),
		GradualRolloutRules:       []byte("[]"),
		VersionCooldownRules:      []byte("[]"),
		VersionSelectorRules:      []byte("[]"),
	}

	p := ToOapiPolicyWithRules(row)
	require.Len(t, p.Rules, 1)
	require.NotNil(t, p.Rules[0].EnvironmentProgression)

	cs := p.Rules[0].EnvironmentProgression.DependsOnEnvironmentSelector
	assert.Equal(t, celExpr, cs)
}

// ---------------------------------------------------------------------------
// ToOapiDeploymentVariableValue — resource selector
// ---------------------------------------------------------------------------

func TestToOapiDeploymentVariableValue_PlainCELSelector(t *testing.T) {
	id := uuid.New()
	dvID := uuid.New()
	celExpr := `resource.kind == "Cluster"`

	row := DeploymentVariableValue{
		ID:                   id,
		DeploymentVariableID: dvID,
		Value:                []byte(`{"string":"hello"}`),
		ResourceSelector:     pgtype.Text{String: celExpr, Valid: true},
		Priority:             1,
	}

	v := ToOapiDeploymentVariableValue(row)
	require.NotNil(t, v.ResourceSelector)
	assert.Equal(t, celExpr, *v.ResourceSelector)
}

func TestToOapiDeploymentVariableValue_EmptySelector(t *testing.T) {
	id := uuid.New()
	dvID := uuid.New()

	row := DeploymentVariableValue{
		ID:                   id,
		DeploymentVariableID: dvID,
		Value:                []byte(`{"string":"hello"}`),
		ResourceSelector:     pgtype.Text{Valid: false},
		Priority:             1,
	}

	v := ToOapiDeploymentVariableValue(row)
	assert.Nil(t, v.ResourceSelector)
}

func TestToOapiDeploymentVariableValue_EmptyStringSelector(t *testing.T) {
	id := uuid.New()
	dvID := uuid.New()

	row := DeploymentVariableValue{
		ID:                   id,
		DeploymentVariableID: dvID,
		Value:                []byte(`{"string":"hello"}`),
		ResourceSelector:     pgtype.Text{String: "", Valid: true},
		Priority:             1,
	}

	v := ToOapiDeploymentVariableValue(row)
	assert.Nil(t, v.ResourceSelector)
}

// ---------------------------------------------------------------------------
// ToOapiPolicy
// ---------------------------------------------------------------------------

func TestToOapiPolicy(t *testing.T) {
	policyID := uuid.New()
	wsID := uuid.New()
	now := time.Now().Truncate(time.Microsecond)

	row := Policy{
		ID:          policyID,
		Name:        "release-policy",
		Description: pgtype.Text{String: "A test policy", Valid: true},
		Selector:    `resource.kind == "Service"`,
		Metadata:    map[string]string{"owner": "platform"},
		Priority:    10,
		Enabled:     true,
		WorkspaceID: wsID,
		CreatedAt:   pgtype.Timestamptz{Time: now, Valid: true},
	}

	p := ToOapiPolicy(row)

	assert.Equal(t, policyID.String(), p.Id)
	assert.Equal(t, "release-policy", p.Name)
	assert.Equal(t, `resource.kind == "Service"`, p.Selector)
	assert.Equal(t, 10, p.Priority)
	assert.True(t, p.Enabled)
	assert.Equal(t, wsID.String(), p.WorkspaceId)
	assert.NotNil(t, p.Description)
	assert.Equal(t, "A test policy", *p.Description)
	assert.NotEmpty(t, p.CreatedAt)
}

func TestToOapiPolicy_NoDescription(t *testing.T) {
	row := Policy{
		ID:          uuid.New(),
		Name:        "simple",
		Selector:    "true",
		Metadata:    map[string]string{},
		WorkspaceID: uuid.New(),
	}

	p := ToOapiPolicy(row)
	assert.Nil(t, p.Description)
}

// ---------------------------------------------------------------------------
// parseDispatchContext
// ---------------------------------------------------------------------------

func TestParseDispatchContext_ValidJSON(t *testing.T) {
	raw := []byte(`{
		"jobAgentConfig": {"type": "argo-cd", "serverUrl": "https://argo.example.com"},
		"variables": {"size": "small", "count": 3, "enabled": true}
	}`)

	dc := parseDispatchContext(raw)
	require.NotNil(t, dc)

	assert.Equal(t, "argo-cd", dc.JobAgentConfig["type"])
	assert.Equal(t, "https://argo.example.com", dc.JobAgentConfig["serverUrl"])

	require.NotNil(t, dc.Variables)
	vars := *dc.Variables

	sv, err := vars["size"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "small", sv)

	nv, err := vars["count"].AsNumberValue()
	require.NoError(t, err)
	assert.Equal(t, float32(3), nv)

	bv, err := vars["enabled"].AsBooleanValue()
	require.NoError(t, err)
	assert.True(t, bool(bv))
}

func TestParseDispatchContext_InvalidJSON(t *testing.T) {
	dc := parseDispatchContext([]byte(`not json`))
	assert.Nil(t, dc)
}

func TestParseDispatchContext_EmptyObject(t *testing.T) {
	dc := parseDispatchContext([]byte(`{}`))
	require.NotNil(t, dc)
	assert.Nil(t, dc.Variables)
}

func TestParseDispatchContext_NoVariables(t *testing.T) {
	raw := []byte(`{"jobAgentConfig": {"type": "github"}}`)
	dc := parseDispatchContext(raw)
	require.NotNil(t, dc)
	assert.Equal(t, "github", dc.JobAgentConfig["type"])
	assert.Nil(t, dc.Variables)
}

func TestParseDispatchContext_VariablesWithUnsupportedType(t *testing.T) {
	raw := []byte(`{"variables": {"good": "yes", "bad": [1, 2, 3]}}`)
	dc := parseDispatchContext(raw)
	require.NotNil(t, dc)
	require.NotNil(t, dc.Variables)
	vars := *dc.Variables
	_, ok := vars["good"]
	assert.True(t, ok, "string variable should be included")
	_, ok = vars["bad"]
	assert.False(t, ok, "array variable should be skipped")
}

func TestParseDispatchContext_FullBlob(t *testing.T) {
	raw := []byte(`{
		"release": {
			"id": "a75c2617-cfec-55ed-a27c-23e8b149db87",
			"version": {"id": "bd862bc1-26af-4cbc-9172-288615db1118", "tag": "d19527d8ff5df1831990c8b65a3dd50dcd353b0e", "name": "3.195.1-d19527d", "config": {}, "status": "ready", "metadata": {}, "createdAt": "2026-03-23T16:27:35.013Z", "deploymentId": "e9b5a41c-e837-464f-9eed-026d8d660c38"},
			"createdAt": "2026-03-23T17:13:18Z",
			"variables": {"size": "small"},
			"releaseTarget": {"resourceId": "04f1ae82-de8b-4862-9ab1-8c2d513b403f", "deploymentId": "e9b5a41c-e837-464f-9eed-026d8d660c38", "environmentId": "02bece1d-6145-45d4-9f7c-a1fb801a58a7"},
			"encryptedVariables": []
		},
		"version": {"id": "bd862bc1-26af-4cbc-9172-288615db1118", "tag": "d19527d8ff5df1831990c8b65a3dd50dcd353b0e", "name": "3.195.1-d19527d", "config": {}, "status": "ready", "metadata": {}, "createdAt": "2026-03-23T16:27:35.013Z", "deploymentId": "e9b5a41c-e837-464f-9eed-026d8d660c38"},
		"jobAgent": {"id": "65d49095-2f80-4563-bc6d-85d916354097", "name": "W&B ArgoCD", "type": "argo-cd", "config": {}, "metadata": {}, "workspaceId": "569de0fb-6173-45b7-bb84-2f01b5e08075"},
		"resource": {"id": "04f1ae82-de8b-4862-9ab1-8c2d513b403f", "kind": "AmazonElasticKubernetesService", "name": "wandb-incyte", "config": {}, "version": "ctrlplane.dev/kubernetes/cluster/v1", "metadata": {}, "createdAt": "2025-10-20T09:24:45.81861Z", "updatedAt": "2026-03-13T05:00:12.381752457Z", "identifier": "arn:aws:eks:us-east-1:830241207209:cluster/wandb-incyte", "workspaceId": "569de0fb-6173-45b7-bb84-2f01b5e08075"},
		"variables": {"size": "small"},
		"deployment": {"id": "e9b5a41c-e837-464f-9eed-026d8d660c38", "name": "Datadog Cluster Agent", "slug": "datadog-cluster-agent", "metadata": {}, "description": "Datadog Cluster Agent"},
		"environment": {"id": "02bece1d-6145-45d4-9f7c-a1fb801a58a7", "name": "prod-aws", "metadata": {}, "createdAt": "2026-02-13T18:19:28.877Z", "description": "Prod Cluster Platform Tools for aws", "workspaceId": ""},
		"jobAgentConfig": {"type": "argo-cd", "apiKey": "test-key", "template": "some-template", "serverUrl": "argocd.wandb.dev"}
	}`)

	dc := parseDispatchContext(raw)
	require.NotNil(t, dc)

	assert.Equal(t, "argo-cd", dc.JobAgentConfig["type"])
	assert.Equal(t, "test-key", dc.JobAgentConfig["apiKey"])
	assert.Equal(t, "argocd.wandb.dev", dc.JobAgentConfig["serverUrl"])

	require.NotNil(t, dc.Variables)
	vars := *dc.Variables
	sv, err := vars["size"].AsStringValue()
	require.NoError(t, err)
	assert.Equal(t, "small", sv)

	require.NotNil(t, dc.Resource, "resource must be populated")
	assert.Equal(t, "wandb-incyte", dc.Resource.Name)
	assert.Equal(t, "04f1ae82-de8b-4862-9ab1-8c2d513b403f", dc.Resource.Id)
	assert.Equal(t, "arn:aws:eks:us-east-1:830241207209:cluster/wandb-incyte", dc.Resource.Identifier)

	require.NotNil(t, dc.Deployment, "deployment must be populated")
	assert.Equal(t, "Datadog Cluster Agent", dc.Deployment.Name)

	require.NotNil(t, dc.Environment, "environment must be populated")
	assert.Equal(t, "prod-aws", dc.Environment.Name)

	require.NotNil(t, dc.Version, "version must be populated")
	assert.Equal(t, "d19527d8ff5df1831990c8b65a3dd50dcd353b0e", dc.Version.Tag)

	// Verify Map() produces the data the template engine needs
	m := dc.Map()
	require.NotNil(t, m)
	resource, ok := m["resource"].(map[string]any)
	require.True(t, ok, "resource must be a map in Map() output")
	assert.Equal(t, "wandb-incyte", resource["name"])
}

func TestParseDispatchContext_NestedReleaseVariables(t *testing.T) {
	raw := []byte(`{
		"release": {
			"id": "a75c2617-cfec-55ed-a27c-23e8b149db87",
			"version": {"id": "bd862bc1", "tag": "abc123", "name": "v1", "config": {}, "status": "ready", "metadata": {}, "createdAt": "2026-03-23T16:27:35.013Z", "deploymentId": "e9b5a41c"},
			"createdAt": "2026-03-23T17:13:18Z",
			"variables": {"size": "small"},
			"releaseTarget": {"resourceId": "04f1ae82", "deploymentId": "e9b5a41c", "environmentId": "02bece1d"},
			"encryptedVariables": []
		},
		"resource": {"id": "04f1ae82", "kind": "EKS", "name": "my-cluster", "config": {}, "version": "v1", "metadata": {}, "identifier": "arn:eks", "workspaceId": "ws1"},
		"jobAgentConfig": {"type": "argo-cd"}
	}`)

	dc := parseDispatchContext(raw)
	require.NotNil(t, dc, "dispatch context must not be nil even with nested release.variables")

	require.NotNil(t, dc.Resource, "resource must be populated despite nested release.variables")
	assert.Equal(t, "my-cluster", dc.Resource.Name)

	require.NotNil(t, dc.Release, "release must be populated")
	assert.Equal(t, "abc123", dc.Release.Version.Tag)

	assert.Equal(t, "argo-cd", dc.JobAgentConfig["type"])
}
