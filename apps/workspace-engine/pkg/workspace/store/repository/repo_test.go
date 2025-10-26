package repository

import (
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNew_AllFieldsInitialized(t *testing.T) {
	repo := New()

	require.NotNil(t, repo, "New() returned nil repository")

	// Use reflection to check all fields are non-nil
	v := reflect.ValueOf(repo).Elem()
	typ := v.Type()

	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldName := typ.Field(i).Name

		// Check if the field is nil
		if field.Kind() == reflect.Ptr || field.Kind() == reflect.Interface || field.Kind() == reflect.Map || field.Kind() == reflect.Slice {
			assert.False(t, field.IsNil(), "Field %s is nil, expected to be initialized", fieldName)
		}

		// For struct types (like ConcurrentMap), check they're not zero value
		if field.Kind() == reflect.Struct {
			assert.False(t, field.IsZero(), "Field %s is zero value, expected to be initialized", fieldName)
		}
	}
}

func TestRouter(t *testing.T) {
	repo := New()

	router := repo.Router()
	assert.NotNil(t, router, "Router() returned nil")
}

func TestRepositoryFields_NotNil(t *testing.T) {
	repo := New()

	// Use reflection to dynamically get all fields
	v := reflect.ValueOf(repo).Elem()
	typ := v.Type()

	// Test each field individually for better error messages
	for i := 0; i < v.NumField(); i++ {
		field := v.Field(i)
		fieldName := typ.Field(i).Name

		t.Run(fieldName, func(t *testing.T) {
			// Check for nil pointers
			if field.Kind() == reflect.Ptr {
				assert.False(t, field.IsNil(), "%s is nil", fieldName)
			}

			// Check for zero value structs
			if field.Kind() == reflect.Struct {
				assert.False(t, field.IsZero(), "%s is zero value", fieldName)
			}
		})
	}
}
