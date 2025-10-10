package db

import (
	"encoding/json"
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
