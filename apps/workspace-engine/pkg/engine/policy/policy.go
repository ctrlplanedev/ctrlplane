package policy

import (
	"fmt"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/engine/selector/exhaustive/operations"
)

type ReleaseTarget struct {
	EnvironmentID string
	ResourceID    string
	DeploymentID  string
}

func (r ReleaseTarget) GetID() string {
	return r.ResourceID + r.DeploymentID + r.EnvironmentID
}

func (r ReleaseTarget) GetMatchableEntity(entityType selector.MatchableEntityType) (selector.MatchableEntity, error) {
	if entityType == selector.MatchableEntityDefault {
		return r, nil
	}
	if entityType == selector.MatchableEntityEnvironment {
		return GetEnvironmentFor(r.EnvironmentID)
	}
	if entityType == selector.MatchableEntityResource {
		return GetResourceFor(r.ResourceID)
	}
	if entityType == selector.MatchableEntityDeployment {
		return GetDeploymentFor(r.DeploymentID)
	}
	return nil, fmt.Errorf("unsupported entity type: %s", entityType)
}

type PolicyTarget struct {
	ID string

	Conditions []selector.Condition
}

func (p PolicyTarget) GetID() string {
	return p.ID
}

func (p PolicyTarget) GetConditions() selector.Condition {
	return operations.ComparisonCondition{
		Operator:   operations.ComparisonConditionOperatorAnd,
		Conditions: p.Conditions,
	}
}
