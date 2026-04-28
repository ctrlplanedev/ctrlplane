package policyeval

import (
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentdependency"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/planvalidation"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

type approvalGetter = approval.Getters
type environmentprogressionGetter = environmentprogression.Getters
type deploymentwindowGetter = deploymentwindow.Getters
type gradualrolloutGetter = gradualrollout.Getters
type versioncooldownGetter = versioncooldown.Getters
type deploymentdependencyGetter = deploymentdependency.Getters
type planvalidationGetter = planvalidation.Getters

type Getter interface {
	approvalGetter
	environmentprogressionGetter
	deploymentwindowGetter
	gradualrolloutGetter
	versioncooldownGetter
	deploymentdependencyGetter
	planvalidationGetter
}
