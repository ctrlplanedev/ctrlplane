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

// wrapSelectorFromDB wraps a db selector in oapi JsonSelector format
func wrapSelectorFromDB(rawMap map[string]interface{}) (*oapi.Selector, error) {
	if rawMap == nil {
		return nil, nil
	}

	// Wrap the raw map in JsonSelector format
	selector := &oapi.Selector{}
	err := selector.FromJsonSelector(oapi.JsonSelector{
		Json: rawMap,
	})
	if err != nil {
		return nil, err
	}

	return selector, nil
}

// unwrapSelectorForDB unwraps a selector for database storage (database stores unwrapped selector format)
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

func customJobAgentConfig(m map[string]interface{}) oapi.DeploymentJobAgentConfig {
	// Minimal approach for tests: force discriminator, marshal, and rely on generated UnmarshalJSON.
	payload := map[string]interface{}{}
	for k, v := range m {
		payload[k] = v
	}
	payload["type"] = "custom"

	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	var cfg oapi.DeploymentJobAgentConfig
	if err := cfg.UnmarshalJSON(b); err != nil {
		panic(err)
	}
	return cfg
}
