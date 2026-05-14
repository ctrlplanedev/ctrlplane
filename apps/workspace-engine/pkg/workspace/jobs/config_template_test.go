package jobs

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"workspace-engine/pkg/oapi"
)

func dispatchCtxWithJobAgentVars(vars map[string]string) *oapi.DispatchContext {
	dc := &oapi.DispatchContext{}
	if vars != nil {
		m := make(map[string]oapi.LiteralValue, len(vars))
		for k, v := range vars {
			m[k] = *oapi.NewLiteralValue(v)
		}
		dc.JobAgentVariables = &m
	}
	return dc
}

func TestRenderJobAgentConfig_RendersStringTemplates(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(map[string]string{
		"argo_token": "supersecret123",
	})
	cfg := oapi.JobAgentConfig{
		"serverUrl": "https://argocd.example.com",
		"apiKey":    "{{ .jobAgentVariables.argo_token }}",
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	assert.Equal(t, "https://argocd.example.com", out["serverUrl"])
	assert.Equal(t, "supersecret123", out["apiKey"])
}

func TestRenderJobAgentConfig_LeavesPlainStringsAlone(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(nil)
	cfg := oapi.JobAgentConfig{
		"serverUrl": "https://argocd.example.com",
		"template":  "no braces here",
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	assert.Equal(t, "https://argocd.example.com", out["serverUrl"])
	assert.Equal(t, "no braces here", out["template"])
}

func TestRenderJobAgentConfig_RecursesIntoNestedMaps(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(map[string]string{
		"region": "us-east-1",
		"token":  "abc123",
	})
	cfg := oapi.JobAgentConfig{
		"aws": map[string]any{
			"region":      "{{ .jobAgentVariables.region }}",
			"credentials": map[string]any{"token": "{{ .jobAgentVariables.token }}"},
		},
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	aws := out["aws"].(map[string]any)
	assert.Equal(t, "us-east-1", aws["region"])
	creds := aws["credentials"].(map[string]any)
	assert.Equal(t, "abc123", creds["token"])
}

func TestRenderJobAgentConfig_RecursesIntoArrays(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(map[string]string{
		"a": "first",
		"b": "second",
	})
	cfg := oapi.JobAgentConfig{
		"hosts": []any{
			"{{ .jobAgentVariables.a }}",
			"{{ .jobAgentVariables.b }}",
			"literal",
		},
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	hosts := out["hosts"].([]any)
	assert.Equal(t, []any{"first", "second", "literal"}, hosts)
}

func TestRenderJobAgentConfig_NonStringScalarsPassThrough(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(nil)
	cfg := oapi.JobAgentConfig{
		"timeoutSeconds": 30,
		"insecure":       false,
		"nullField":      nil,
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	assert.Equal(t, 30, out["timeoutSeconds"])
	assert.Equal(t, false, out["insecure"])
	assert.Nil(t, out["nullField"])
}

func TestRenderJobAgentConfig_MissingKeyErrors(t *testing.T) {
	// templatefuncs.New applies Option("missingkey=zero"): the missing
	// top-level "jobAgentVariables" key renders to zero (nil interface),
	// and traversing into it (.unknown) raises a nil-pointer error. The
	// operator gets a clear template error instead of an empty string
	// silently propagating into the agent's config.
	dc := dispatchCtxWithJobAgentVars(nil)
	cfg := oapi.JobAgentConfig{
		"apiKey": "{{ .jobAgentVariables.unknown }}",
	}

	_, err := renderJobAgentConfig(cfg, dc)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "apiKey")
}

func TestRenderJobAgentConfig_MissingLeafKey(t *testing.T) {
	// When jobAgentVariables exists but the leaf key does not, missingkey=zero
	// returns nil for map[string]any element type, which Go's text/template
	// prints as "<no value>". Operators get a visible marker rather than a
	// silent empty string, which is the safer default for security config.
	dc := dispatchCtxWithJobAgentVars(map[string]string{"present": "x"})
	cfg := oapi.JobAgentConfig{
		"apiKey": "{{ .jobAgentVariables.absent }}",
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	assert.Equal(t, "<no value>", out["apiKey"])
}

func TestRenderJobAgentConfig_ParseError(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(nil)
	cfg := oapi.JobAgentConfig{
		"apiKey": "{{ .unterminated",
	}

	_, err := renderJobAgentConfig(cfg, dc)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "parse template")
	assert.Contains(t, err.Error(), "apiKey")
}

func TestRenderJobAgentConfig_EmptyConfigUnchanged(t *testing.T) {
	dc := dispatchCtxWithJobAgentVars(nil)
	out, err := renderJobAgentConfig(oapi.JobAgentConfig{}, dc)
	require.NoError(t, err)
	assert.Empty(t, out)
}

func TestRenderJobAgentConfig_DispatchContextFieldsAccessible(t *testing.T) {
	// Confirm fields other than jobAgentVariables (release, resource etc.)
	// are reachable when present on the DispatchContext.
	dc := &oapi.DispatchContext{
		Resource: &oapi.Resource{Id: "res-1", Name: "srv-a"},
	}
	cfg := oapi.JobAgentConfig{
		"appName": "argo-{{ .resource.name }}",
	}

	out, err := renderJobAgentConfig(cfg, dc)
	require.NoError(t, err)
	assert.Equal(t, "argo-srv-a", out["appName"])
}
