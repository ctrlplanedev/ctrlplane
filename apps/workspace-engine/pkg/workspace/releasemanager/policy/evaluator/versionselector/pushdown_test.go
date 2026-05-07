package versionselector

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestTryPushDown_SupportedShapes locks in which CEL expression shapes the
// in-house SQLExtractor currently translates. If any of these flip from
// ok=true to false on a refactor of celutil, we want a loud test failure
// rather than silent loss of the optimization.
func TestTryPushDown_SupportedShapes(t *testing.T) {
	cases := []struct {
		name     string
		selector string
		// First emitted SQL token after WHERE. Validates the column mapping
		// landed on the right table column and that placeholders advance.
		wantContain string
	}{
		{name: "literal equality", selector: `version.tag == "v1.2.3"`, wantContain: "tag ="},
		{name: "inequality", selector: `version.tag != "broken"`, wantContain: "tag !="},
		{
			name:        "boolean and",
			selector:    `version.tag == "x" && version.name == "y"`,
			wantContain: "AND",
		},
		{
			name:        "in list",
			selector:    `version.tag in ["a", "b", "c"]`,
			wantContain: "tag IN",
		},
		{
			name:        "startsWith",
			selector:    `version.tag.startsWith("v1.")`,
			wantContain: "tag LIKE",
		},
		{
			name:        "metadata key access",
			selector:    `version.metadata["env"] == "prod"`,
			wantContain: "metadata->>",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			clause, args, ok := TryPushDown(tc.selector, 5)
			if !ok {
				t.Fatalf("expected pushdown to succeed for %q", tc.selector)
			}
			t.Logf("selector=%q  →  SQL=%s  args=%v", tc.selector, clause, args)
			assert.Contains(t, clause, tc.wantContain)
			assert.NotEmpty(t, args, "parameterized output must produce args")
			// Parameterized values must not be inlined as SQL literals.
			for _, a := range args {
				if s, isStr := a.(string); isStr {
					assert.NotContains(
						t,
						clause,
						"'"+s+"'",
						"value %q should be a parameter, not inlined",
						s,
					)
				}
			}
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
		``, // empty
	}
	for _, sel := range cases {
		t.Run(sel, func(t *testing.T) {
			clause, args, ok := TryPushDown(sel, 5)
			assert.False(t, ok, "selector %q must NOT push down", sel)
			assert.Empty(t, clause)
			assert.Empty(t, args)
		})
	}
}

// TestTryPushDown_PartialAndDoesPushSubset documents extractor behavior on
// mixed selectors: top-level conjuncts that resolve are extracted, the rest
// are silently dropped (runtime CEL still evaluates the full expression).
func TestTryPushDown_PartialAndDoesPushSubset(t *testing.T) {
	clause, args, ok := TryPushDown(`version.tag == "x" && environment.name == "prod"`, 5)
	if !ok {
		t.Skip("extractor refused the mixed expression — also acceptable")
	}
	t.Logf("clause=%s args=%v", clause, args)
	assert.Contains(t, clause, "tag =", "version.tag conjunct should push down")
	assert.NotContains(t, clause, "environment", "environment conjunct must not appear in SQL")
}

// TestTryPushDown_NoInjection ensures the parameterized output never inlines
// raw user input, even when the user crafts a malicious CEL string literal.
// Because the in-house extractor parameterizes ALL string values, this is
// structurally guaranteed — but we test it anyway as a regression guard.
func TestTryPushDown_NoInjection(t *testing.T) {
	malicious := `version.tag == "test'; DROP TABLE deployment_version; --"`
	clause, args, ok := TryPushDown(malicious, 5)
	if !ok {
		t.Fatal("expected literal-equality on version.tag to push down")
	}
	assert.NotContains(
		t,
		clause,
		"DROP TABLE",
		"raw payload must not appear in clause text",
	)
	assert.NotContains(t, clause, "test'", "single-quoted payload must not be inlined")

	found := false
	for _, a := range args {
		if s, ok := a.(string); ok && strings.Contains(s, "DROP TABLE") {
			found = true
			break
		}
	}
	assert.True(t, found, "the payload should land in args (parameterized), not the clause")
}

// TestTryPushDown_AdvancesParamNumbers verifies that successive Extract calls
// using the running startParam produce non-overlapping placeholders.
func TestTryPushDown_AdvancesParamNumbers(t *testing.T) {
	clause1, args1, ok := TryPushDown(`version.tag == "a"`, 5)
	if !ok {
		t.Fatal("first extract should succeed")
	}
	clause2, args2, ok := TryPushDown(`version.name == "b"`, 5+len(args1))
	if !ok {
		t.Fatal("second extract should succeed")
	}
	t.Logf("clause1=%s args1=%v\nclause2=%s args2=%v", clause1, args1, clause2, args2)
	assert.Contains(t, clause1, "$5")
	assert.Contains(t, clause2, "$6")
}
