package verification

import (
	"testing"

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

func TestTemplateSpecs_NoTemplateDirectives(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "static-check",
			SuccessCondition: "result.statusCode == 200",
			FailureCondition: ptr("result.statusCode == 500"),
		},
	}
	ctx := makeDispatchContext("my-resource", "production")

	result, err := TemplateSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, "result.statusCode == 200", result[0].SuccessCondition)
	assert.Equal(t, "result.statusCode == 500", *result[0].FailureCondition)
}

func TestTemplateSpecs_TemplatesSuccessCondition(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "dynamic-check",
			SuccessCondition: `result.json.name == "{{ .resource.name }}"`,
		},
	}
	ctx := makeDispatchContext("my-resource", "production")

	result, err := TemplateSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, `result.json.name == "my-resource"`, result[0].SuccessCondition)
}

func TestTemplateSpecs_TemplatesFailureCondition(t *testing.T) {
	failureCond := `result.json.env != "{{ .environment.name }}"`
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "env-check",
			SuccessCondition: "true",
			FailureCondition: &failureCond,
		},
	}
	ctx := makeDispatchContext("res", "staging")

	result, err := TemplateSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Equal(t, `result.json.env != "staging"`, *result[0].FailureCondition)
}

func TestTemplateSpecs_NilDispatchContext(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{Name: "check", SuccessCondition: "true"},
	}
	result, err := TemplateSpecs(specs, nil)
	require.NoError(t, err)
	assert.Equal(t, specs, result)
}

func TestTemplateSpecs_EmptySpecs(t *testing.T) {
	ctx := makeDispatchContext("r", "e")
	result, err := TemplateSpecs(nil, ctx)
	require.NoError(t, err)
	assert.Nil(t, result)
}

func TestTemplateSpecs_NilFailureConditionUnchanged(t *testing.T) {
	specs := []oapi.VerificationMetricSpec{
		{
			Name:             "no-failure",
			SuccessCondition: "true",
			FailureCondition: nil,
		},
	}
	ctx := makeDispatchContext("r", "e")

	result, err := TemplateSpecs(specs, ctx)
	require.NoError(t, err)
	require.Len(t, result, 1)
	assert.Nil(t, result[0].FailureCondition)
}
