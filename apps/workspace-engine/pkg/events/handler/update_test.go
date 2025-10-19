package handler

import (
	"reflect"
	"testing"
)

type TestEntity struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Count       int    `json:"count"`
	Active      bool   `json:"active"`
	Tags        []string
}

type NestedEntity struct {
	ID     string `json:"id"`
	Value  int    `json:"value"`
	Nested *TestEntity
}

func TestMergeFields_BasicFieldUpdate(t *testing.T) {
	target := &TestEntity{
		Name:        "Original",
		Description: "Original Desc",
		Count:       5,
		Active:      true,
		Tags:        []string{"tag1"},
	}

	source := &TestEntity{
		Name:        "Updated",
		Description: "Updated Desc",
		Count:       10,
		Active:      false,
		Tags:        []string{"tag2", "tag3"},
	}

	result, err := MergeFields(target, source, []string{"Name", "Count"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	// Updated fields
	if result.Name != "Updated" {
		t.Errorf("Expected Name to be 'Updated', got '%s'", result.Name)
	}
	if result.Count != 10 {
		t.Errorf("Expected Count to be 10, got %d", result.Count)
	}

	// Unchanged fields
	if result.Description != "Original Desc" {
		t.Errorf("Expected Description to be 'Original Desc', got '%s'", result.Description)
	}
	if result.Active != true {
		t.Errorf("Expected Active to be true, got %v", result.Active)
	}
	if len(result.Tags) != 1 || result.Tags[0] != "tag1" {
		t.Errorf("Expected Tags to be unchanged, got %v", result.Tags)
	}
}

func TestMergeFields_JSONTagNames(t *testing.T) {
	target := &TestEntity{
		Name:        "Original",
		Description: "Original Desc",
		Count:       5,
	}

	source := &TestEntity{
		Name:        "Updated",
		Description: "Updated Desc",
		Count:       10,
	}

	// Use JSON tag names instead of struct field names
	result, err := MergeFields(target, source, []string{"name", "count"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	// Updated fields via JSON tags
	if result.Name != "Updated" {
		t.Errorf("Expected Name to be 'Updated', got '%s'", result.Name)
	}
	if result.Count != 10 {
		t.Errorf("Expected Count to be 10, got %d", result.Count)
	}

	// Unchanged field
	if result.Description != "Original Desc" {
		t.Errorf("Expected Description to be 'Original Desc', got '%s'", result.Description)
	}
}

func TestMergeFields_MixedFieldNamesAndJSONTags(t *testing.T) {
	target := &TestEntity{
		Name:        "Original",
		Description: "Original Desc",
		Count:       5,
		Active:      true,
	}

	source := &TestEntity{
		Name:        "Updated",
		Description: "Updated Desc",
		Count:       10,
		Active:      false,
	}

	// Mix struct field names and JSON tag names
	result, err := MergeFields(target, source, []string{"Name", "count", "active"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.Name != "Updated" {
		t.Errorf("Expected Name to be 'Updated', got '%s'", result.Name)
	}
	if result.Count != 10 {
		t.Errorf("Expected Count to be 10, got %d", result.Count)
	}
	if result.Active != false {
		t.Errorf("Expected Active to be false, got %v", result.Active)
	}
	if result.Description != "Original Desc" {
		t.Errorf("Expected Description to be unchanged, got '%s'", result.Description)
	}
}

func TestMergeFields_UnknownFields(t *testing.T) {
	target := &TestEntity{
		Name:  "Original",
		Count: 5,
	}

	source := &TestEntity{
		Name:  "Updated",
		Count: 10,
	}

	// Include unknown fields - should be skipped without error
	result, err := MergeFields(target, source, []string{"Name", "UnknownField", "AnotherBadField"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.Name != "Updated" {
		t.Errorf("Expected Name to be 'Updated', got '%s'", result.Name)
	}
	if result.Count != 5 {
		t.Errorf("Expected Count to remain 5, got %d", result.Count)
	}
}

func TestMergeFields_EmptyFieldsList(t *testing.T) {
	target := &TestEntity{
		Name:        "Original",
		Description: "Original Desc",
		Count:       5,
	}

	source := &TestEntity{
		Name:        "Updated",
		Description: "Updated Desc",
		Count:       10,
	}

	// Empty fields list - no fields should be updated
	result, err := MergeFields(target, source, []string{})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.Name != "Original" {
		t.Errorf("Expected Name to be 'Original', got '%s'", result.Name)
	}
	if result.Description != "Original Desc" {
		t.Errorf("Expected Description to be 'Original Desc', got '%s'", result.Description)
	}
	if result.Count != 5 {
		t.Errorf("Expected Count to be 5, got %d", result.Count)
	}
}

func TestMergeFields_AllFields(t *testing.T) {
	target := &TestEntity{
		Name:        "Original",
		Description: "Original Desc",
		Count:       5,
		Active:      true,
		Tags:        []string{"tag1"},
	}

	source := &TestEntity{
		Name:        "Updated",
		Description: "Updated Desc",
		Count:       10,
		Active:      false,
		Tags:        []string{"tag2"},
	}

	// Update all fields
	result, err := MergeFields(target, source, []string{"Name", "Description", "Count", "Active", "Tags"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.Name != "Updated" {
		t.Errorf("Expected Name to be 'Updated', got '%s'", result.Name)
	}
	if result.Description != "Updated Desc" {
		t.Errorf("Expected Description to be 'Updated Desc', got '%s'", result.Description)
	}
	if result.Count != 10 {
		t.Errorf("Expected Count to be 10, got %d", result.Count)
	}
	if result.Active != false {
		t.Errorf("Expected Active to be false, got %v", result.Active)
	}
	if len(result.Tags) != 1 || result.Tags[0] != "tag2" {
		t.Errorf("Expected Tags to be ['tag2'], got %v", result.Tags)
	}
}

func TestMergeFields_NestedStructs(t *testing.T) {
	target := &NestedEntity{
		ID:    "target-id",
		Value: 100,
		Nested: &TestEntity{
			Name:  "Target Nested",
			Count: 5,
		},
	}

	source := &NestedEntity{
		ID:    "source-id",
		Value: 200,
		Nested: &TestEntity{
			Name:  "Source Nested",
			Count: 10,
		},
	}

	// Update only the Nested field
	result, err := MergeFields(target, source, []string{"Nested"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.ID != "target-id" {
		t.Errorf("Expected ID to be 'target-id', got '%s'", result.ID)
	}
	if result.Value != 100 {
		t.Errorf("Expected Value to be 100, got %d", result.Value)
	}
	if result.Nested == nil {
		t.Fatal("Expected Nested to not be nil")
	}
	if result.Nested.Name != "Source Nested" {
		t.Errorf("Expected Nested.Name to be 'Source Nested', got '%s'", result.Nested.Name)
	}
	if result.Nested.Count != 10 {
		t.Errorf("Expected Nested.Count to be 10, got %d", result.Nested.Count)
	}
}

func TestMergeFields_ZeroValues(t *testing.T) {
	target := &TestEntity{
		Name:   "Original",
		Count:  5,
		Active: true,
	}

	source := &TestEntity{
		Name:   "",    // Zero value for string
		Count:  0,     // Zero value for int
		Active: false, // Zero value for bool
	}

	// Update with zero values - should update to zero values
	result, err := MergeFields(target, source, []string{"Name", "Count", "Active"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.Name != "" {
		t.Errorf("Expected Name to be empty string, got '%s'", result.Name)
	}
	if result.Count != 0 {
		t.Errorf("Expected Count to be 0, got %d", result.Count)
	}
	if result.Active != false {
		t.Errorf("Expected Active to be false, got %v", result.Active)
	}
}

func TestMergeFields_SliceUpdate(t *testing.T) {
	target := &TestEntity{
		Name: "Original",
		Tags: []string{"tag1", "tag2"},
	}

	source := &TestEntity{
		Name: "Updated",
		Tags: []string{"tag3", "tag4", "tag5"},
	}

	result, err := MergeFields(target, source, []string{"Tags"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	if result.Name != "Original" {
		t.Errorf("Expected Name to be 'Original', got '%s'", result.Name)
	}
	if len(result.Tags) != 3 {
		t.Errorf("Expected Tags to have 3 elements, got %d", len(result.Tags))
	}
	if result.Tags[0] != "tag3" || result.Tags[1] != "tag4" || result.Tags[2] != "tag5" {
		t.Errorf("Expected Tags to be ['tag3', 'tag4', 'tag5'], got %v", result.Tags)
	}
}

func TestMergeFields_DoesNotModifyOriginal(t *testing.T) {
	target := &TestEntity{
		Name:  "Original",
		Count: 5,
	}

	source := &TestEntity{
		Name:  "Updated",
		Count: 10,
	}

	result, err := MergeFields(target, source, []string{"Name", "Count"})
	if err != nil {
		t.Fatalf("MergeFields failed: %v", err)
	}

	// Verify target is unchanged
	if target.Name != "Original" {
		t.Errorf("Target Name was modified, expected 'Original', got '%s'", target.Name)
	}
	if target.Count != 5 {
		t.Errorf("Target Count was modified, expected 5, got %d", target.Count)
	}

	// Verify result has updated values
	if result.Name != "Updated" {
		t.Errorf("Result Name expected 'Updated', got '%s'", result.Name)
	}
	if result.Count != 10 {
		t.Errorf("Result Count expected 10, got %d", result.Count)
	}
}

func TestBuildFieldMap(t *testing.T) {
	entity := TestEntity{}
	entityType := reflect.TypeOf(entity)

	fieldMap := buildFieldMap(entityType)

	// Check struct field names
	if _, exists := fieldMap["Name"]; !exists {
		t.Error("Expected 'Name' field to exist in map")
	}
	if _, exists := fieldMap["Description"]; !exists {
		t.Error("Expected 'Description' field to exist in map")
	}
	if _, exists := fieldMap["Count"]; !exists {
		t.Error("Expected 'Count' field to exist in map")
	}
	if _, exists := fieldMap["Active"]; !exists {
		t.Error("Expected 'Active' field to exist in map")
	}
	if _, exists := fieldMap["Tags"]; !exists {
		t.Error("Expected 'Tags' field to exist in map")
	}

	// Check JSON tag names
	if _, exists := fieldMap["name"]; !exists {
		t.Error("Expected 'name' JSON tag to exist in map")
	}
	if _, exists := fieldMap["description"]; !exists {
		t.Error("Expected 'description' JSON tag to exist in map")
	}
	if _, exists := fieldMap["count"]; !exists {
		t.Error("Expected 'count' JSON tag to exist in map")
	}
	if _, exists := fieldMap["active"]; !exists {
		t.Error("Expected 'active' JSON tag to exist in map")
	}

	// Verify field indices match
	nameIndex := fieldMap["Name"]
	jsonNameIndex := fieldMap["name"]
	if nameIndex != jsonNameIndex {
		t.Errorf("Expected 'Name' and 'name' to map to same index, got %d and %d", nameIndex, jsonNameIndex)
	}
}
