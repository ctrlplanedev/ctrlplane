package desiredrelease

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"workspace-engine/pkg/oapi"
)

func TestCollectPushdownClauses(t *testing.T) {
	t.Run("nil policies → empty slice", func(t *testing.T) {
		assert.Empty(t, collectPushdownClauses(nil))
	})

	t.Run("disabled policy is skipped", func(t *testing.T) {
		clauses := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: false,
				Rules: []oapi.PolicyRule{
					{VersionSelector: &oapi.VersionSelectorRule{Selector: `version.tag == "x"`}},
				},
			},
		})
		assert.Empty(t, clauses)
	})

	t.Run("rule without VersionSelector is skipped", func(t *testing.T) {
		clauses := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: true,
				Rules:   []oapi.PolicyRule{{}},
			},
		})
		assert.Empty(t, clauses)
	})

	t.Run("untranslatable selector falls back silently", func(t *testing.T) {
		// References environment, which our pushdown schema doesn't expose.
		clauses := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `environment.name == "prod"`,
						},
					},
				},
			},
		})
		assert.Empty(t, clauses, "selectors that can't push down must produce no clause")
	})

	t.Run("translatable selector emits clause", func(t *testing.T) {
		clauses := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `version.tag == "v1.2.3"`,
						},
					},
				},
			},
		})
		assert.Len(t, clauses, 1)
		assert.Contains(t, clauses[0], "v1.2.3")
	})

	t.Run("multiple translatable clauses returned in stable order", func(t *testing.T) {
		policies := []*oapi.Policy{
			{
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{VersionSelector: &oapi.VersionSelectorRule{Selector: `version.tag == "z"`}},
					{VersionSelector: &oapi.VersionSelectorRule{Selector: `version.tag == "a"`}},
				},
			},
		}
		clauses1 := collectPushdownClauses(policies)
		clauses2 := collectPushdownClauses(policies)
		assert.Equal(t, clauses1, clauses2, "same input must produce identical output")
		assert.Len(t, clauses1, 2)
		assert.LessOrEqual(t, clauses1[0], clauses1[1], "clauses must be sorted")
	})
}
