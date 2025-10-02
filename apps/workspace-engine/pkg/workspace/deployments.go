package workspace

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/selector/langs/jsonselector"
	"workspace-engine/pkg/selector/langs/jsonselector/unknown"
)

type Deployments struct {
	ws *Workspace

	resources cmap.ConcurrentMap[string, map[string]*pb.Resource]
}

func (e *Deployments) HasResources(deploymentId string, resourceId string) bool {
	resources, exists := e.resources.Get(deploymentId)
	return exists && resources[resourceId] != nil
}

func (e *Deployments) Resources(id string) map[string]*pb.Resource {
	resources, exists := e.resources.Get(id)
	if !exists {
		return map[string]*pb.Resource{}
	}
	return resources
}

func (e *Deployments) RecomputeResources(ctx context.Context, deploymentId string) error {
	deployment, exists := e.ws.deployments.Get(deploymentId)
	if !exists {
		return fmt.Errorf("deployment %s not found", deploymentId)
	}
	return e.Upsert(ctx, deployment)
}

func (e *Deployments) Upsert(ctx context.Context, deployment *pb.Deployment) error {
	var condition unknown.MatchableCondition
	if deployment.ResourceSelector != nil {
		unknownCondition, err := unknown.ParseFromMap(deployment.ResourceSelector.AsMap())
		if err != nil {
			return err
		}
		condition, err = jsonselector.ConvertToSelector(ctx, unknownCondition)
		if err != nil {
			return err
		}
	}

	deploymentResources := make(map[string]*pb.Resource, e.ws.resources.Count())
	for item := range e.ws.resources.IterBuffered() {
		if condition == nil {
			deploymentResources[item.Key] = item.Val
			continue
		}
		ok, err := condition.Matches(item.Val)
		if err != nil {
			return err
		}
		if ok {
			deploymentResources[item.Key] = item.Val
		}
	}

	e.ws.deployments.Set(deployment.Id, deployment)
	e.resources.Set(deployment.Id, deploymentResources)

	return nil
}

func (e *Deployments) Remove(id string) {
	e.ws.deployments.Remove(id)
	e.resources.Remove(id)
}
