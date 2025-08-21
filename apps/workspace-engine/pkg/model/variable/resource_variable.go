package variable

import (
	"context"
	"errors"
	"fmt"
	"workspace-engine/pkg/model/resource"
)

type ResourceVariable interface {
	Variable
	GetResourceID() string
}

type DirectResourceVariable struct {
	ID         string `json:"id"`
	ResourceID string `json:"resourceId"`
	Key        string `json:"key"`
	Value      any    `json:"value"`
	Sensitive  bool   `json:"sensitive"`
}

func (v *DirectResourceVariable) GetID() string {
	return v.ID
}

func (v *DirectResourceVariable) GetResourceID() string {
	return v.ResourceID
}

func (v *DirectResourceVariable) GetKey() string {
	return v.Key
}

func (v *DirectResourceVariable) GetValue() any {
	return v.Value
}

func (v *DirectResourceVariable) IsSensitive() bool {
	return v.Sensitive
}

func (v *DirectResourceVariable) Resolve(ctx context.Context, resource *resource.Resource) (string, error) {
	if v.Sensitive {
		// TODO: encryption
		return "", errors.New("sensitive variable not supported")
	}

	return fmt.Sprintf("%v", v.Value), nil
}
