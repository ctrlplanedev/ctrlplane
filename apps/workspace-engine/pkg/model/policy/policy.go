package policy

type Policy struct {
	ID string `json:"id"`

	Name string `json:"name"`
}

func (p Policy) GetID() string {
	return p.ID
}

