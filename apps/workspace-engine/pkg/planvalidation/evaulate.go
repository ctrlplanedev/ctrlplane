package planvalidation

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/open-policy-agent/opa/v1/rego"
)

// Denial is a single denial message produced by a `deny` rule.
type Denial = string

// Input is the data passed to OPA as `input` during plan validation.
// Rego policies parse current/proposed using built-in functions
// (yaml.unmarshal, json.unmarshal, etc.) since the content format is
// agent-specific.
type Input struct {
	Current     string `json:"current"`
	Proposed    string `json:"proposed"`
	AgentType   string `json:"agentType"`
	HasChanges  bool   `json:"hasChanges"`
	Environment any    `json:"environment,omitempty"`
	Resource    any    `json:"resource,omitempty"`
	Deployment  any    `json:"deployment,omitempty"`

	// ProposedVersion is the deployment version being planned (the new version).
	ProposedVersion any `json:"proposedVersion,omitempty"`
	// CurrentVersion is the deployment version currently deployed to this target (if any).
	CurrentVersion any `json:"currentVersion,omitempty"`
}

// Result holds the outcome of evaluating a single Rego policy.
type Result struct {
	Passed  bool
	Denials []Denial
}

// Evaluate compiles and runs a Rego v1 policy module against the given input,
// collecting all denials. Policies must define a `deny` rule set following the
// Conftest convention. The package declaration in the Rego source is
// auto-detected so callers don't need to know it.
func Evaluate(ctx context.Context, regoSource string, input Input) (*Result, error) {
	module, err := ast.ParseModuleWithOpts("policy.rego", regoSource, ast.ParserOptions{
		RegoVersion: ast.RegoV1,
	})
	if err != nil {
		return nil, fmt.Errorf("parse rego module: %w", err)
	}

	pkgPath := module.Package.Path.String()
	denyQuery := pkgPath + ".deny"

	inputMap, err := toMap(input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}

	denials, err := queryDeny(ctx, regoSource, denyQuery, inputMap)
	if err != nil {
		return nil, err
	}

	return &Result{
		Passed:  len(denials) == 0,
		Denials: denials,
	}, nil
}

func queryDeny(
	ctx context.Context,
	regoSource, query string,
	input map[string]any,
) ([]Denial, error) {
	r := rego.New(
		rego.Query(query),
		rego.Module("policy.rego", regoSource),
		rego.Input(input),
		rego.SetRegoVersion(ast.RegoV1),
	)

	rs, err := r.Eval(ctx)
	if err != nil {
		return nil, fmt.Errorf("evaluate rego query %q: %w", query, err)
	}

	var denials []Denial
	for _, result := range rs {
		for _, expr := range result.Expressions {
			set, ok := expr.Value.([]any)
			if !ok {
				continue
			}
			for _, item := range set {
				if msg := fmt.Sprintf("%v", item); msg != "" {
					denials = append(denials, msg)
				}
			}
		}
	}
	return denials, nil
}

func toMap(input Input) (map[string]any, error) {
	data, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, err
	}
	return m, nil
}
