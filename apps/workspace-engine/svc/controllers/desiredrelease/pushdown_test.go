package desiredrelease

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"workspace-engine/pkg/oapi"
)

func TestCollectPushdownClauses(t *testing.T) {
	t.Run("nil policies → empty result", func(t *testing.T) {
		clauses, args := collectPushdownClauses(nil)
		assert.Empty(t, clauses)
		assert.Empty(t, args)
	})

	t.Run("disabled policy is skipped", func(t *testing.T) {
		clauses, args := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: false,
				Rules: []oapi.PolicyRule{
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `version.tag == "x"`,
						},
					},
				},
			},
		})
		assert.Empty(t, clauses)
		assert.Empty(t, args)
	})

	t.Run("rule without VersionSelector is skipped", func(t *testing.T) {
		clauses, args := collectPushdownClauses([]*oapi.Policy{
			{Enabled: true, Rules: []oapi.PolicyRule{{}}},
		})
		assert.Empty(t, clauses)
		assert.Empty(t, args)
	})

	t.Run("untranslatable selector falls back silently", func(t *testing.T) {
		clauses, args := collectPushdownClauses([]*oapi.Policy{
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
		assert.Empty(t, clauses)
		assert.Empty(t, args)
	})

	t.Run("translatable selector emits clause + arg", func(t *testing.T) {
		clauses, args := collectPushdownClauses([]*oapi.Policy{
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
		assert.Contains(t, clauses[0], "tag =")
		assert.Contains(t, clauses[0], "$5", "first pushdown arg lands at $5")
		assert.Equal(t, []any{"v1.2.3"}, args)
	})

	t.Run("multiple translatable rules → consecutive placeholders", func(t *testing.T) {
		clauses, args := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `version.tag == "x"`,
						},
					},
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `version.name == "y"`,
						},
					},
				},
			},
		})
		assert.Len(t, clauses, 2)
		assert.Contains(t, clauses[0], "$5")
		assert.Contains(t, clauses[1], "$6", "second clause picks up after first arg")
		assert.Equal(t, []any{"x", "y"}, args)
	})

	t.Run("untranslatable rules don't consume placeholder slots", func(t *testing.T) {
		clauses, args := collectPushdownClauses([]*oapi.Policy{
			{
				Enabled: true,
				Rules: []oapi.PolicyRule{
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `environment.name == "prod"`,
						},
					},
					{
						VersionSelector: &oapi.VersionSelectorRule{
							Selector: `version.tag == "v1"`,
						},
					},
				},
			},
		})
		assert.Len(t, clauses, 1)
		assert.Contains(t, clauses[0], "$5", "translatable clause still numbers from $5")
		assert.Equal(t, []any{"v1"}, args)
	})
}
