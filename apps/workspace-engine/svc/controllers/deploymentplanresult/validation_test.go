package deploymentplanresult

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/jobagents/types"
	"workspace-engine/pkg/oapi"
)

func validationFixtures() (
	db.DeploymentPlanTargetResult,
	*types.PlanResult,
	oapi.DispatchContext,
) {
	return db.DeploymentPlanTargetResult{
			ID:       uuid.New(),
			TargetID: uuid.New(),
		},
		&types.PlanResult{
			Current:    "old",
			Proposed:   "new",
			HasChanges: true,
		},
		oapi.DispatchContext{
			JobAgent: oapi.JobAgent{Type: "argo-cd"},
			Deployment: &oapi.Deployment{
				Id:   uuid.New().String(),
				Name: "my-deploy",
			},
			Environment: &oapi.Environment{
				Id:          uuid.New().String(),
				Name:        "staging",
				WorkspaceId: uuid.New().String(),
			},
			Resource: &oapi.Resource{
				Id:   uuid.New().String(),
				Name: "web-app",
			},
			Version: &oapi.DeploymentVersion{
				Id:  uuid.New().String(),
				Tag: "v2.0.0",
			},
		}
}

func opaRule(name, rego string) oapi.PolicyRule {
	return oapi.PolicyRule{
		Id:       uuid.New().String(),
		PolicyId: uuid.New().String(),
		PlanValidationOpa: &oapi.PlanValidationOpaRule{
			Name: name,
			Rego: rego,
		},
	}
}

func TestRunPlanValidation_MissingDispatchEntities_IsSkipped(t *testing.T) {
	rule := opaRule("any", `
package test
import rego.v1
deny contains msg if {
    msg := "x"
}
`)
	result, planResult, _ := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	for _, tc := range []struct {
		name        string
		dispatchCtx oapi.DispatchContext
	}{
		{"nil environment", oapi.DispatchContext{
			Deployment: &oapi.Deployment{Id: uuid.New().String()},
			Resource:   &oapi.Resource{Id: uuid.New().String()},
		}},
		{"nil deployment", oapi.DispatchContext{
			Environment: &oapi.Environment{Id: uuid.New().String(), WorkspaceId: uuid.New().String()},
			Resource:    &oapi.Resource{Id: uuid.New().String()},
		}},
		{"nil resource", oapi.DispatchContext{
			Environment: &oapi.Environment{Id: uuid.New().String(), WorkspaceId: uuid.New().String()},
			Deployment:  &oapi.Deployment{Id: uuid.New().String()},
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			setter.validationCalls = nil
			err := RunPlanValidation(
				context.Background(),
				getter,
				setter,
				result,
				planResult,
				tc.dispatchCtx,
			)
			require.NoError(t, err)
			assert.Empty(t, setter.validationCalls)
		})
	}
}

func TestRunPlanValidation_NoMatchingRules(t *testing.T) {
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	assert.Empty(t, setter.validationCalls)
}

func TestRunPlanValidation_PassingRule(t *testing.T) {
	rule := opaRule("no-op", `
package test
import rego.v1
deny contains msg if {
    false
    msg := "never"
}
`)
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	require.Len(t, setter.validationCalls, 1)

	call := setter.validationCalls[0]
	assert.Equal(t, result.ID, call.ResultID)
	assert.True(t, call.Passed)

	var violations []oapi.PlanValidationViolation
	require.NoError(t, json.Unmarshal(call.Violations, &violations))
	assert.Empty(t, violations)
}

func TestRunPlanValidation_FailingRule(t *testing.T) {
	rule := opaRule("always-deny", `
package test
import rego.v1
deny contains msg if {
    msg := "always denied"
}
`)
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	require.Len(t, setter.validationCalls, 1)

	call := setter.validationCalls[0]
	assert.False(t, call.Passed)

	var violations []oapi.PlanValidationViolation
	require.NoError(t, json.Unmarshal(call.Violations, &violations))
	require.Len(t, violations, 1)
	assert.Equal(t, "always denied", violations[0].Message)
}

func TestRunPlanValidation_RuleReadsEnvironmentName(t *testing.T) {
	rule := opaRule("prod-block", `
package test
import rego.v1
deny contains msg if {
    input.environment.name == "production"
    msg := "blocked in prod"
}
`)
	result, planResult, dispatchCtx := validationFixtures()
	dispatchCtx.Environment.Name = "production"

	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	require.Len(t, setter.validationCalls, 1)
	assert.False(t, setter.validationCalls[0].Passed)
}

func TestRunPlanValidation_RuleReadsProposedString(t *testing.T) {
	rule := opaRule("forbid-secret", `
package test
import rego.v1
deny contains msg if {
    contains(input.proposed, "SECRET")
    msg := "proposed contains a secret"
}
`)
	result, planResult, dispatchCtx := validationFixtures()
	planResult.Proposed = "config: SECRET=foo"

	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	require.Len(t, setter.validationCalls, 1)
	assert.False(t, setter.validationCalls[0].Passed)
}

func TestRunPlanValidation_NilPlanValidationOpa_IsSkipped(t *testing.T) {
	rule := oapi.PolicyRule{
		Id:                uuid.New().String(),
		PolicyId:          uuid.New().String(),
		PlanValidationOpa: nil,
	}
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	assert.Empty(t, setter.validationCalls)
}

func TestRunPlanValidation_MultipleRules_PersistsEach(t *testing.T) {
	pass := opaRule("pass", `
package a
import rego.v1
deny contains msg if {
    false
    msg := "x"
}
`)
	fail := opaRule("fail", `
package b
import rego.v1
deny contains msg if {
    msg := "boom"
}
`)
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{pass, fail}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.NoError(t, err)
	require.Len(t, setter.validationCalls, 2)

	byRuleID := map[uuid.UUID]db.UpsertPlanValidationResultParams{}
	for _, c := range setter.validationCalls {
		byRuleID[c.RuleID] = c
	}

	passID := uuid.MustParse(pass.Id)
	failID := uuid.MustParse(fail.Id)
	assert.True(t, byRuleID[passID].Passed)
	assert.False(t, byRuleID[failID].Passed)
}

func TestRunPlanValidation_GetRulesError(t *testing.T) {
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRulesErr: fmt.Errorf("db unreachable")}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "get matching opa rules")
}

func TestRunPlanValidation_BadRego_ReturnsError(t *testing.T) {
	rule := opaRule("bad", "this is not valid rego at all")
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.Error(t, err)
	assert.Empty(t, setter.validationCalls)
}

func TestRunPlanValidation_UpsertError(t *testing.T) {
	rule := opaRule("any", `
package test
import rego.v1
deny contains msg if {
    msg := "x"
}
`)
	result, planResult, dispatchCtx := validationFixtures()
	getter := &mockGetter{opaRules: []oapi.PolicyRule{rule}}
	setter := &mockSetter{validationErr: fmt.Errorf("upsert failed")}

	err := RunPlanValidation(context.Background(), getter, setter, result, planResult, dispatchCtx)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "persist result for rule")
}
