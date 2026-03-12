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
