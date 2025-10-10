package changeset

import (
	"sync"
	"time"
)

type ChangeType string

const (
    ChangeTypeInsert ChangeType = "insert"
    ChangeTypeUpdate ChangeType = "update"
    ChangeTypeDelete ChangeType = "delete"
)

type Change struct {
    Entity    string
    Type      ChangeType
    ID        string
    Data      any
    Timestamp time.Time
}

type ChangeSet struct {
	IsInitialLoad bool
    Changes []Change
    mu      sync.Mutex
}

func NewChangeSet() *ChangeSet {
    return &ChangeSet{
        Changes: make([]Change, 0),
    }
}

func (cs *ChangeSet) Record(entity string, changeType ChangeType, id string, data any) {
    cs.mu.Lock()
    defer cs.mu.Unlock()
    
    cs.Changes = append(cs.Changes, Change{
        Entity:    entity,
        Type:      changeType,
        ID:        id,
        Data:      data,
        Timestamp: time.Now(),
    })
}