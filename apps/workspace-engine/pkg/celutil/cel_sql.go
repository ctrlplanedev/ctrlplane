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

// SQLExtractor converts CEL predicates on a specific variable into
// parameterized SQL WHERE fragments. Use [NewSQLExtractor] plus the
// With* builder methods to configure the mapping.
type SQLExtractor struct {
	celVar        string
	columns       map[string]string
	jsonbFields   map[string]string
	knownEntities map[string]map[string]any
}

// NewSQLExtractor creates an extractor for the given CEL variable name
// (e.g. "resource").
func NewSQLExtractor(celVariable string) *SQLExtractor {
	return &SQLExtractor{
		celVar:        celVariable,
		columns:       make(map[string]string),
		jsonbFields:   make(map[string]string),
		knownEntities: make(map[string]map[string]any),
	}
}

// WithColumn maps a CEL property to a SQL column expression.
// Example: WithColumn("kind", "resource.kind").
func (e *SQLExtractor) WithColumn(celField, sqlColumn string) *SQLExtractor {
	e.columns[celField] = sqlColumn
	return e
}

// WithJSONBField maps a CEL map-access property to a SQL JSONB column.
// The generated SQL uses the ->> operator with a parameterized key.
// Example: WithJSONBField("metadata", "resource.metadata").
func (e *SQLExtractor) WithJSONBField(celField, sqlColumn string) *SQLExtractor {
	e.jsonbFields[celField] = sqlColumn
	return e
}

// WithKnownValues registers a CEL variable whose data is fully resolved at
// extraction time. Cross-entity comparisons like candidate.field == known.field
// are resolved by looking up the known variable's value and treating it as a
// literal. The provided map should match the CEL evaluation context shape.
func (e *SQLExtractor) WithKnownValues(celVariable string, values map[string]any) *SQLExtractor {
	e.knownEntities[celVariable] = values
	return e
}

// Extract parses a CEL expression and extracts simple predicates as a
// parameterized SQL WHERE fragment. startParam is the next available $N
// placeholder number (e.g. 2 when $1 is already workspace_id).
//
// Supported patterns (top-level && conjuncts are checked independently):
//   - <var>.<col> == "value"              →  <sqlCol> = $N
//   - <var>.<col> != "value"              →  <sqlCol> != $N
//   - <var>.<col> in ["a", "b"]           →  <sqlCol> IN ($N, $N+1, ...)
//   - <var>.<jsonb>["k"] == "v"           →  <sqlJsonb>->>$N = $N+1
//   - <var>.<jsonb>["k"] != "v"           →  <sqlJsonb>->>$N != $N+1
//   - <var>.<jsonb>["k"] in ["a","b"]     →  <sqlJsonb>->>$N IN ($N+1, ...)
//   - <var>.<col>.startsWith("v")         →  <sqlCol> LIKE $N  (arg "v%")
//   - <var>.<col>.endsWith("v")           →  <sqlCol> LIKE $N  (arg "%v")
//   - <var>.<col>.contains("v")           →  <sqlCol> LIKE $N  (arg "%v%")
//   - <var>.<jsonb>["k"].startsWith("v")  →  <sqlJsonb>->>$N LIKE $N+1
//
// Predicates that cannot be converted are silently skipped; CEL still
// evaluates the full expression on the returned rows.
func (e *SQLExtractor) Extract(expression string, startParam int) (*SQLFilter, error) {
	celEnv, err := cel.NewEnv()
	if err != nil {
		return nil, err
	}

	parsed, iss := celEnv.Parse(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}

	var clauses []string
	var args []any
	param := startParam

	for _, conjunct := range flattenAnd(parsed.NativeRep().Expr()) {
		clause, clauseArgs, nextParam := e.tryExtractPredicate(conjunct, param)
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

// ResourceExtractor is a pre-configured extractor for the "resource" CEL
// variable using unqualified column names.
var ResourceExtractor = NewSQLExtractor("resource").
	WithColumn("kind", "kind").
	WithColumn("name", "name").
	WithColumn("identifier", "identifier").
	WithColumn("version", "version").
	WithJSONBField("metadata", "metadata")

// ExtractResourceFilter is a convenience wrapper around
// [ResourceExtractor.Extract].
func ExtractResourceFilter(expression string, startParam int) (*SQLFilter, error) {
	return ResourceExtractor.Extract(expression, startParam)
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

func (e *SQLExtractor) tryExtractPredicate(expr ast.Expr, param int) (string, []any, int) {
	if expr.Kind() != ast.CallKind {
		return "", nil, param
	}
	call := expr.AsCall()

	switch call.FunctionName() {
	case "_==_", "_!=_":
		return e.tryExtractComparison(call, param)
	case "@in":
		return e.tryExtractIn(call, param)
	case "startsWith", "endsWith", "contains":
		return e.tryExtractStringFunc(call, param)
	}

	return "", nil, param
}

func (e *SQLExtractor) tryExtractComparison(call ast.CallExpr, param int) (string, []any, int) {
	args := call.Args()
	if len(args) != 2 {
		return "", nil, param
	}

	op := "="
	if call.FunctionName() == "_!=_" {
		op = "!="
	}

	// Try LHS as candidate column, RHS as value.
	if colExpr, colArgs, nextParam, ok := e.resolveColumn(args[0], param); ok {
		if val, ok := e.extractValue(args[1]); ok {
			clause := fmt.Sprintf("%s %s $%d", colExpr, op, nextParam)
			colArgs = append(colArgs, val)
			return clause, colArgs, nextParam + 1
		}
	}

	// Try RHS as candidate column, LHS as value (cross-entity comparisons).
	if colExpr, colArgs, nextParam, ok := e.resolveColumn(args[1], param); ok {
		if val, ok := e.extractValue(args[0]); ok {
			clause := fmt.Sprintf("%s %s $%d", colExpr, op, nextParam)
			colArgs = append(colArgs, val)
			return clause, colArgs, nextParam + 1
		}
	}

	return "", nil, param
}

func (e *SQLExtractor) tryExtractIn(call ast.CallExpr, param int) (string, []any, int) {
	callArgs := call.Args()
	if len(callArgs) != 2 {
		return "", nil, param
	}

	colExpr, colArgs, nextParam, ok := e.resolveColumn(callArgs[0], param)
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
	colArgs = append(colArgs, valArgs...)
	return clause, colArgs, param
}

// tryExtractStringFunc handles CEL member functions startsWith, endsWith, and
// contains on candidate columns, mapping them to SQL LIKE patterns.
//
//   - x.startsWith("v")  →  col LIKE $N   (arg = "v%")
//   - x.endsWith("v")    →  col LIKE $N   (arg = "%v")
//   - x.contains("v")    →  col LIKE $N   (arg = "%v%")
func (e *SQLExtractor) tryExtractStringFunc(call ast.CallExpr, param int) (string, []any, int) {
	if !call.IsMemberFunction() {
		return "", nil, param
	}

	fnArgs := call.Args()
	if len(fnArgs) != 1 {
		return "", nil, param
	}

	colExpr, colArgs, nextParam, ok := e.resolveColumn(call.Target(), param)
	if !ok {
		return "", nil, param
	}
	param = nextParam

	val, ok := e.extractValue(fnArgs[0])
	if !ok {
		return "", nil, param
	}

	escaped := escapeLikePattern(val)
	var pattern string
	switch call.FunctionName() {
	case "startsWith":
		pattern = escaped + "%"
	case "endsWith":
		pattern = "%" + escaped
	case "contains":
		pattern = "%" + escaped + "%"
	default:
		return "", nil, param
	}

	clause := fmt.Sprintf("%s LIKE $%d", colExpr, param)
	colArgs = append(colArgs, pattern)
	return clause, colArgs, param + 1
}

// escapeLikePattern escapes SQL LIKE special characters (%, _, \) in a
// literal value so they are matched literally.
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

// resolveColumn checks if an expression represents a field access on the
// configured CEL variable that maps to a SQL column or JSONB expression.
func (e *SQLExtractor) resolveColumn(
	expr ast.Expr,
	param int,
) (sqlExpr string, colArgs []any, nextParam int, ok bool) {
	if expr.Kind() == ast.SelectKind {
		sel := expr.AsSelect()
		if e.isCELVar(sel.Operand()) {
			if col, found := e.columns[sel.FieldName()]; found {
				return col, nil, param, true
			}
		}
		return "", nil, param, false
	}

	if expr.Kind() == ast.CallKind {
		call := expr.AsCall()
		if call.FunctionName() == "_[_]" && len(call.Args()) == 2 {
			operand, index := call.Args()[0], call.Args()[1]
			if operand.Kind() == ast.SelectKind {
				sel := operand.AsSelect()
				if sqlCol, found := e.jsonbFields[sel.FieldName()]; found &&
					e.isCELVar(sel.Operand()) {
					key, ok := extractStringLiteral(index)
					if ok {
						sqlExpr := fmt.Sprintf("%s->>$%d", sqlCol, param)
						return sqlExpr, []any{key}, param + 1, true
					}
				}
			}
		}
	}

	return "", nil, param, false
}

func (e *SQLExtractor) isCELVar(expr ast.Expr) bool {
	return expr.Kind() == ast.IdentKind && expr.AsIdent() == e.celVar
}

// extractValue resolves an AST expression to a concrete string value.
// It handles string literals and field/index access on known entities.
func (e *SQLExtractor) extractValue(expr ast.Expr) (string, bool) {
	if s, ok := extractStringLiteral(expr); ok {
		return s, true
	}
	return e.resolveKnownValue(expr)
}

// resolveKnownValue attempts to resolve a field access on a known entity
// variable to a concrete string value.
//
// Handles:
//   - known.field          → knownEntities[var][field]
//   - known.metadata["k"]  → knownEntities[var][metadata][k]
func (e *SQLExtractor) resolveKnownValue(expr ast.Expr) (string, bool) {
	// Direct field: known.field
	if expr.Kind() == ast.SelectKind {
		sel := expr.AsSelect()
		if sel.Operand().Kind() == ast.IdentKind {
			varName := sel.Operand().AsIdent()
			if values, found := e.knownEntities[varName]; found {
				if val, found := values[sel.FieldName()]; found {
					if s, ok := val.(string); ok {
						return s, true
					}
				}
			}
		}
	}

	// Index access: known.metadata["key"]
	if expr.Kind() == ast.CallKind {
		call := expr.AsCall()
		if call.FunctionName() == "_[_]" && len(call.Args()) == 2 {
			operand, index := call.Args()[0], call.Args()[1]
			if operand.Kind() == ast.SelectKind {
				sel := operand.AsSelect()
				if sel.Operand().Kind() == ast.IdentKind {
					varName := sel.Operand().AsIdent()
					if values, found := e.knownEntities[varName]; found {
						if subVal, found := values[sel.FieldName()]; found {
							if m, ok := subVal.(map[string]any); ok {
								if key, ok := extractStringLiteral(index); ok {
									if v, found := m[key]; found {
										if s, ok := v.(string); ok {
											return s, true
										}
									}
								}
							}
						}
					}
				}
			}
		}
	}

	return "", false
}

func extractStringLiteral(e ast.Expr) (string, bool) {
	if e.Kind() != ast.LiteralKind {
		return "", false
	}
	s, ok := e.AsLiteral().Value().(string)
	return s, ok
}
