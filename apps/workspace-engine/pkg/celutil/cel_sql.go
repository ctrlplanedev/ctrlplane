package celutil

import (
	"fmt"
	"strings"

	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
)

// SQLFilter holds a parameterized SQL WHERE clause fragment extracted from a
// CEL expression.
type SQLFilter struct {
	Clause string
	Args   []any
}

// resourceColumnMap maps CEL field names on "resource" to SQL column names.
var resourceColumnMap = map[string]string{
	"kind":       "kind",
	"name":       "name",
	"identifier": "identifier",
	"version":    "version",
}

// ExtractResourceFilter parses a CEL expression and extracts simple predicates
// on resource fields as a parameterized SQL WHERE fragment. startParam is the
// next available $N placeholder number (e.g. 2 when $1 is workspace_id).
//
// Supported patterns (top-level && conjuncts are checked independently):
//   - resource.<col> == "value"           →  <col> = $N
//   - resource.<col> != "value"           →  <col> != $N
//   - resource.<col> in ["a", "b"]        →  <col> IN ($N, $N+1, ...)
//   - resource.metadata["k"] == "v"       →  metadata->>$N = $N+1
//   - resource.metadata["k"] != "v"       →  metadata->>$N != $N+1
//   - resource.metadata["k"] in ["a","b"] →  metadata->>$N IN ($N+1, $N+2, ...)
//
// Predicates that cannot be converted are silently skipped; CEL still
// evaluates the full expression on the returned rows.
func ExtractResourceFilter(expression string, startParam int) (*SQLFilter, error) {
	env, err := cel.NewEnv()
	if err != nil {
		return nil, err
	}

	parsed, iss := env.Parse(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}

	var clauses []string
	var args []any
	param := startParam

	for _, conjunct := range flattenAnd(parsed.NativeRep().Expr()) {
		clause, clauseArgs, nextParam := tryExtractPredicate(conjunct, param)
		if clause != "" {
			clauses = append(clauses, clause)
			args = append(args, clauseArgs...)
			param = nextParam
		}
	}

	filter := &SQLFilter{}
	if len(clauses) > 0 {
		filter.Clause = strings.Join(clauses, " AND ")
		filter.Args = args
	}
	return filter, nil
}

// flattenAnd recursively collects operands of nested && calls.
func flattenAnd(e ast.Expr) []ast.Expr {
	if e.Kind() != ast.CallKind {
		return []ast.Expr{e}
	}
	call := e.AsCall()
	if call.FunctionName() != "_&&_" {
		return []ast.Expr{e}
	}
	var result []ast.Expr
	for _, arg := range call.Args() {
		result = append(result, flattenAnd(arg)...)
	}
	return result
}

func tryExtractPredicate(e ast.Expr, param int) (string, []any, int) {
	if e.Kind() != ast.CallKind {
		return "", nil, param
	}
	call := e.AsCall()

	switch call.FunctionName() {
	case "_==_", "_!=_":
		return tryExtractComparison(call, param)
	case "@in":
		return tryExtractIn(call, param)
	}

	return "", nil, param
}

func tryExtractComparison(call ast.CallExpr, param int) (string, []any, int) {
	args := call.Args()
	if len(args) != 2 {
		return "", nil, param
	}

	op := "="
	if call.FunctionName() == "_!=_" {
		op = "!="
	}

	colExpr, colArgs, nextParam, ok := resolveResourceColumn(args[0], param)
	if !ok {
		return "", nil, param
	}
	param = nextParam

	lit, ok := extractStringLiteral(args[1])
	if !ok {
		return "", nil, param
	}

	clause := fmt.Sprintf("%s %s $%d", colExpr, op, param)
	allArgs := append(colArgs, lit)
	return clause, allArgs, param + 1
}

func tryExtractIn(call ast.CallExpr, param int) (string, []any, int) {
	callArgs := call.Args()
	if len(callArgs) != 2 {
		return "", nil, param
	}

	colExpr, colArgs, nextParam, ok := resolveResourceColumn(callArgs[0], param)
	if !ok {
		return "", nil, param
	}
	param = nextParam

	if callArgs[1].Kind() != ast.ListKind {
		return "", nil, param
	}
	elems := callArgs[1].AsList().Elements()
	if len(elems) == 0 {
		return "", nil, param
	}

	placeholders := make([]string, 0, len(elems))
	var valArgs []any
	for _, elem := range elems {
		lit, ok := extractStringLiteral(elem)
		if !ok {
			return "", nil, param
		}
		placeholders = append(placeholders, fmt.Sprintf("$%d", param))
		valArgs = append(valArgs, lit)
		param++
	}

	clause := fmt.Sprintf("%s IN (%s)", colExpr, strings.Join(placeholders, ", "))
	allArgs := append(colArgs, valArgs...)
	return clause, allArgs, param
}

// resolveResourceColumn checks if an expression represents a resource field
// that maps to a SQL column. For metadata index access the metadata key is
// parameterized to prevent injection.
func resolveResourceColumn(e ast.Expr, param int) (sqlExpr string, colArgs []any, nextParam int, ok bool) {
	if e.Kind() == ast.SelectKind {
		sel := e.AsSelect()
		if isResourceIdent(sel.Operand()) {
			if col, found := resourceColumnMap[sel.FieldName()]; found {
				return col, nil, param, true
			}
		}
		return "", nil, param, false
	}

	if e.Kind() == ast.CallKind {
		call := e.AsCall()
		if call.FunctionName() == "_[_]" && len(call.Args()) == 2 {
			operand, index := call.Args()[0], call.Args()[1]
			if operand.Kind() == ast.SelectKind {
				sel := operand.AsSelect()
				if sel.FieldName() == "metadata" && isResourceIdent(sel.Operand()) {
					key, ok := extractStringLiteral(index)
					if ok {
						expr := fmt.Sprintf("metadata->>$%d", param)
						return expr, []any{key}, param + 1, true
					}
				}
			}
		}
	}

	return "", nil, param, false
}

func isResourceIdent(e ast.Expr) bool {
	return e.Kind() == ast.IdentKind && e.AsIdent() == "resource"
}

func extractStringLiteral(e ast.Expr) (string, bool) {
	if e.Kind() != ast.LiteralKind {
		return "", false
	}
	s, ok := e.AsLiteral().Value().(string)
	return s, ok
}
