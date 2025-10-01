package util

import (
	"reflect"
	"testing"
	"time"
)

func TestGetProperty(t *testing.T) {
	type testStruct struct {
		StringField string
		IntField    int
		TaggedField string `json:"tagged"`
	}

	entity := testStruct{
		StringField: "hello",
		IntField:    123,
		TaggedField: "tagged-value",
	}
	entityPtr := &entity

	tests := []struct {
		name      string
		entity    any
		fieldName string
		want      any
		wantErr   bool
	}{
		{
			name:      "get string field from struct",
			entity:    entity,
			fieldName: "StringField",
			want:      "hello",
			wantErr:   false,
		},
		{
			name:      "get int field from struct",
			entity:    entity,
			fieldName: "IntField",
			want:      123,
			wantErr:   false,
		},
		{
			name:      "get field from pointer to struct",
			entity:    entityPtr,
			fieldName: "StringField",
			want:      "hello",
			wantErr:   false,
		},
		{
			name:      "get field by json tag",
			entity:    entity,
			fieldName: "tagged",
			want:      "tagged-value",
			wantErr:   false,
		},
		{
			name:      "field not found",
			entity:    entity,
			fieldName: "NonExistentField",
			wantErr:   true,
		},
		{
			name:      "entity is not a struct",
			entity:    "not a struct",
			fieldName: "someField",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetProperty(tt.entity, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("getProperty() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr {
				if !reflect.DeepEqual(got.Interface(), tt.want) {
					t.Errorf("getProperty() = %v, want %v", got.Interface(), tt.want)
				}
			}
		})
	}
}

func TestGetStringProperty(t *testing.T) {
	type testStruct struct {
		StringField string
		IntField    int
	}

	entity := testStruct{
		StringField: "hello",
		IntField:    123,
	}

	tests := []struct {
		name      string
		entity    any
		fieldName string
		want      string
		wantErr   bool
	}{
		{
			name:      "get string property",
			entity:    entity,
			fieldName: "StringField",
			want:      "hello",
			wantErr:   false,
		},
		{
			name:      "field is not a string",
			entity:    entity,
			fieldName: "IntField",
			wantErr:   true,
		},
		{
			name:      "field not found",
			entity:    entity,
			fieldName: "NonExistentField",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetStringProperty(tt.entity, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("getStringProperty() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && got != tt.want {
				t.Errorf("getStringProperty() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestGetDateProperty(t *testing.T) {
	now := time.Now()
	nowRFC3339 := now.Format(time.RFC3339)
	parsedTime, _ := time.Parse(time.RFC3339, nowRFC3339)

	type testStruct struct {
		DateField      string
		NotADateField  string
		NotStringField int
	}

	entity := testStruct{
		DateField:      nowRFC3339,
		NotADateField:  "not a date",
		NotStringField: 123,
	}

	tests := []struct {
		name      string
		entity    any
		fieldName string
		want      time.Time
		wantErr   bool
	}{
		{
			name:      "get date property",
			entity:    entity,
			fieldName: "DateField",
			want:      parsedTime,
			wantErr:   false,
		},
		{
			name:      "invalid date format",
			entity:    entity,
			fieldName: "NotADateField",
			wantErr:   true,
		},
		{
			name:      "field is not a string",
			entity:    entity,
			fieldName: "NotStringField",
			wantErr:   true,
		},
		{
			name:      "field not found",
			entity:    entity,
			fieldName: "NonExistentField",
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := GetDateProperty(tt.entity, tt.fieldName)
			if (err != nil) != tt.wantErr {
				t.Errorf("getDateProperty() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && !got.Equal(tt.want) {
				t.Errorf("getDateProperty() = %v, want %v", got, tt.want)
			}
		})
	}
}
