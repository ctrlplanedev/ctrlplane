package celutil

import (
	"fmt"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
)

// EvalBool evaluates a compiled CEL program with the given variables and returns
// the boolean result. If the expression references a missing key, it returns
// false with a nil error (treating it as a non-match).
func EvalBool(prg cel.Program, vars map[string]any) (bool, error) {
	val, _, err := prg.Eval(vars)
	if err != nil {
		if strings.Contains(err.Error(), "no such key:") {
			return false, nil
		}
		return false, err
	}

	result := val.ConvertToType(cel.BoolType)
	boolVal, ok := result.Value().(bool)
	if !ok {
		return false, fmt.Errorf("CEL expression must return boolean, got: %T", result.Value())
	}
	return boolVal, nil
}

// Variables parses a CEL expression and returns the unique top-level variable
// names referenced in it. For example, given
// "resource.name == 'x' && environment.name == 'x'" it returns
// ["resource", "environment"].
func Variables(expression string) ([]string, error) {
	env, err := cel.NewEnv()
	if err != nil {
		return nil, err
	}

	parsed, iss := env.Parse(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}

	seen := make(map[string]bool)
	var vars []string
	collectVariables(parsed.NativeRep().Expr(), seen, &vars)
	return vars, nil
}

func collectVariables(e ast.Expr, seen map[string]bool, vars *[]string) {
	switch e.Kind() {
	case ast.IdentKind:
		name := e.AsIdent()
		if !seen[name] {
			seen[name] = true
			*vars = append(*vars, name)
		}
	case ast.SelectKind:
		collectVariables(e.AsSelect().Operand(), seen, vars)
	case ast.CallKind:
		call := e.AsCall()
		if call.IsMemberFunction() {
			collectVariables(call.Target(), seen, vars)
		}
		for _, arg := range call.Args() {
			collectVariables(arg, seen, vars)
		}
	case ast.ListKind:
		for _, elem := range e.AsList().Elements() {
			collectVariables(elem, seen, vars)
		}
	case ast.MapKind:
		for _, entry := range e.AsMap().Entries() {
			mapEntry := entry.AsMapEntry()
			collectVariables(mapEntry.Key(), seen, vars)
			collectVariables(mapEntry.Value(), seen, vars)
		}
	case ast.ComprehensionKind:
		comp := e.AsComprehension()
		seen[comp.IterVar()] = true
		seen[comp.IterVar2()] = true
		seen[comp.AccuVar()] = true
		collectVariables(comp.IterRange(), seen, vars)
		collectVariables(comp.AccuInit(), seen, vars)
		collectVariables(comp.LoopCondition(), seen, vars)
		collectVariables(comp.LoopStep(), seen, vars)
		collectVariables(comp.Result(), seen, vars)
	case ast.StructKind:
		for _, field := range e.AsStruct().Fields() {
			collectVariables(field.AsStructField().Value(), seen, vars)
		}
	}
}
