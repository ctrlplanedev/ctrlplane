package db

import (
	"encoding/json"

	"google.golang.org/protobuf/types/known/structpb"
)

func parseJSONToStruct(jsonData []byte) *structpb.Struct {
	if len(jsonData) == 0 {
		return nil
	}

	var dataMap map[string]interface{}
	if err := json.Unmarshal(jsonData, &dataMap); err != nil {
		return nil
	}

	if structData, err := structpb.NewStruct(dataMap); err == nil {
		return structData
	}
	return nil
}
