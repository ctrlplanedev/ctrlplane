package store

import (
	"context"
	"sync"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var deploymentTracer = otel.Tracer("workspace/store/deployment_versions")

type DeploymentVersions struct {
	store *Store

	deployableVersions cmap.ConcurrentMap[string, *pb.DeploymentVersion]
}

func (d *DeploymentVersions) IterBuffered() <-chan cmap.Tuple[string, *pb.DeploymentVersion] {
	return d.store.repo.DeploymentVersions.IterBuffered()
}

func (d *DeploymentVersions) Has(id string) bool {
	return d.store.repo.DeploymentVersions.Has(id)
}

func (d *DeploymentVersions) Items() map[string]*pb.DeploymentVersion {
	return d.store.repo.DeploymentVersions.Items()
}

func (d *DeploymentVersions) Get(id string) (*pb.DeploymentVersion, bool) {
	return d.store.repo.DeploymentVersions.Get(id)
}

func (d *DeploymentVersions) Upsert(id string, version *pb.DeploymentVersion) {
	d.store.repo.DeploymentVersions.Set(id, version)
}

func (d *DeploymentVersions) Remove(id string) {
	d.store.repo.DeploymentVersions.Remove(id)
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
	_, span := deploymentTracer.Start(ctx, "SyncDeployableVersions",
		trace.WithAttributes(
			attribute.Int("deployment_versions.count", d.store.repo.DeploymentVersions.Count()),
			attribute.Int("deployment_versions.policy_count", d.store.repo.Policies.Count()),
		),
	)
	defer span.End()


	// Reset the deployable versions map										
	d.deployableVersions = cmap.New[*pb.DeploymentVersion]()

	var wg sync.WaitGroup
	for tuple := range d.store.repo.DeploymentVersions.IterBuffered() {
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
