package environment

import (
	"time"
	"workspace-engine/pkg/engine/selector"
)

type Environment struct {
	ID        string
	Name      string
	SystemID  string
	CreatedAt time.Time
}

func (e Environment) GetID() string {
	return e.ID
}

func (e Environment) GetConditions() selector.Condition {
	return nil
}
