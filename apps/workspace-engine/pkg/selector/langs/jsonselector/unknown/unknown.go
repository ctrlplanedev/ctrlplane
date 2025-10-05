package unknown

import (
	"fmt"

	"github.com/goccy/go-json"
)

var propertyAliases = map[string]string{
	"created-at": "CreatedAt",
	"created_at": "CreatedAt",
	"createdAt": "CreatedAt",
	"deleted-at": "DeletedAt",
	"deleted_at": "DeletedAt",
	"deletedAt": "DeletedAt",
	"updated-at": "UpdatedAt",
	"updatedAt": "UpdatedAt",
	"updated_at": "UpdatedAt",
	"metadata":   "Metadata",
	"version":    "Version",
	"kind":       "Kind",
	"identifier": "Identifier",
	"name":       "Name",
	"id":         "Id",
}

type UnknownCondition struct {
	Property    string             `json:"type"`
	Operator    string             `json:"operator"`
	Value       string             `json:"value"`
	MetadataKey string             `json:"key"`
	Conditions  []UnknownCondition `json:"conditions"`
}

func (c UnknownCondition) AsMap() map[string]any {
	return map[string]any{
		"type":       c.Property,
		"operator":   c.Operator,
		"value":      c.Value,
		"key":        c.MetadataKey,
		"conditions": c.Conditions,
	}
}

func (c UnknownCondition) GetNormalizedProperty() string {
	if alias, ok := propertyAliases[c.Property]; ok {
		return alias
	}
	return c.Property
}

func ParseFromMap(selectorMap map[string]any) (UnknownCondition, error) {
	selectorJSON, err := json.Marshal(selectorMap)
	if err != nil {
		return UnknownCondition{}, fmt.Errorf("failed to marshal selector: %w", err)
	}

	var condition UnknownCondition
	if err := json.Unmarshal(selectorJSON, &condition); err != nil {
		return UnknownCondition{}, err
	}

	return condition, nil
}
