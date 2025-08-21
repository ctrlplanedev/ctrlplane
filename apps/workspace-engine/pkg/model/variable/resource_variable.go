package variable

import (
	"context"
	"errors"
	"fmt"
	"workspace-engine/pkg/model/resource"
)

type ResourceVariable interface {
	VariableValue
	GetResourceID() string
}

type DirectResourceVariableValue struct {
	ID         string `json:"id"`
	ResourceID string `json:"resourceId"`
	Key        string `json:"key"`
	Value      any    `json:"value"`
	Sensitive  bool   `json:"sensitive"`
}

func (v *DirectResourceVariableValue) GetID() string {
	return v.ID
}

func (v *DirectResourceVariableValue) GetResourceID() string {
	return v.ResourceID
}

func (v *DirectResourceVariableValue) GetKey() string {
	return v.Key
}

func (v *DirectResourceVariableValue) GetValue() any {
	return v.Value
}

func (v *DirectResourceVariableValue) IsSensitive() bool {
	return v.Sensitive
}

func (v *DirectResourceVariableValue) Resolve(ctx context.Context, resource *resource.Resource) (string, error) {
	if v.Sensitive {
		// TODO: encryption
		return "", errors.New("sensitive variable not supported")
	}

	return fmt.Sprintf("%v", v.Value), nil
}
