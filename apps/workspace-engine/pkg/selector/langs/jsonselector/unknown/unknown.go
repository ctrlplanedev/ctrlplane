package unknown

import (
	"encoding/json"
	"fmt"
)


type MatchableCondition interface {
	Matches(entity any) (bool, error)
}

type UnknownCondition struct {
	Property    string               `json:"type"`
	Operator    string               `json:"operator"`
	Value       string               `json:"value"`
	MetadataKey string               `json:"key"`
	Conditions  []UnknownCondition `json:"conditions"`
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