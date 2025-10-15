package util

import (
	"fmt"
	"reflect"
	"strings"
	"time"
)

func GetProperty(entity any, fieldName string) (reflect.Value, error) {
	v := reflect.ValueOf(entity)
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return reflect.Value{}, fmt.Errorf("entity must be a struct or pointer to struct")
	}

	// First try to find field by name
	field := v.FieldByName(fieldName)
	if !field.IsValid() {
		// If not found, look for field with matching json tag
		t := v.Type()
		for i := 0; i < t.NumField(); i++ {
			f := t.Field(i)
			if tag := f.Tag.Get("json"); tag != "" {
				// JSON tags may have options like "fieldname,omitempty"
				// We only care about the field name part
				tagName := strings.Split(tag, ",")[0]
				if tagName == fieldName {
					field = v.Field(i)
					break
				}
			}
		}
		if !field.IsValid() {
			return reflect.Value{}, fmt.Errorf("field %s not found", fieldName)
		}
	}

	return field, nil
}

func GetStringProperty(entity any, fieldName string) (string, error) {
	field, err := GetProperty(entity, fieldName)
	if err != nil {
		return "", err
	}

	if field.Kind() != reflect.String {
		return "", fmt.Errorf("field %s is not a string", fieldName)
	}

	return field.String(), nil
}

func GetDateProperty(entity any, fieldName string) (time.Time, error) {
	field, err := GetProperty(entity, fieldName)
	if err != nil {
		return time.Time{}, err
	}

	// Handle time.Time directly
	if field.Type() == reflect.TypeOf(time.Time{}) {
		return field.Interface().(time.Time), nil
	}

	// Handle *time.Time
	if field.Type() == reflect.TypeOf((*time.Time)(nil)) {
		if field.IsNil() {
			return time.Time{}, fmt.Errorf("field %s is nil", fieldName)
		}
		return field.Elem().Interface().(time.Time), nil
	}

	// Handle string (for backward compatibility)
	if field.Kind() == reflect.String {
		return time.Parse(time.RFC3339, field.String())
	}

	return time.Time{}, fmt.Errorf("field %s is not a time.Time or string", fieldName)
}
