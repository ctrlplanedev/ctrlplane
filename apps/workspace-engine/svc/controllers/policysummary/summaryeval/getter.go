package summaryeval

import (
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/environmentprogression"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/gradualrollout"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/versioncooldown"
)

type approvalGetter = approval.Getters
type environmentProgressionGetter = environmentprogression.Getters
type gradualRolloutGetter = gradualrollout.Getters
type versionCooldownGetter = versioncooldown.Getters

type Getter interface {
	approvalGetter
	environmentProgressionGetter
	gradualRolloutGetter
	versionCooldownGetter
}
