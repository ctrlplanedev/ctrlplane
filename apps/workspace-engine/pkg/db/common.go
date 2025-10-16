package db

import (
	"encoding/json"

	"workspace-engine/pkg/oapi"
)

func parseJSONToStruct(jsonData []byte) map[string]interface{} {
	if len(jsonData) == 0 {
		return nil
	}

	var dataMap map[string]interface{}
	if err := json.Unmarshal(jsonData, &dataMap); err != nil {
		return nil
	}

	return dataMap
}

// wrapSelectorFromDB wraps an unwrapped ResourceCondition from the database
// into JsonSelector format. The database stores JSON selectors in unwrapped format
// (just the condition tree without the "json" wrapper).
func wrapSelectorFromDB(selector *oapi.Selector) error {
	if selector == nil {
		return nil
	}

	// Get the raw unwrapped selector data from the database
	var rawMap map[string]interface{}
	selectorBytes, err := selector.MarshalJSON()
	if err != nil {
		return err
	}

	if err := json.Unmarshal(selectorBytes, &rawMap); err != nil {
		return err
	}

	// It's an unwrapped ResourceCondition from the database, wrap it in JsonSelector format
	wrappedSelector := oapi.JsonSelector{
		Json: rawMap,
	}

	return selector.FromJsonSelector(wrappedSelector)
}

// unwrapSelectorForDB extracts the inner condition from a JsonSelector for database storage.
// The database stores JSON selectors in unwrapped ResourceCondition format.
// NOTE: CEL selectors are not currently supported - they will be written as NULL to the database.
func unwrapSelectorForDB(selector *oapi.Selector) (map[string]interface{}, error) {
	if selector == nil {
		return nil, nil
	}

	// Try as JsonSelector
	jsonSelector, err := selector.AsJsonSelector()
	if err == nil && jsonSelector.Json != nil {
		// Return the unwrapped map directly - pgx can handle it
		return jsonSelector.Json, nil
	}

	// CEL selectors are not supported - return nil to store NULL in database
	// TODO: Add support for CEL selectors in the future
	return nil, nil
}
