package variableresolver

import (
	"fmt"
	"workspace-engine/pkg/oapi"
)

// getMapProperty traverses a map[string]any by the given path and converts
// the final value to an oapi.LiteralValue.
func getMapProperty(m map[string]any, path []string) (*oapi.LiteralValue, error) {
	var current any = m
	for _, key := range path {
		switch v := current.(type) {
		case map[string]any:
			val, ok := v[key]
			if !ok {
				return nil, fmt.Errorf("key %q not found", key)
			}
			current = val
		case map[string]string:
			val, ok := v[key]
			if !ok {
				return nil, fmt.Errorf("key %q not found", key)
			}
			current = val
		default:
			return nil, fmt.Errorf("cannot traverse into %T for key %q", current, key)
		}
	}
	return convertValue(current)
}

// convertValue converts a Go value to an oapi.LiteralValue.
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
