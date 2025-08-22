package variable

import (
	"fmt"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/resource"
)

type DeploymentVariable struct {
	ID             string `json:"id"`
	DeploymentID   string `json:"deploymentId"`
	Key            string `json:"key"`
	DefaultValueID string `json:"defaultValueId"`

	DirectValues    []DirectDeploymentVariableValue    `json:"directValues"`
	ReferenceValues []ReferenceDeploymentVariableValue `json:"referenceValues"`
}

func (v *DeploymentVariable) GetID() string {
	return v.ID
}

func (v *DeploymentVariable) GetDeploymentID() string {
	return v.DeploymentID
}

func (v *DeploymentVariable) GetKey() string {
	return v.Key
}

func (v *DeploymentVariable) GetDefaultValueID() string {
	return v.DefaultValueID
}

type DirectDeploymentVariableValue struct {
	ID               string                    `json:"id"`
	VariableID       string                    `json:"variableId"`
	Value            any                       `json:"value"`
	Sensitive        bool                      `json:"sensitive"`
	Priority         int                       `json:"priority"`
	ResourceSelector *conditions.JSONCondition `json:"resourceSelector,omitempty"`
}

func (v *DirectDeploymentVariableValue) GetID() string {
	return v.ID
}

func (v *DirectDeploymentVariableValue) GetVariableID() string {
	return v.VariableID
}

func (v *DirectDeploymentVariableValue) GetValue() any {
	return v.Value
}

func (v *DirectDeploymentVariableValue) IsSensitive() bool {
	return v.Sensitive
}

func (v *DirectDeploymentVariableValue) GetPriority() int {
	return v.Priority
}

func (v *DirectDeploymentVariableValue) MatchAllIfNullSelector(entity model.MatchableEntity) bool {
	return false
}

func (v *DirectDeploymentVariableValue) Selector(entity model.MatchableEntity) (*conditions.JSONCondition, error) {
	if _, ok := entity.(resource.Resource); ok {
		return v.ResourceSelector, nil
	}
	return nil, fmt.Errorf("entity is not a supported selector option")
}

type ReferenceDeploymentVariableValue struct {
	ID               string                    `json:"id"`
	VariableID       string                    `json:"variableId"`
	Reference        string                    `json:"reference"`
	Path             string                    `json:"path"`
	Priority         int                       `json:"priority"`
	ResourceSelector *conditions.JSONCondition `json:"resourceSelector,omitempty"`
}

func (v *ReferenceDeploymentVariableValue) GetID() string {
	return v.ID
}

func (v *ReferenceDeploymentVariableValue) GetVariableID() string {
	return v.VariableID
}

func (v *ReferenceDeploymentVariableValue) GetReference() string {
	return v.Reference
}

func (v *ReferenceDeploymentVariableValue) GetPath() string {
	return v.Path
}

func (v *ReferenceDeploymentVariableValue) GetPriority() int {
	return v.Priority
}

func (v *ReferenceDeploymentVariableValue) MatchAllIfNullSelector(entity model.MatchableEntity) bool {
	return false
}

func (v *ReferenceDeploymentVariableValue) Selector(entity model.MatchableEntity) (*conditions.JSONCondition, error) {
	if _, ok := entity.(resource.Resource); ok {
		return v.ResourceSelector, nil
	}
	return nil, fmt.Errorf("entity is not a supported selector option")
}
