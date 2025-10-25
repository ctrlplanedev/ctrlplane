package changelog

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ChangelogEntry represents a single entry loaded from the changelog
type ChangelogEntry struct {
	Key         string
	Value       []byte
	Partition   int32
	Offset      int64
	Timestamp   time.Time
	IsTombstone bool
}

func (e *ChangelogEntry) WorkspaceID() string {
	return strings.Split(e.Key, ":")[0]
}

// UnmarshalInto unmarshals the value into the provided object
func (e *ChangelogEntry) UnmarshalInto(v interface{}) error {
	if e.IsTombstone {
		return fmt.Errorf("cannot unmarshal tombstone entry")
	}
	return json.Unmarshal(e.Value, v)
}
