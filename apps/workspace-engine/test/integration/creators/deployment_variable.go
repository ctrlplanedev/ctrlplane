package creators

import (
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// NewDeploymentVariable creates a new DeploymentVariable with default values
func NewDeploymentVariable(deploymentID string, key string) *oapi.DeploymentVariable {
	return &oapi.DeploymentVariable{
		Id:           uuid.New().String(),
		Key:          key,
		DeploymentId: deploymentID,
	}
}

// NewDeploymentVariableValue creates a new DeploymentVariableValue with default values
func NewDeploymentVariableValue(variableID string) *oapi.DeploymentVariableValue {
	return &oapi.DeploymentVariableValue{
		Id:                   uuid.New().String(),
		DeploymentVariableId: variableID,
		Priority:             0,
		ResourceSelector:     NewResourceMatchAllSelector(),
	}
}

// DeploymentVariableValueOption is a function that configures a DeploymentVariableValue
type DeploymentVariableValueOption func(*oapi.DeploymentVariableValue)

// NewDeploymentVariableValueWithOptions creates a new DeploymentVariableValue with options
func NewDeploymentVariableValueWithOptions(variableID string, opts ...DeploymentVariableValueOption) *oapi.DeploymentVariableValue {
	dvv := NewDeploymentVariableValue(variableID)
	for _, opt := range opts {
		opt(dvv)
	}
	return dvv
}

// WithPriority sets the priority of a deployment variable value
func WithPriority(priority int64) DeploymentVariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		dvv.Priority = priority
	}
}

// WithResourceSelector sets the resource selector of a deployment variable value
func WithResourceSelector(selector *oapi.Selector) DeploymentVariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		dvv.ResourceSelector = selector
	}
}

// WithValue sets the value of a deployment variable value
func WithValue(value oapi.Value) DeploymentVariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		dvv.Value = value
	}
}

// WithStringValue sets a string value for a deployment variable value
func WithStringValue(value string) DeploymentVariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		dvv.Value = *NewValueFromString(value)
	}
}

// WithIntValue sets an integer value for a deployment variable value
func WithIntValue(value int64) DeploymentVariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		dvv.Value = *NewValueFromInt(value)
	}
}

// WithBoolValue sets a boolean value for a deployment variable value
func WithBoolValue(value bool) DeploymentVariableValueOption {
	return func(dvv *oapi.DeploymentVariableValue) {
		dvv.Value = *NewValueFromBool(value)
	}
}
