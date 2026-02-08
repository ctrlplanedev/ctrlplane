package cel_test

import (
	"testing"
	"workspace-engine/pkg/oapi"
	cel "workspace-engine/pkg/selector/langs/cel"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildEntityContext_AllNil(t *testing.T) {
	ctx := cel.BuildEntityContext(nil, nil, nil)

	require.Contains(t, ctx, "resource")
	require.Contains(t, ctx, "deployment")
	require.Contains(t, ctx, "environment")

	assert.Equal(t, map[string]any{}, ctx["resource"])
	assert.Equal(t, map[string]any{}, ctx["deployment"])
	assert.Equal(t, map[string]any{}, ctx["environment"])
}

func TestBuildEntityContext_AllPopulated(t *testing.T) {
	r := &oapi.Resource{
		Id:       "r1",
		Name:     "my-resource",
		Kind:     "kubernetes",
		Version:  "v1",
		Metadata: map[string]string{"team": "platform"},
	}
	d := &oapi.Deployment{
		Id:   "d1",
		Name: "web",
		Slug: "web-slug",
	}
	e := &oapi.Environment{
		Id:   "e1",
		Name: "production",
	}

	ctx := cel.BuildEntityContext(r, d, e)

	resMap, ok := ctx["resource"].(map[string]any)
	require.True(t, ok, "resource should be a map")
	assert.Equal(t, "r1", resMap["id"])
	assert.Equal(t, "my-resource", resMap["name"])
	assert.Equal(t, "kubernetes", resMap["kind"])
	assert.Equal(t, "v1", resMap["version"])

	meta, ok := resMap["metadata"].(map[string]string)
	require.True(t, ok, "metadata should be map[string]string")
	assert.Equal(t, "platform", meta["team"])

	depMap, ok := ctx["deployment"].(map[string]any)
	require.True(t, ok, "deployment should be a map")
	assert.Equal(t, "d1", depMap["id"])
	assert.Equal(t, "web", depMap["name"])
	assert.Equal(t, "web-slug", depMap["slug"])

	envMap, ok := ctx["environment"].(map[string]any)
	require.True(t, ok, "environment should be a map")
	assert.Equal(t, "e1", envMap["id"])
	assert.Equal(t, "production", envMap["name"])
}

func TestBuildEntityContext_PartialNil(t *testing.T) {
	// Only resource is set, deployment and environment are nil
	r := &oapi.Resource{
		Id:   "r1",
		Name: "my-resource",
		Kind: "server",
	}

	ctx := cel.BuildEntityContext(r, nil, nil)

	resMap, ok := ctx["resource"].(map[string]any)
	require.True(t, ok, "resource should be a populated map")
	assert.Equal(t, "r1", resMap["id"])

	assert.Equal(t, map[string]any{}, ctx["deployment"])
	assert.Equal(t, map[string]any{}, ctx["environment"])
}

func TestCompileProgram_ValidExpression(t *testing.T) {
	program, err := cel.CompileProgram("deployment.name == 'web'")
	require.NoError(t, err)
	assert.NotNil(t, program)
}

func TestCompileProgram_InvalidExpression(t *testing.T) {
	_, err := cel.CompileProgram("this is not valid CEL !!!")
	assert.Error(t, err)
}

func TestCompileProgram_EmptyExpression(t *testing.T) {
	// Empty expression should fail to compile (no output type)
	_, err := cel.CompileProgram("")
	assert.Error(t, err)
}
