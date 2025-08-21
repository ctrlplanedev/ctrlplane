package variable

import (
	"context"
	"errors"
	"fmt"
	rt "workspace-engine/pkg/engine/policy/releasetargets"
)

type ResourceVariable interface {
	GetResourceID() string
	Variable
}

type DirectResourceVariable struct {
	id         string
	resourceID string
	key        string
	value      any
	sensitive  bool
}

func (v *DirectResourceVariable) GetID() string {
	return v.id
}

func (v *DirectResourceVariable) GetResourceID() string {
	return v.resourceID
}

func (v *DirectResourceVariable) GetKey() string {
	return v.key
}

func (v *DirectResourceVariable) GetValue() any {
	return v.value
}

func (v *DirectResourceVariable) IsSensitive() bool {
	return v.sensitive
}

func (v *DirectResourceVariable) ResolveValue(_ context.Context, __ *rt.ReleaseTarget) (string, error) {
	if v.sensitive {
		// TODO: encryption
		return "", errors.New("sensitive variable not supported")
	}

	return fmt.Sprintf("%v", v.value), nil
}
