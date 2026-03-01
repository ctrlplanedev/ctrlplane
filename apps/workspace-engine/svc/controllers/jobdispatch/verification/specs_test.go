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
