package targets

import (
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

// targetIndex provides efficient lookups of targets by their related entity IDs
type targetIndex struct {
	byEnvironment map[string][]*oapi.ReleaseTarget
	byDeployment  map[string][]*oapi.ReleaseTarget
	byResource    map[string][]*oapi.ReleaseTarget
}

// buildTargetIndex creates indexes for efficient target lookups
func buildTargetIndex(targets map[string]*oapi.ReleaseTarget) *targetIndex {
	idx := &targetIndex{
		byEnvironment: make(map[string][]*oapi.ReleaseTarget),
		byDeployment:  make(map[string][]*oapi.ReleaseTarget),
		byResource:    make(map[string][]*oapi.ReleaseTarget),
	}

	for _, target := range targets {
		idx.byEnvironment[target.EnvironmentId] = append(idx.byEnvironment[target.EnvironmentId], target)
		idx.byDeployment[target.DeploymentId] = append(idx.byDeployment[target.DeploymentId], target)
		idx.byResource[target.ResourceId] = append(idx.byResource[target.ResourceId], target)
	}

	return idx
}

// TaintProcessor identifies which targets need to be re-evaluated based on changes
type TaintProcessor struct {
	store          *store.Store
	index          *targetIndex
	taintedTargets map[string]*oapi.ReleaseTarget
}

// NewTaintProcessor creates a new taint processor and processes all changes in a single pass
func NewTaintProcessor(
	store *store.Store,
	changeSet *changeset.ChangeSet[any],
	targets map[string]*oapi.ReleaseTarget,
) *TaintProcessor {
	tp := &TaintProcessor{
		store:          store,
		index:          buildTargetIndex(targets),
		taintedTargets: make(map[string]*oapi.ReleaseTarget),
	}

	tp.processChanges(changeSet)
	return tp
}

// processChanges iterates through the changeset once and taints relevant targets
// This replaces the previous approach of calling Process() multiple times
func (tp *TaintProcessor) processChanges(changeSet *changeset.ChangeSet[any]) {
	items := changeSet.Process().CollectEntities()
	for _, item := range items {
		switch entity := item.(type) {
		case *oapi.Policy, *oapi.System:
			// Global taint: mark all targets and short-circuit further processing
			tp.taintAll()
			return

		case *oapi.UserApprovalRecord:
			tp.taintByEnvironmentId(entity.EnvironmentId)

		case *oapi.Environment:
			tp.taintByEnvironmentId(entity.Id)

		case *oapi.Deployment:
			tp.taintByDeploymentId(entity.Id)

		case *oapi.DeploymentVersion:
			tp.taintByDeploymentId(entity.DeploymentId)

		case *oapi.DeploymentVariable:
			tp.taintByDeploymentId(entity.DeploymentId)

		case *oapi.DeploymentVariableValue:
			dv, ok := tp.store.DeploymentVariables.Get(entity.DeploymentVariableId)
			if !ok {
				continue
			}
			tp.taintByDeploymentId(dv.DeploymentId)

		case *oapi.Resource:
			tp.taintByResourceId(entity.Id)

		case *oapi.Job:
			rel, ok := tp.store.Releases.Get(entity.ReleaseId)
			if !ok {
				continue
			}
			tp.taintByReleaseTarget(&rel.ReleaseTarget)

		case *oapi.ResourceVariable:
			tp.taintByResourceId(entity.ResourceId)
		}
	}
}

// taintAll marks all targets as tainted (used for Policy/System changes)
func (tp *TaintProcessor) taintAll() {
	for _, targets := range tp.index.byEnvironment {
		for _, target := range targets {
			tp.taintedTargets[target.Key()] = target
		}
	}
}

// taintByEnvironment taints all targets in the given environment
func (tp *TaintProcessor) taintByEnvironmentId(envId string) {
	for _, target := range tp.index.byEnvironment[envId] {
		tp.taintedTargets[target.Key()] = target
	}
}

// taintByDeployment taints all targets for the given deployment
func (tp *TaintProcessor) taintByDeploymentId(depId string) {
	for _, target := range tp.index.byDeployment[depId] {
		tp.taintedTargets[target.Key()] = target
	}
}

// taintByResource taints all targets for the given resource
func (tp *TaintProcessor) taintByResourceId(resId string) {
	for _, target := range tp.index.byResource[resId] {
		tp.taintedTargets[target.Key()] = target
	}
}

// taintByJob taints the specific target associated with the job's release
func (tp *TaintProcessor) taintByReleaseTarget(releaseTarget *oapi.ReleaseTarget) {
	tp.taintedTargets[releaseTarget.Key()] = releaseTarget
}

// Tainted returns the map of all targets that have been marked for tainting
func (tp *TaintProcessor) Tainted() map[string]*oapi.ReleaseTarget {
	return tp.taintedTargets
}
