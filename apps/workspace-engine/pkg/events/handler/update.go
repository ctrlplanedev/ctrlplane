package handler

import (
	"reflect"
	"strings"
)

// mergeFields creates a new entity by copying target and updating specified fields from source
func MergeFields[T any](target, source *T, fieldsToUpdate []string) (*T, error) {
	result := new(T)
	
	// Copy all fields from target to result
	targetValue := reflect.ValueOf(target).Elem()
	resultValue := reflect.ValueOf(result).Elem()
	resultValue.Set(targetValue)

	// Build field name lookup map (supports both struct names and JSON tag names)
	fieldMap := buildFieldMap(resultValue.Type())

	// Update only the specified fields from source
	sourceValue := reflect.ValueOf(source).Elem()
	for _, fieldName := range fieldsToUpdate {
		fieldIndex, exists := fieldMap[fieldName]
		if !exists {
			continue // Skip unknown fields
		}

		resultField := resultValue.Field(fieldIndex)
		if !resultField.CanSet() {
			continue // Skip unsettable fields
		}

		resultField.Set(sourceValue.Field(fieldIndex))
	}

	return result, nil
}

// buildFieldMap creates a map of field names to their indices
// Includes both the struct field name and JSON tag name
func buildFieldMap(t reflect.Type) map[string]int {
	fieldMap := make(map[string]int)
	
	for i := 0; i < t.NumField(); i++ {
		field := t.Field(i)
		
		// Add struct field name
		fieldMap[field.Name] = i
		
		// Add JSON tag name if present
		if jsonTag := field.Tag.Get("json"); jsonTag != "" {
			jsonName := strings.Split(jsonTag, ",")[0]
			if jsonName != "" && jsonName != "-" {
				fieldMap[jsonName] = i
			}
		}
	}
	
	return fieldMap
}


