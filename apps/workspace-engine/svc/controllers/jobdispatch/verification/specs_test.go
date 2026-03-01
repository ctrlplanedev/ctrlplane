package verification

import (
	"testing"

	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func sleepProvider(t *testing.T) oapi.MetricProvider {
	t.Helper()
	var p oapi.MetricProvider
	require.NoError(t, p.FromSleepMetricProvider(oapi.SleepMetricProvider{
		DurationSeconds: 5,
	}))
	return p
}

func makeSpec(name string, provider oapi.MetricProvider) oapi.VerificationMetricSpec {
	return oapi.VerificationMetricSpec{
		Name:             name,
		IntervalSeconds:  30,
		Count:            3,
		SuccessCondition: "true",
		Provider:         provider,
	}
}

func TestParseAgentConfig(t *testing.T) {
	t.Run("nil config returns nil", func(t *testing.T) {
		result := ParseAgentConfig(nil)
		assert.Nil(t, result)
	})

	t.Run("config without verifications key returns nil", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"serverUrl": "https://argocd.example.com",
		}
		result := ParseAgentConfig(cfg)
		assert.Nil(t, result)
	})

	t.Run("invalid verifications value returns nil", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"verifications": "not-an-array",
		}
		result := ParseAgentConfig(cfg)
		assert.Nil(t, result)
	})

	t.Run("empty array returns empty slice", func(t *testing.T) {
		cfg := oapi.JobAgentConfig{
			"verifications": []interface{}{},
		}
		result := ParseAgentConfig(cfg)
		assert.Empty(t, result)
	})

	t.Run("parses valid verification specs", func(t *testing.T) {
		successThreshold := 1
		cfg := oapi.JobAgentConfig{
			"verifications": []interface{}{
				map[string]interface{}{
					"name":             "health-check",
					"intervalSeconds":  60,
					"count":            10,
					"successThreshold": successThreshold,
					"successCondition": "result.statusCode == 200",
					"provider": map[string]interface{}{
						"type":            "http",
						"url":             "https://example.com/health",
						"durationSeconds": nil,
					},
				},
			},
		}
		result := ParseAgentConfig(cfg)
		require.Len(t, result, 1)
		assert.Equal(t, "health-check", result[0].Name)
		assert.Equal(t, int32(60), result[0].IntervalSeconds)
		assert.Equal(t, 10, result[0].Count)
		assert.Equal(t, "result.statusCode == 200", result[0].SuccessCondition)
		require.NotNil(t, result[0].SuccessThreshold)
		assert.Equal(t, 1, *result[0].SuccessThreshold)
	})
}

func TestMergeAndDeduplicate(t *testing.T) {
	prov := sleepProvider(t)

	t.Run("both empty returns nil", func(t *testing.T) {
		result := MergeAndDeduplicate(nil, nil)
		assert.Nil(t, result)
	})

	t.Run("policy specs only", func(t *testing.T) {
		specs := []oapi.VerificationMetricSpec{makeSpec("a", prov)}
		result := MergeAndDeduplicate(specs, nil)
		require.Len(t, result, 1)
		assert.Equal(t, "a", result[0].Name)
	})

	t.Run("agent specs only", func(t *testing.T) {
		specs := []oapi.VerificationMetricSpec{makeSpec("b", prov)}
		result := MergeAndDeduplicate(nil, specs)
		require.Len(t, result, 1)
		assert.Equal(t, "b", result[0].Name)
	})

	t.Run("deduplicates by name, policy wins", func(t *testing.T) {
		policy := makeSpec("check", prov)
		policy.Count = 5
		agent := makeSpec("check", prov)
		agent.Count = 99

		result := MergeAndDeduplicate(
			[]oapi.VerificationMetricSpec{policy},
			[]oapi.VerificationMetricSpec{agent},
		)
		require.Len(t, result, 1)
		assert.Equal(t, 5, result[0].Count)
	})

	t.Run("merges distinct specs from both sources", func(t *testing.T) {
		result := MergeAndDeduplicate(
			[]oapi.VerificationMetricSpec{makeSpec("from-policy", prov)},
			[]oapi.VerificationMetricSpec{makeSpec("from-agent", prov)},
		)
		require.Len(t, result, 2)
		assert.Equal(t, "from-policy", result[0].Name)
		assert.Equal(t, "from-agent", result[1].Name)
	})

	t.Run("deduplicates within a single source", func(t *testing.T) {
		dup := makeSpec("dup", prov)
		result := MergeAndDeduplicate(
			[]oapi.VerificationMetricSpec{dup, dup},
			nil,
		)
		require.Len(t, result, 1)
	})
}

func TestGatherSpecs(t *testing.T) {
	prov := sleepProvider(t)

	t.Run("combines policy and agent specs", func(t *testing.T) {
		policySpecs := []oapi.VerificationMetricSpec{makeSpec("policy-metric", prov)}
		agentConfig := oapi.JobAgentConfig{
			"verifications": []interface{}{
				map[string]interface{}{
					"name":             "agent-metric",
					"intervalSeconds":  10,
					"count":            2,
					"successCondition": "true",
					"provider": map[string]interface{}{
						"type":            "sleep",
						"durationSeconds": 1,
					},
				},
			},
		}

		result := GatherSpecs(policySpecs, agentConfig)
		require.Len(t, result, 2)
		assert.Equal(t, "policy-metric", result[0].Name)
		assert.Equal(t, "agent-metric", result[1].Name)
	})

	t.Run("returns nil when both sources are empty", func(t *testing.T) {
		result := GatherSpecs(nil, oapi.JobAgentConfig{})
		assert.Nil(t, result)
	})
}
