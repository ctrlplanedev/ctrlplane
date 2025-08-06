package deployment

import "workspace-engine/pkg/engine/selector"

type Deployment struct {
	ID string
}

func (d Deployment) GetID() string {
	return d.ID
}

func (d Deployment) GetConditions() selector.Condition {
	return nil
}
