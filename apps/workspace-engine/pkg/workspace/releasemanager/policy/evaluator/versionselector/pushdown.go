package versionselector

import (
	"workspace-engine/pkg/celutil"
)

// versionExtractor is configured for the `version` CEL variable so a CEL
// expression like `version.tag == "v1"` translates to `tag = $N`. The schema
// here mirrors the columns selected by the candidate-version iterator query;
// adding fields here is how we expand pushdown coverage to new shapes.
//
// We intentionally only declare flat columns plus the metadata JSONB field —
// selectors that touch environment/resource/deployment fall through and are
// evaluated row-by-row by the runtime CEL evaluator, which is the source of
// truth.
var versionExtractor = celutil.NewSQLExtractor("version").
	WithColumn("id", "id").
	WithColumn("tag", "tag").
	WithColumn("name", "name").
	WithColumn("status", "status").
	WithJSONBField("metadata", "metadata")

// TryPushDown attempts to convert a versionselector CEL expression into a
// parameterized SQL WHERE fragment that can be appended to the candidate
// query. startParam is the next available `$N` placeholder number.
//
// Returns ok=false when nothing could be extracted — the runtime CEL
// evaluator still runs over every yielded row, so correctness is preserved
// regardless. Pushdown is purely a candidate-set narrowing optimization.
//
// The underlying extractor parameterizes string literals (no inlining), so
// SQL injection is structurally prevented rather than relying on escaping.
func TryPushDown(selector string, startParam int) (clause string, args []any, ok bool) {
	if selector == "" {
		return "", nil, false
	}
	f, err := versionExtractor.Extract(selector, startParam)
	if err != nil || f == nil || f.Clause == "" {
		return "", nil, false
	}
	return f.Clause, f.Args, true
}
