package jobdispatch

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

func ptr[T any](v T) *T { return &v }

func makeDispatchContext(resource, environment string) *oapi.DispatchContext {
	return &oapi.DispatchContext{
		Resource:    &oapi.Resource{Name: resource},
		Environment: &oapi.Environment{Name: environment},
	}
}

func TestTemplateVerificationSpecs_NoTemplateDirectives(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "static-check",
			SuccessCondition: "result.statusCode == 200",
			FailureCondition: ptr("result.statusCode == 500"),
		},
	}
	ctx := makeDispatchContext("my-resource", "production")

	result, err := templateVerificationSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, "result.statusCode == 200", result[0].SuccessCondition)
	assert.Equal(t, "result.statusCode == 500", *result[0].FailureCondition)
}

func TestTemplateVerificationSpecs_TemplatesSuccessCondition(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "dynamic-check",
			SuccessCondition: `result.json.name == "{{ .resource.name }}"`,
		},
	}
	ctx := makeDispatchContext("my-resource", "production")

	result, err := templateVerificationSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, `result.json.name == "my-resource"`, result[0].SuccessCondition)
}

func TestTemplateVerificationSpecs_TemplatesFailureCondition(t *testing.T) {
	failureCond := `result.json.env != "{{ .environment.name }}"`
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "env-check",
			SuccessCondition: "true",
			FailureCondition: &failureCond,
		},
	}
	ctx := makeDispatchContext("res", "staging")

	result, err := templateVerificationSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, `result.json.env != "staging"`, *result[0].FailureCondition)
}

func TestTemplateVerificationSpecs_NilDispatchContext(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{Name: "check", SuccessCondition: "true"},
	}
	result, err := templateVerificationSpecs(specs, nil)
	require.NoError(t, err)
	assert.Equal(t, specs, result)
}

func TestTemplateVerificationSpecs_EmptySpecs(t *testing.T) {
	ctx := makeDispatchContext("r", "e")
	result, err := templateVerificationSpecs(nil, ctx)
	require.NoError(t, err)
	assert.Nil(t, result)
}

func TestTemplateVerificationSpecs_NilFailureConditionUnchanged(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "no-failure",
			SuccessCondition: "true",
			FailureCondition: nil,
		},
	}
	ctx := makeDispatchContext("r", "e")

	result, err := templateVerificationSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Nil(t, result[0].FailureCondition)
}

func TestReconcile_TemplatesConditionsFromDispatchContext(t *testing.T) {
	agentID := uuid.New().String()

	resource := &oapi.Resource{Name: "prod-server"}
	dispatchCtx := &oapi.DispatchContext{
		Resource: resource,
	}

	prov := sleepProvider(t)
	policySpec := oapi.VerificationMetricSpec{
		Name:             "resource-check",
		IntervalSeconds:  30,
		Count:            3,
		SuccessCondition: `result.json.resource == "{{ .resource.name }}"`,
		Provider:         prov,
	}

	job, getter := setupGetterWithAgents([]oapi.JobAgent{
		{Id: agentID, Config: oapi.JobAgentConfig{}},
	})
	job.DispatchContext = dispatchCtx
	getter.verificationPolicies = []oapi.VerificationMetricSpec{policySpec}

	setter := &mockSetter{}
	dispatcher := &mockDispatcher{}
	verifier := &mockVerifier{specs: map[string][]oapi.VerificationMetricSpec{}}

	_, err := Reconcile(context.Background(), getter, setter, verifier, dispatcher, job)
	require.NoError(t, err)

	require.Len(t, setter.createCalls, 1)
	require.Len(t, setter.createCalls[0].Specs, 1)
	assert.Equal(t, `result.json.resource == "prod-server"`, setter.createCalls[0].Specs[0].SuccessCondition)
}
