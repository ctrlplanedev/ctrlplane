package store

import (
	"context"
	"sync"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
)

type DeploymentVersions struct {
	store *Store

	deployableVersions cmap.ConcurrentMap[string, *pb.DeploymentVersion]
}

func (d *DeploymentVersions) IterBuffered() <-chan cmap.Tuple[string, *pb.DeploymentVersion] {
	return d.store.deploymentVersions.IterBuffered()
}

func (d *DeploymentVersions) Has(id string) bool {
	return d.store.deploymentVersions.Has(id)
}

func (d *DeploymentVersions) Items() map[string]*pb.DeploymentVersion {
	return d.store.deploymentVersions.Items()
}

func (d *DeploymentVersions) Get(id string) (*pb.DeploymentVersion, bool) {
	return d.store.deploymentVersions.Get(id)
}

func (d *DeploymentVersions) Upsert(id string, version *pb.DeploymentVersion) {
	d.store.deploymentVersions.Set(id, version)
}

func (d *DeploymentVersions) Remove(id string) {
	d.store.deploymentVersions.Remove(id)
	d.deployableVersions.Remove(id)
}

func (d *DeploymentVersions) IsDeployable(version *pb.DeploymentVersion) bool {
	return d.deployableVersions.Has(version.Id)
}

func (d *DeploymentVersions) SyncDeployableVersion(version *pb.DeploymentVersion) bool {
	deployable := true
	for policyTuple := range d.store.Policies.IterBuffered() {
		policy := policyTuple.Val

		if !d.store.Policies.AppliesToDeployment(policy.Id, version.DeploymentId) {
			deployable = false
			break
		}

		for _, rule := range policy.Rules() {
			if !rule.CanDeploy(version) {
				deployable = false
				break
			}
		}

		if !deployable {
			break
		}
	}

	if deployable {
		d.deployableVersions.Set(version.Id, version)
		return deployable
	}

	d.deployableVersions.Remove(version.Id)
	return deployable
}

func (d *DeploymentVersions) SyncDeployableVersions(ctx context.Context) {
	d.deployableVersions = cmap.New[*pb.DeploymentVersion]()

	var wg sync.WaitGroup
	for tuple := range d.store.deploymentVersions.IterBuffered() {
		version := tuple.Val
		wg.Add(1)
		go func(v *pb.DeploymentVersion) {
			defer wg.Done()
			d.SyncDeployableVersion(v)
		}(version)
	}
	wg.Wait()
}

func (d *DeploymentVersions) GetDeployableVersions(deploymentId string) []*pb.DeploymentVersion {
	deployableVersions := make([]*pb.DeploymentVersion, 1000)

	for tuple := range d.deployableVersions.IterBuffered() {
		version := tuple.Val
		if version.DeploymentId == deploymentId {
			deployableVersions = append(deployableVersions, version)
		}
	}

	return deployableVersions
}
