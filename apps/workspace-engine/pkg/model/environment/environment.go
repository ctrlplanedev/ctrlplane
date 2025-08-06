package environment

import "time"

type Environment struct {
	ID        string
	Name      string
	SystemID  string
	CreatedAt time.Time
}

func (e Environment) GetID() string {
	return e.ID
}
