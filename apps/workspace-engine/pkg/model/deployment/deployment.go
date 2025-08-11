package deployment

import (
	"fmt"
	"time"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/resource"
)

var _ model.SelectorEntity = &Deployment{}

type Deployment struct {
	ID string `json:"id"`

	SystemID string `json:"systemId"`

	ResourceSelector *conditions.JSONCondition `json:"resourceSelector"`
}

func (d Deployment) GetID() string {
	return d.ID
}

func (d Deployment) MatchAllIfNullSelector(entity model.MatchableEntity) bool {
	return false
}

func (d Deployment) Selector(entity model.MatchableEntity) (*conditions.JSONCondition, error) {
	if _, ok := entity.(resource.Resource); ok {
		return d.ResourceSelector, nil
	}
	return nil, fmt.Errorf("entity is not a supported selector option")
}

type DeploymentVersionStatus string

const (
	DeploymentVersionStatusBuilding DeploymentVersionStatus = "building"
	DeploymentVersionStatusReady    DeploymentVersionStatus = "ready"
	DeploymentVersionStatusFailed   DeploymentVersionStatus = "failed"
	DeploymentVersionStatusRejected DeploymentVersionStatus = "rejected"
)

type DeploymentVersion struct {
	ID string `json:"id"`

	DeploymentID string `json:"deploymentId"`

	Name *string `json:"name,omitempty"`

	Tag string `json:"tag"`

	Config map[string]any `json:"config"`

	JobAgentConfig map[string]any `json:"jobAgentConfig"`

	Status DeploymentVersionStatus `json:"status"`

	Message *string `json:"message,omitempty"`

	CreatedAt time.Time `json:"createdAt"`
}

func (d DeploymentVersion) GetID() string {
	return d.ID
}

func (d DeploymentVersion) GetStatus() DeploymentVersionStatus {
	return d.Status
}
