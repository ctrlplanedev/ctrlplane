package relationships

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"workspace-engine/pkg/oapi"
)

// GetPropertyValue extracts a property value from an entity using a property path
// The property path is a slice of strings representing nested property access
// Examples: ["id"], ["metadata", "region"], ["config", "networking", "vpc_id"]
func GetPropertyValue(entity *oapi.RelatableEntity, propertyPath []string) (*oapi.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}

	// Special handling for common oapi entity types
	switch entity.GetType() {
	case "resource":
		return getResourceProperty(entity.GetResource(), propertyPath)
	case "deployment":
		return getDeploymentProperty(entity.GetDeployment(), propertyPath)
	case "environment":
		return getEnvironmentProperty(entity.GetEnvironment(), propertyPath)
	default:
		// Fall back to reflection for other types
		return nil, fmt.Errorf("unsupported entity type: %s", entity.GetType())
	}
}

// getResourceProperty gets a property from a Resource entity
func getResourceProperty(resource *oapi.Resource, propertyPath []string) (*oapi.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}
	firstKey := strings.ToLower(propertyPath[0])
	switch firstKey {
	case "id":
		return convertValue(resource.Id)
	case "name":
		return convertValue(resource.Name)
	case "version":
		return convertValue(resource.Version)
	case "kind":
		return convertValue(resource.Kind)
	case "identifier":
		return convertValue(resource.Identifier)
	case "workspace_id", "workspaceid":
		return convertValue(resource.WorkspaceId)
	case "provider_id", "providerid":
		if resource.ProviderId != nil {
			return convertValue(*resource.ProviderId)
		}
		return nil, fmt.Errorf("provider_id is nil")
	case "metadata":
		if len(propertyPath) == 1 {
			return convertValue(resource.Metadata)
		}
		if len(propertyPath) == 2 {
			if val, ok := resource.Metadata[propertyPath[1]]; ok {
				return convertValue(val)
			}
			return nil, fmt.Errorf("metadata key %s not found", propertyPath[1])
		}
		return nil, fmt.Errorf("metadata path too deep: %v", propertyPath)
	case "config":
		if len(propertyPath) == 1 {
			return convertValue(resource.Config)
		}
		value, err := getMapValue(resource.Config, propertyPath[1:])
		if err != nil {
			return nil, err
		}
		return convertValue(value)
	default:
		return getPropertyReflection(resource, propertyPath)
	}
}

// getDeploymentProperty gets a property from a Deployment entity
func getDeploymentProperty(deployment *oapi.Deployment, propertyPath []string) (*oapi.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}

	firstKey := strings.ToLower(propertyPath[0])
	switch firstKey {
	case "id":
		return convertValue(deployment.Id)
	case "name":
		return convertValue(deployment.Name)
	case "slug":
		return convertValue(deployment.Slug)
	case "description":
		if deployment.Description != nil {
			return convertValue(*deployment.Description)
		}
		return nil, fmt.Errorf("description is nil")
	case "system_id", "systemid":
		return convertValue(deployment.SystemId)
	case "job_agent_id", "jobagentid":
		if deployment.JobAgentId != nil {
			return convertValue(*deployment.JobAgentId)
		}
		return nil, fmt.Errorf("job_agent_id is nil")
	case "job_agent_config", "jobagentconfig":
		if len(propertyPath) == 1 {
			return convertValue(deployment.JobAgentConfig)
		}
		jobAgentConfigJSON, err := json.Marshal(deployment.JobAgentConfig)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal deployment job agent config: %v", err)
		}

		var jobAgentConfigMap map[string]any
		err = json.Unmarshal(jobAgentConfigJSON, &jobAgentConfigMap)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal deployment job agent config: %v", err)
		}
		value, err := getMapValue(jobAgentConfigMap, propertyPath[1:])
		if err != nil {
			return nil, err
		}
		return convertValue(value)
	case "metadata":
		if len(propertyPath) == 1 {
			return convertValue(deployment.Metadata)
		}
		if len(propertyPath) == 2 {
			if val, ok := deployment.Metadata[propertyPath[1]]; ok {
				return convertValue(val)
			}
			return nil, fmt.Errorf("metadata key %s not found", propertyPath[1])
		}
		return nil, fmt.Errorf("metadata path too deep: %v", propertyPath)
	default:
		return getPropertyReflection(deployment, propertyPath)
	}
}

// getEnvironmentProperty gets a property from an Environment entity
func getEnvironmentProperty(environment *oapi.Environment, propertyPath []string) (*oapi.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}

	firstKey := strings.ToLower(propertyPath[0])
	switch firstKey {
	case "id":
		return convertValue(environment.Id)
	case "name":
		return convertValue(environment.Name)
	case "description":
		if environment.Description != nil {
			return convertValue(*environment.Description)
		}
		return nil, fmt.Errorf("description is nil")
	case "system_id", "systemid":
		return convertValue(environment.SystemId)
	case "metadata":
		if len(propertyPath) == 1 {
			return convertValue(environment.Metadata)
		}
		if len(propertyPath) == 2 {
			if val, ok := environment.Metadata[propertyPath[1]]; ok {
				return convertValue(val)
			}
			return nil, fmt.Errorf("metadata key %s not found", propertyPath[1])
		}
		return nil, fmt.Errorf("metadata path too deep: %v", propertyPath)
	default:
		return getPropertyReflection(environment, propertyPath)
	}
}

// getMapValue extracts a value from a map using a property path
func getMapValue(m map[string]any, propertyPath []string) (any, error) {
	if m == nil {
		return nil, fmt.Errorf("map is nil")
	}

	if len(propertyPath) == 0 {
		return m, nil
	}

	value, ok := m[propertyPath[0]]
	if !ok {
		return nil, fmt.Errorf("field %s not found in map", propertyPath[0])
	}

	// If this is the last element in the path, return the value
	if len(propertyPath) == 1 {
		return value, nil
	}

	// Otherwise, continue traversing if it's a nested map
	if nestedMap, ok := value.(map[string]any); ok {
		return getMapValue(nestedMap, propertyPath[1:])
	}

	return nil, fmt.Errorf("cannot traverse further: %s is not a map", propertyPath[0])
}

func extractValueAsString(vv *oapi.LiteralValue) string {
	if vv == nil {
		return ""
	}

	// Try each variant of LiteralValue
	if strVal, err := vv.AsStringValue(); err == nil {
		return strVal
	}
	if boolVal, err := vv.AsBooleanValue(); err == nil {
		return fmt.Sprintf("%t", boolVal)
	}
	if numVal, err := vv.AsNumberValue(); err == nil {
		return fmt.Sprintf("%f", numVal)
	}
	if intVal, err := vv.AsIntegerValue(); err == nil {
		return strconv.Itoa(intVal)
	}
	if objVal, err := vv.AsObjectValue(); err == nil {
		jsonBytes, err := json.Marshal(objVal)
		if err != nil {
			return fmt.Sprintf("error marshalling object: %v", err)
		}
		return string(jsonBytes)
	}
	if _, err := vv.AsNullValue(); err == nil {
		return "null"
	}

	return "unknown"
}

// getPropertyReflection uses reflection to get a property value (fallback method)
func getPropertyReflection(entity any, propertyPath []string) (*oapi.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return convertValue(entity)
	}

	v := reflect.ValueOf(entity)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return nil, fmt.Errorf("entity is not a struct")
	}

	// Get the first property
	fieldName := propertyPath[0]
	field := v.FieldByName(fieldName)
	if !field.IsValid() {
		// Try case-insensitive match
		field = v.FieldByNameFunc(func(name string) bool {
			return strings.EqualFold(name, fieldName)
		})
		if !field.IsValid() {
			return nil, fmt.Errorf("field %s not found", fieldName)
		}
	}

	// If this is the last element, return the field value
	if len(propertyPath) == 1 {
		return convertValue(field.Interface())
	}

	return getPropertyReflection(field.Interface(), propertyPath[1:])
}

// convertValue converts a Go value to an oapi.LiteralValue
func convertValue(val any) (*oapi.LiteralValue, error) {
	switch v := val.(type) {
	case *oapi.LiteralValue:
		return v, nil
	case string:
		lv := &oapi.LiteralValue{}
		err := lv.FromStringValue(v)
		return lv, err
	case float64:
		lv := &oapi.LiteralValue{}
		err := lv.FromNumberValue(float32(v))
		return lv, err
	case float32:
		lv := &oapi.LiteralValue{}
		err := lv.FromNumberValue(v)
		return lv, err
	case int:
		lv := &oapi.LiteralValue{}
		err := lv.FromIntegerValue(v)
		return lv, err
	case int32:
		lv := &oapi.LiteralValue{}
		err := lv.FromIntegerValue(int(v))
		return lv, err
	case int64:
		lv := &oapi.LiteralValue{}
		err := lv.FromIntegerValue(int(v))
		return lv, err
	case bool:
		lv := &oapi.LiteralValue{}
		err := lv.FromBooleanValue(v)
		return lv, err
	case map[string]any:
		lv := &oapi.LiteralValue{}
		err := lv.FromObjectValue(oapi.ObjectValue{Object: v})
		return lv, err
	case map[string]string:
		// Convert map[string]string to map[string]any
		m := make(map[string]any, len(v))
		for k, val := range v {
			m[k] = val
		}
		lv := &oapi.LiteralValue{}
		err := lv.FromObjectValue(oapi.ObjectValue{Object: m})
		return lv, err
	case nil:
		lv := &oapi.LiteralValue{}
		err := lv.FromNullValue(true)
		return lv, err
	default:
		return nil, fmt.Errorf("unexpected variable value type: %T", val)
	}
}
