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
			name:           "mixed extractable and non-extractable",
			expr:           `resource.kind == "k8s/Deployment" && resource.name.startsWith("web")`,
			startParam:     2,
			expectedClause: "kind = $2",
			expectedArgs:   []any{"k8s/Deployment"},
		},
		{
			name:           "start param offset",
			expr:           `resource.kind == "test"`,
			startParam:     5,
			expectedClause: "kind = $5",
			expectedArgs:   []any{"test"},
		},
		{
			name:           "no extractable predicates",
			expr:           `resource.name.startsWith("prod")`,
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
