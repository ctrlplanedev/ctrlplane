package deployment

type Deployment struct {
	ID       string
	Name     string
	Slug     string
	SystemID string
}

func (d Deployment) GetID() string {
	return d.ID
}
