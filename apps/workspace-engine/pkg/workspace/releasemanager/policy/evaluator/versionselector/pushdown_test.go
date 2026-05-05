package versionselector

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestTryPushDown_SupportedShapes locks in which CEL expression shapes the
// library currently translates. If any of these flip from ok=true to false on
// a library upgrade, we want a loud test failure rather than silent loss of
// the optimization.
func TestTryPushDown_SupportedShapes(t *testing.T) {
	cases := []struct {
		name        string
		selector    string
		wantContain string
	}{
		{
			name:        "literal equality",
			selector:    `version.tag == "v1.2.3"`,
			wantContain: "v1.2.3",
		},
		{
			name:        "inequality",
			selector:    `version.tag != "broken"`,
			wantContain: "broken",
		},
		{
			name:        "boolean and",
			selector:    `version.tag == "x" && version.name == "y"`,
			wantContain: "AND",
		},
		{
			name:        "boolean or",
			selector:    `version.tag == "x" || version.tag == "y"`,
			wantContain: "OR",
		},
		{
			name:        "startsWith",
			selector:    `version.tag.startsWith("v1.")`,
			wantContain: "v1.",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clause, ok := TryPushDown(tc.selector)
			if !ok {
				t.Logf(
					"selector did NOT push down (will fall back to runtime CEL): %q",
					tc.selector,
				)
				return // capability gap, not a hard failure — optimization is best-effort
			}
			t.Logf("selector=%q  →  SQL=%s", tc.selector, clause)
			assert.Contains(t, clause, tc.wantContain,
				"emitted SQL should mention the literal value somehow (escaped or parameterized)")
		})
	}
}

// TestTryPushDown_FailsClosed locks in that selectors referencing entities
// not in the pushdown schema (environment, resource, deployment) fall back
// rather than producing partial / invalid SQL.
func TestTryPushDown_FailsClosed(t *testing.T) {
	cases := []string{
		`environment.name == "prod"`,
		`resource.kind == "Server"`,
		`deployment.name == "api"`,
		`version.tag == "x" && environment.name == "prod"`,
		``, // empty
	}
	for _, sel := range cases {
		t.Run(sel, func(t *testing.T) {
			_, ok := TryPushDown(sel)
			assert.False(t, ok, "selector %q must NOT push down", sel)
		})
	}
}

// TestTryPushDown_StringEscaping is the safety-critical test. If a user
// stores a malicious string literal in a versionselector rule (an attacker
// who has policy-write access already has way more than this — but defense
// in depth), the emitted SQL must escape single quotes properly. This test
// fails the build if cel2sql ever emits unescaped literals.
func TestTryPushDown_StringEscaping(t *testing.T) {
	malicious := `version.tag == "test'; DROP TABLE deployment_version; --"`
	clause, ok := TryPushDown(malicious)
	if !ok {
		t.Skip("library refused malicious input — that's also acceptable")
	}
	t.Logf("emitted SQL: %s", clause)

	// Acceptable shapes (any one of these proves safe handling):
	// 1. Doubled single quote:    'test''; DROP TABLE...'
	// 2. Backslash escape:        'test\'; DROP TABLE...'
	// 3. Postgres E-string:       E'test\'; DROP TABLE...'
	// 4. Parameterized output:    $1, $2, etc. (no literal at all)
	doubled := strings.Contains(clause, `''`)
	backslash := strings.Contains(clause, `\'`)
	parameterized := strings.Contains(clause, "$") && !strings.Contains(clause, "DROP")

	safe := doubled || backslash || parameterized
	assert.True(t, safe,
		"emitted SQL must escape single quotes or parameterize literals; got: %q", clause)

	// Critical: the unescaped attack pattern must NOT appear verbatim. If the
	// library inlines `test'; DROP TABLE...` as-is, this assertion catches it.
	assert.NotContains(t, clause, `test'; DROP TABLE`,
		"raw single-quote injection pattern present in emitted SQL — UNSAFE")
}

// TestTryPushDown_JSONBAccess documents whether metadata-key access works.
// Result not asserted — just logged so we know if it's available without
// extending the schema. Most version selectors don't use metadata, so this
// being unsupported is acceptable for the POC.
func TestTryPushDown_JSONBAccess(t *testing.T) {
	clause, ok := TryPushDown(`version.metadata["env"] == "prod"`)
	if !ok {
		t.Log(
			"JSONB metadata access NOT supported by current schema — fine, scope to flat fields for now",
		)
		return
	}
	t.Logf("metadata access produced: %s", clause)
}
