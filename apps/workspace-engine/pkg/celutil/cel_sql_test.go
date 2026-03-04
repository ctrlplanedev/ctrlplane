package celutil

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractResourceFilter(t *testing.T) {
	tests := []struct {
		name           string
		expr           string
		startParam     int
		expectedClause string
		expectedArgs   []any
	}{
		{
			name:           "kind equality",
			expr:           `resource.kind == "k8s/Deployment"`,
			startParam:     2,
			expectedClause: "kind = $2",
			expectedArgs:   []any{"k8s/Deployment"},
		},
		{
			name:           "kind inequality",
			expr:           `resource.kind != "k8s/Deployment"`,
			startParam:     2,
			expectedClause: "kind != $2",
			expectedArgs:   []any{"k8s/Deployment"},
		},
		{
			name:           "name equality",
			expr:           `resource.name == "my-service"`,
			startParam:     2,
			expectedClause: "name = $2",
			expectedArgs:   []any{"my-service"},
		},
		{
			name:           "identifier equality",
			expr:           `resource.identifier == "us-east-1/prod/web"`,
			startParam:     2,
			expectedClause: "identifier = $2",
			expectedArgs:   []any{"us-east-1/prod/web"},
		},
		{
			name:           "version equality",
			expr:           `resource.version == "v1"`,
			startParam:     2,
			expectedClause: "version = $2",
			expectedArgs:   []any{"v1"},
		},
		{
			name:           "kind in list",
			expr:           `resource.kind in ["k8s/Deployment", "k8s/StatefulSet"]`,
			startParam:     2,
			expectedClause: "kind IN ($2, $3)",
			expectedArgs:   []any{"k8s/Deployment", "k8s/StatefulSet"},
		},
		{
			name:           "metadata key equality",
			expr:           `resource.metadata["env"] == "production"`,
			startParam:     2,
			expectedClause: "metadata->>$2 = $3",
			expectedArgs:   []any{"env", "production"},
		},
		{
			name:           "metadata key inequality",
			expr:           `resource.metadata["env"] != "staging"`,
			startParam:     2,
			expectedClause: "metadata->>$2 != $3",
			expectedArgs:   []any{"env", "staging"},
		},
		{
			name:           "metadata key in list",
			expr:           `resource.metadata["env"] in ["prod", "staging"]`,
			startParam:     2,
			expectedClause: "metadata->>$2 IN ($3, $4)",
			expectedArgs:   []any{"env", "prod", "staging"},
		},
		{
			name:           "multiple AND conjuncts",
			expr:           `resource.kind == "k8s/Deployment" && resource.metadata["env"] == "prod"`,
			startParam:     2,
			expectedClause: "kind = $2 AND metadata->>$3 = $4",
			expectedArgs:   []any{"k8s/Deployment", "env", "prod"},
		},
		{
			name:           "three conjuncts",
			expr:           `resource.kind == "k8s/Deployment" && resource.name == "web" && resource.metadata["team"] == "platform"`,
			startParam:     2,
			expectedClause: "kind = $2 AND name = $3 AND metadata->>$4 = $5",
			expectedArgs:   []any{"k8s/Deployment", "web", "team", "platform"},
		},
		{
			name:           "mixed equality and startsWith",
			expr:           `resource.kind == "k8s/Deployment" && resource.name.startsWith("web")`,
			startParam:     2,
			expectedClause: "kind = $2 AND name LIKE $3",
			expectedArgs:   []any{"k8s/Deployment", "web%"},
		},
		{
			name:           "start param offset",
			expr:           `resource.kind == "test"`,
			startParam:     5,
			expectedClause: "kind = $5",
			expectedArgs:   []any{"test"},
		},
		{
			name:           "startsWith on column",
			expr:           `resource.name.startsWith("prod")`,
			startParam:     2,
			expectedClause: "name LIKE $2",
			expectedArgs:   []any{"prod%"},
		},
		{
			name:           "endsWith on column",
			expr:           `resource.name.endsWith("-api")`,
			startParam:     2,
			expectedClause: "name LIKE $2",
			expectedArgs:   []any{"%-api"},
		},
		{
			name:           "contains on column",
			expr:           `resource.name.contains("web")`,
			startParam:     2,
			expectedClause: "name LIKE $2",
			expectedArgs:   []any{"%web%"},
		},
		{
			name:           "startsWith on metadata value",
			expr:           `resource.metadata["env"].startsWith("prod")`,
			startParam:     2,
			expectedClause: "metadata->>$2 LIKE $3",
			expectedArgs:   []any{"env", "prod%"},
		},
		{
			name:           "contains on metadata value",
			expr:           `resource.metadata["region"].contains("east")`,
			startParam:     2,
			expectedClause: "metadata->>$2 LIKE $3",
			expectedArgs:   []any{"region", "%east%"},
		},
		{
			name:           "startsWith escapes LIKE wildcards",
			expr:           `resource.name.startsWith("100%_done")`,
			startParam:     2,
			expectedClause: "name LIKE $2",
			expectedArgs:   []any{`100\%\_done%`},
		},
		{
			name:           "no extractable predicates",
			expr:           `resource.name.matches("^prod.*")`,
			startParam:     2,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "boolean literal true",
			expr:           `true`,
			startParam:     2,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "boolean literal false",
			expr:           `false`,
			startParam:     2,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "cross-entity condition skipped",
			expr:           `resource.kind == environment.name`,
			startParam:     2,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "or expression not extractable",
			expr:           `resource.kind == "a" || resource.kind == "b"`,
			startParam:     2,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "unsupported field skipped",
			expr:           `resource.config["key"] == "val"`,
			startParam:     2,
			expectedClause: "",
			expectedArgs:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter, err := ExtractResourceFilter(tt.expr, tt.startParam)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedClause, filter.Clause)
			assert.Equal(t, tt.expectedArgs, filter.Args)
		})
	}
}

func TestExtractResourceFilter_InvalidExpression(t *testing.T) {
	_, err := ExtractResourceFilter(">>>invalid<<<", 2)
	assert.Error(t, err)
}

func TestSQLExtractor_TableQualifiedColumns(t *testing.T) {
	extractor := NewSQLExtractor("resource").
		WithColumn("kind", "resource.kind").
		WithColumn("name", "resource.name").
		WithColumn("identifier", "resource.identifier").
		WithJSONBField("metadata", "resource.metadata")

	tests := []struct {
		name           string
		expr           string
		expectedClause string
		expectedArgs   []any
	}{
		{
			name:           "qualified kind equality",
			expr:           `resource.kind == "k8s/Deployment"`,
			expectedClause: "resource.kind = $2",
			expectedArgs:   []any{"k8s/Deployment"},
		},
		{
			name:           "qualified identifier equality",
			expr:           `resource.identifier == "us-east-1/web"`,
			expectedClause: "resource.identifier = $2",
			expectedArgs:   []any{"us-east-1/web"},
		},
		{
			name:           "qualified metadata access",
			expr:           `resource.metadata["env"] == "prod"`,
			expectedClause: "resource.metadata->>$2 = $3",
			expectedArgs:   []any{"env", "prod"},
		},
		{
			name:           "qualified compound",
			expr:           `resource.kind == "Node" && resource.name == "web"`,
			expectedClause: "resource.kind = $2 AND resource.name = $3",
			expectedArgs:   []any{"Node", "web"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter, err := extractor.Extract(tt.expr, 2)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedClause, filter.Clause)
			assert.Equal(t, tt.expectedArgs, filter.Args)
		})
	}
}

func TestSQLExtractor_CustomVariable(t *testing.T) {
	extractor := NewSQLExtractor("deployment").
		WithColumn("name", "d.name").
		WithColumn("kind", "d.kind")

	filter, err := extractor.Extract(`deployment.name == "web-api"`, 1)
	require.NoError(t, err)
	assert.Equal(t, "d.name = $1", filter.Clause)
	assert.Equal(t, []any{"web-api"}, filter.Args)
}

func TestSQLExtractor_IgnoresOtherVariables(t *testing.T) {
	extractor := NewSQLExtractor("resource").
		WithColumn("kind", "kind")

	filter, err := extractor.Extract(`deployment.kind == "web"`, 2)
	require.NoError(t, err)
	assert.Equal(t, "", filter.Clause)
	assert.Nil(t, filter.Args)
}

func TestSQLExtractor_KnownValues(t *testing.T) {
	knownFrom := map[string]any{
		"type":     "resource",
		"name":     "web-server",
		"kind":     "k8s/Deployment",
		"metadata": map[string]any{"region": "us-east-1", "team": "platform"},
	}

	extractor := NewSQLExtractor("to").
		WithColumn("kind", "kind").
		WithColumn("name", "name").
		WithColumn("identifier", "identifier").
		WithJSONBField("metadata", "metadata").
		WithKnownValues("from", knownFrom)

	tests := []struct {
		name           string
		expr           string
		expectedClause string
		expectedArgs   []any
	}{
		{
			name:           "cross-entity metadata comparison",
			expr:           `from.metadata["region"] == to.metadata["region"]`,
			expectedClause: "metadata->>$2 = $3",
			expectedArgs:   []any{"region", "us-east-1"},
		},
		{
			name:           "cross-entity metadata reversed",
			expr:           `to.metadata["region"] == from.metadata["region"]`,
			expectedClause: "metadata->>$2 = $3",
			expectedArgs:   []any{"region", "us-east-1"},
		},
		{
			name:           "cross-entity field comparison",
			expr:           `from.kind == to.kind`,
			expectedClause: "kind = $2",
			expectedArgs:   []any{"k8s/Deployment"},
		},
		{
			name:           "cross-entity field reversed",
			expr:           `to.kind == from.kind`,
			expectedClause: "kind = $2",
			expectedArgs:   []any{"k8s/Deployment"},
		},
		{
			name:           "cross-entity inequality",
			expr:           `to.name != from.name`,
			expectedClause: "name != $2",
			expectedArgs:   []any{"web-server"},
		},
		{
			name:           "full relationship expression",
			expr:           `from.type == "resource" && to.type == "resource" && from.metadata["region"] == to.metadata["region"]`,
			expectedClause: "metadata->>$2 = $3",
			expectedArgs:   []any{"region", "us-east-1"},
		},
		{
			name:           "multiple cross-entity metadata keys",
			expr:           `from.metadata["region"] == to.metadata["region"] && from.metadata["team"] == to.metadata["team"]`,
			expectedClause: "metadata->>$2 = $3 AND metadata->>$4 = $5",
			expectedArgs:   []any{"region", "us-east-1", "team", "platform"},
		},
		{
			name:           "mixed literal and cross-entity",
			expr:           `to.kind == "k8s/Pod" && from.metadata["region"] == to.metadata["region"]`,
			expectedClause: "kind = $2 AND metadata->>$3 = $4",
			expectedArgs:   []any{"k8s/Pod", "region", "us-east-1"},
		},
		{
			name:           "known entity predicate only skipped",
			expr:           `from.kind == "k8s/Deployment"`,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "missing known metadata key skipped",
			expr:           `to.metadata["env"] == from.metadata["missing"]`,
			expectedClause: "",
			expectedArgs:   nil,
		},
		{
			name:           "non-string known value skipped",
			expr:           `to.name == from.metadata`,
			expectedClause: "",
			expectedArgs:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			filter, err := extractor.Extract(tt.expr, 2)
			require.NoError(t, err)
			assert.Equal(t, tt.expectedClause, filter.Clause)
			assert.Equal(t, tt.expectedArgs, filter.Args)
		})
	}
}
