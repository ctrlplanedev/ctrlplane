package variableresolver

import (
	"fmt"
	"reflect"
	"strings"
	"workspace-engine/pkg/oapi"
)

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

