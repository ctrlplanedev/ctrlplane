package policyeval

import (
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

type gradualrolloutGetters = gradualrollout.Getters
type approvalGetters = approval.Getters
type environmentprogressionGetters = environmentprogression.Getters
type deploymentwindowGetters = deploymentwindow.Getters
type deploymentdependencyGetters = deploymentdependency.Getters
type versioncooldownGetters = versioncooldown.Getters
type deployableversionsGetters = deployableversions.Getters

// Getter provides the data-access methods needed by policy evaluators.
type Getter interface {
	approvalGetters
	environmentprogressionGetters
	deploymentwindowGetters
	deploymentdependencyGetters
	versioncooldownGetters
	deployableversionsGetters
	gradualrolloutGetters
}

type postgresGetter struct {
	approvalGetters
	environmentprogressionGetters
	deploymentwindowGetters
	deploymentdependencyGetters
	versioncooldownGetters
	deployableversionsGetters
	gradualrolloutGetters
}

func NewGetter(wsID string, queries *db.Queries) *postgresGetter {
	return &postgresGetter{
		approvalGetters: approval.NewPostgresGetters(queries),
		deploymentwindowGetters: deploymentwindow.NewPostgresGetters(queries),

		environmentprogressionGetters: environmentprogression.NewPostgresGetters(queries),
		deploymentdependencyGetters: deploymentdependency.NewPostgresGetters(wsID, queries),
		versioncooldownGetters: versioncooldown.NewPostgresGetters(queries),
		deployableversionsGetters: deployableversions.NewPostgresGetters(wsID, queries),
		gradualrolloutGetters: gradualrollout.NewPostgresGetters(wsID, queries),
	}
}