package relationships

import (
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"workspace-engine/pkg/pb"

	"google.golang.org/protobuf/types/known/structpb"
)

// GetPropertyValue extracts a property value from an entity using a property path
// The property path is a slice of strings representing nested property access
// Examples: ["id"], ["metadata", "region"], ["config", "networking", "vpc_id"]
func GetPropertyValue(entity any, propertyPath []string) (*pb.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}

	// Special handling for common protobuf entity types
	switch e := entity.(type) {
	case *pb.Resource:
		return getResourceProperty(e, propertyPath)
	case *pb.Deployment:
		return getDeploymentProperty(e, propertyPath)
	case *pb.Environment:
		return getEnvironmentProperty(e, propertyPath)
	default:
		// Fall back to reflection for other types
		return getPropertyReflection(entity, propertyPath)
	}
}

// getResourceProperty gets a property from a Resource entity
func getResourceProperty(resource *pb.Resource, propertyPath []string) (*pb.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}
	firstKey := strings.ToLower(propertyPath[0])
	switch firstKey {
	case "id":
		return pb.ConvertValue(resource.Id)
	case "name":
		return pb.ConvertValue(resource.Name)
	case "version":
		return pb.ConvertValue(resource.Version)
	case "kind":
		return pb.ConvertValue(resource.Kind)
	case "identifier":
		return pb.ConvertValue(resource.Identifier)
	case "workspace_id", "workspaceid":
		return pb.ConvertValue(resource.WorkspaceId)
	case "provider_id", "providerid":
		if resource.ProviderId != nil {
			return pb.ConvertValue(*resource.ProviderId)
		}
		return nil, fmt.Errorf("provider_id is nil")
	case "metadata":
		if len(propertyPath) == 1 {
			return pb.ConvertValue(resource.Metadata)
		}
		if len(propertyPath) == 2 {
			if val, ok := resource.Metadata[propertyPath[1]]; ok {
				return pb.ConvertValue(val)
			}
			return nil, fmt.Errorf("metadata key %s not found", propertyPath[1])
		}
		return nil, fmt.Errorf("metadata path too deep: %v", propertyPath)
	case "config":
		if len(propertyPath) == 1 {
			return pb.ConvertValue(resource.Config)
		}
		value, err := getStructPBValue(resource.Config, propertyPath[1:])
		if err != nil {
			return nil, err
		}
		return pb.ConvertValue(value)
	case "variables":
		if len(propertyPath) == 1 {
			return pb.ConvertValue(resource.Variables)
		}
		if len(propertyPath) == 2 {
			if val, ok := resource.Variables[propertyPath[1]]; ok {
				return pb.ConvertValue(val)
			}
			return nil, fmt.Errorf("variable key %s not found", propertyPath[1])
		}
		return nil, fmt.Errorf("variables path too deep: %v", propertyPath)
	default:
		return getPropertyReflection(resource, propertyPath)
	}
}

// getDeploymentProperty gets a property from a Deployment entity
func getDeploymentProperty(deployment *pb.Deployment, propertyPath []string) (*pb.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}

	firstKey := strings.ToLower(propertyPath[0])
	switch firstKey {
	case "id":
		return pb.ConvertValue(deployment.Id)
	case "name":
		return pb.ConvertValue(deployment.Name)
	case "slug":
		return pb.ConvertValue(deployment.Slug)
	case "description":
		if deployment.Description != nil {
			return pb.ConvertValue(*deployment.Description)
		}
		return nil, fmt.Errorf("description is nil")
	case "system_id", "systemid":
		return pb.ConvertValue(deployment.SystemId)
	case "job_agent_id", "jobagentid":
		if deployment.JobAgentId != nil {
			return pb.ConvertValue(*deployment.JobAgentId)
		}
		return nil, fmt.Errorf("job_agent_id is nil")
	case "job_agent_config", "jobagentconfig":
		if len(propertyPath) == 1 {
			return pb.ConvertValue(deployment.JobAgentConfig)
		}
		value, err := getStructPBValue(deployment.JobAgentConfig, propertyPath[1:])
		if err != nil {
			return nil, err
		}
		return pb.ConvertValue(value)
	default:
		return getPropertyReflection(deployment, propertyPath)
	}
}

// getEnvironmentProperty gets a property from an Environment entity
func getEnvironmentProperty(environment *pb.Environment, propertyPath []string) (*pb.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return nil, fmt.Errorf("property path is empty")
	}

	firstKey := strings.ToLower(propertyPath[0])
	switch firstKey {
	case "id":
		return pb.ConvertValue(environment.Id)
	case "name":
		return pb.ConvertValue(environment.Name)
	case "description":
		if environment.Description != nil {
			return pb.ConvertValue(*environment.Description)
		}
		return nil, fmt.Errorf("description is nil")
	case "system_id", "systemid":
		return pb.ConvertValue(environment.SystemId)
	default:
		return getPropertyReflection(environment, propertyPath)
	}
}

// getStructPBValue extracts a value from a structpb.Struct using a property path
func getStructPBValue(s *structpb.Struct, propertyPath []string) (any, error) {
	if s == nil {
		return nil, fmt.Errorf("struct is nil")
	}

	if len(propertyPath) == 0 {
		return s, nil
	}

	fields := s.GetFields()
	if fields == nil {
		return nil, fmt.Errorf("struct fields are nil")
	}

	value, ok := fields[propertyPath[0]]
	if !ok {
		return nil, fmt.Errorf("field %s not found in struct", propertyPath[0])
	}

	// If this is the last element in the path, return the value
	if len(propertyPath) == 1 {
		return extractStructPBValue(value), nil
	}

	// Otherwise, continue traversing if it's a nested struct
	if nestedStruct := value.GetStructValue(); nestedStruct != nil {
		return getStructPBValue(nestedStruct, propertyPath[1:])
	}

	return nil, fmt.Errorf("cannot traverse further: %s is not a struct", propertyPath[0])
}

// extractStructPBValue extracts the actual Go value from a structpb.Value
func extractStructPBValue(value *structpb.Value) any {
	switch v := value.GetKind().(type) {
	case *structpb.Value_StringValue:
		return v.StringValue
	case *structpb.Value_NumberValue:
		return v.NumberValue
	case *structpb.Value_BoolValue:
		return v.BoolValue
	case *structpb.Value_NullValue:
		return nil
	case *structpb.Value_ListValue:
		return v.ListValue
	case *structpb.Value_StructValue:
		return v.StructValue
	default:
		return value
	}
}

func extractValueAsString(vv *pb.LiteralValue) string {
	if vv == nil {
		return ""
	}
	switch v := vv.Data.(type) {
	case *pb.LiteralValue_String_:
		return v.String_
	case *pb.LiteralValue_Bool:
		return fmt.Sprintf("%t", v.Bool)
	case *pb.LiteralValue_Double:
		return fmt.Sprintf("%f", v.Double)
	case *pb.LiteralValue_Int64:
		return strconv.Itoa(int(v.Int64))
	case *pb.LiteralValue_Object:
		json, err := v.Object.MarshalJSON()
		if err != nil {
			return fmt.Sprintf("error marshalling object: %v", err)
		}
		return string(json)
	case *pb.LiteralValue_Null:
		return "null"
	default:
		return "unknown"
	}
}

// getPropertyReflection uses reflection to get a property value (fallback method)
func getPropertyReflection(entity any, propertyPath []string) (*pb.LiteralValue, error) {
	if len(propertyPath) == 0 {
		return pb.ConvertValue(entity)
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
		return pb.ConvertValue(field.Interface())
	}

	val, err := getPropertyReflection(field.Interface(), propertyPath[1:])
	if err != nil {
		return nil, err
	}
	return pb.ConvertValue(val)
}
