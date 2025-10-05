package cel

import (
	"fmt"
	"workspace-engine/pkg/pb"

	"github.com/google/cel-go/cel"
)

type Context struct {
	Resource pb.Resource   `json:"resource"`
	User     pb.System     `json:"user"`
	Config   pb.Deployment `json:"config"`
}

var Env, _ = cel.NewEnv(
	cel.Variable("resource", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("deployment", cel.MapType(cel.StringType, cel.AnyType)),
	cel.Variable("environment", cel.MapType(cel.StringType, cel.AnyType)),
)

func Compile(expression string) (*CelSelector, error) {
    ast, iss := Env.Compile(expression)
    if iss.Err() != nil {
        return nil, iss.Err()
    }
    program, err := Env.Program(ast)
    if err != nil {
        return nil, err
    }
    return &CelSelector{Program: program}, nil
}

type CelSelector struct {
	Program cel.Program
}

func (s *CelSelector) Matches(context *Context) (bool, error) {
    val, _, err := s.Program.Eval(context)
	if err != nil {
		return false, err
	}
    result := val.ConvertToType(cel.BoolType)
	boolVal, ok := result.Value().(bool)
	if !ok {
		return false, fmt.Errorf("result is not a boolean")
	}
    return boolVal, nil
}
