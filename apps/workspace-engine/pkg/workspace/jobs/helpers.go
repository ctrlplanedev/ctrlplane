package jobs

import (
	"encoding/json"
	"fmt"
)

func deepCopy[T any](src T) (T, error) {
	var dst T
	b, err := json.Marshal(src)
	if err != nil {
		return dst, fmt.Errorf("deep copy marshal: %w", err)
	}
	if err := json.Unmarshal(b, &dst); err != nil {
		return dst, fmt.Errorf("deep copy unmarshal: %w", err)
	}
	return dst, nil
}
