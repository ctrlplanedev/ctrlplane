package celutil

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/dgraph-io/ristretto/v2"
	"github.com/google/cel-go/cel"
	"github.com/google/cel-go/common/ast"
	"github.com/google/cel-go/ext"
)

// EnvBuilder provides a fluent API for constructing a cel.Env.
type EnvBuilder struct {
	opts []cel.EnvOption
}

// NewEnvBuilder creates a new EnvBuilder.
func NewEnvBuilder() *EnvBuilder {
	return &EnvBuilder{}
}

// WithMapVariable adds a variable typed as map(string, dyn), which is the
// standard type for entity maps in CEL expressions.
func (b *EnvBuilder) WithMapVariable(name string) *EnvBuilder {
	b.opts = append(b.opts, cel.Variable(name, cel.MapType(cel.StringType, cel.AnyType)))
	return b
}

// WithMapVariables adds multiple variables each typed as map(string, dyn).
func (b *EnvBuilder) WithMapVariables(names ...string) *EnvBuilder {
	for _, name := range names {
		b.WithMapVariable(name)
	}
	return b
}

// WithVariable adds a variable with a custom type.
func (b *EnvBuilder) WithVariable(name string, t *cel.Type) *EnvBuilder {
	b.opts = append(b.opts, cel.Variable(name, t))
	return b
}

// WithStandardExtensions adds the standard set of CEL extensions
// (Strings, Math, Lists, Sets).
func (b *EnvBuilder) WithStandardExtensions() *EnvBuilder {
	b.opts = append(b.opts, ext.Strings(), ext.Math(), ext.Lists(), ext.Sets())
	return b
}

// WithOption adds a raw cel.EnvOption for cases not covered by the builder.
func (b *EnvBuilder) WithOption(opt cel.EnvOption) *EnvBuilder {
	b.opts = append(b.opts, opt)
	return b
}

// Build creates the cel.Env from the accumulated options.
func (b *EnvBuilder) Build() (*cel.Env, error) {
	return cel.NewEnv(b.opts...)
}

// BuildCached creates a CompiledEnv that wraps the cel.Env with a ristretto
// compilation cache. Compiled programs are cached for the given TTL.
func (b *EnvBuilder) BuildCached(ttl time.Duration) (*CompiledEnv, error) {
	env, err := b.Build()
	if err != nil {
		return nil, err
	}
	cache, err := ristretto.NewCache(&ristretto.Config[string, cel.Program]{
		NumCounters: 50_000,
		MaxCost:     1 << 30, // 1 GB
		BufferItems: 64,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create compilation cache: %w", err)
	}
	return &CompiledEnv{env: env, cache: cache, ttl: ttl}, nil
}

// CompiledEnv wraps a *cel.Env with a ristretto compilation cache so that
// repeated compilations of the same expression are served from memory.
type CompiledEnv struct {
	env   *cel.Env
	cache *ristretto.Cache[string, cel.Program]
	ttl   time.Duration
}

// Compile compiles a CEL expression into a Program. Results are cached.
func (ce *CompiledEnv) Compile(expression string) (cel.Program, error) {
	if prg, ok := ce.cache.Get(expression); ok {
		return prg, nil
	}

	a, iss := ce.env.Compile(expression)
	if iss.Err() != nil {
		return nil, iss.Err()
	}

	prg, err := ce.env.Program(a)
	if err != nil {
		return nil, err
	}

	ce.cache.SetWithTTL(expression, prg, 1, ce.ttl)
	return prg, nil
}

// Validate checks whether a CEL expression compiles successfully against
// this environment. It returns nil if valid, or the compilation error.
func (ce *CompiledEnv) Validate(expression string) error {
	_, err := ce.Compile(expression)
	return err
}

// Env returns the underlying *cel.Env, useful for callers that need
// the raw environment (e.g. for validation without caching).
func (ce *CompiledEnv) Env() *cel.Env {
	return ce.env
}

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

// EntityToMap converts a struct to a map[string]any via JSON round-trip.
// Keys in the returned map use the JSON tag names. If v is already a
// map[string]any it is returned directly.
func EntityToMap(v any) (map[string]any, error) {
	if m, ok := v.(map[string]any); ok {
		return m, nil
	}

	data, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal entity: %w", err)
	}
	var result map[string]any
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal entity: %w", err)
	}
	return result, nil
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
