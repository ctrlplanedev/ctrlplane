package planvalidation

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/open-policy-agent/opa/v1/ast"
	"github.com/open-policy-agent/opa/v1/rego"
)

// Violation represents a single policy violation produced by a Rego rule.
type Violation struct {
	Msg  string `json:"msg"`
	Path string `json:"path,omitempty"`
}

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
	Version     any    `json:"version,omitempty"`
}

// Result holds the outcome of evaluating a single Rego policy.
type Result struct {
	Passed     bool
	Violations []Violation
}

// Evaluate compiles and runs a Rego policy module against the given input,
// collecting all violations. The package declaration in the Rego source is
// auto-detected so callers don't need to know it.
func Evaluate(ctx context.Context, regoSource string, input Input) (*Result, error) {
	module, err := ast.ParseModuleWithOpts("policy.rego", regoSource, ast.ParserOptions{})
	if err != nil {
		return nil, fmt.Errorf("parse rego module: %w", err)
	}

	pkgPath := module.Package.Path.String()

	violationQuery := pkgPath + ".violation"
	denyQuery := pkgPath + ".deny"

	inputMap, err := toMap(input)
	if err != nil {
		return nil, fmt.Errorf("marshal input: %w", err)
	}

	violations, err := queryRuleSet(ctx, regoSource, violationQuery, inputMap)
	if err != nil {
		return nil, err
	}

	denials, err := queryRuleSet(ctx, regoSource, denyQuery, inputMap)
	if err != nil && !isUndefinedRule(err) {
		return nil, err
	}
	violations = append(violations, denials...)

	return &Result{
		Passed:     len(violations) == 0,
		Violations: violations,
	}, nil
}

func queryRuleSet(ctx context.Context, regoSource, query string, input map[string]any) ([]Violation, error) {
	r := rego.New(
		rego.Query(query),
		rego.Module("policy.rego", regoSource),
		rego.Input(input),
	)

	rs, err := r.Eval(ctx)
	if err != nil {
		return nil, fmt.Errorf("evaluate rego query %q: %w", query, err)
	}

	var violations []Violation
	for _, result := range rs {
		for _, expr := range result.Expressions {
			set, ok := expr.Value.([]any)
			if !ok {
				continue
			}
			for _, item := range set {
				v := parseViolation(item)
				if v.Msg != "" {
					violations = append(violations, v)
				}
			}
		}
	}
	return violations, nil
}

func parseViolation(item any) Violation {
	switch v := item.(type) {
	case string:
		return Violation{Msg: v}
	case map[string]any:
		var viol Violation
		if msg, ok := v["msg"].(string); ok {
			viol.Msg = msg
		}
		if path, ok := v["path"].(string); ok {
			viol.Path = path
		}
		return viol
	default:
		return Violation{Msg: fmt.Sprintf("%v", v)}
	}
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

func isUndefinedRule(err error) bool {
	return err != nil && strings.Contains(err.Error(), "undefined")
}
