package system

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"

	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager"
	"workspace-engine/pkg/workspace/releasemanager/trace"
)

type systemDeploymentLink struct {
	SystemID     string `json:"systemId"`
	DeploymentID string `json:"deploymentId"`
}

type systemEnvironmentLink struct {
	SystemID      string `json:"systemId"`
	EnvironmentID string `json:"environmentId"`
}

func makeDeploymentReleaseTargets(
	ctx context.Context,
	ws *workspace.Workspace,
	deployment *oapi.Deployment,
) ([]*oapi.ReleaseTarget, error) {
	seen := make(map[string]struct{})
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, systemID := range ws.SystemDeployments().GetSystemIDsForDeployment(deployment.Id) {
		environments := ws.Systems().Environments(systemID)
		for _, environment := range environments {
			resources, err := ws.Environments().Resources(ctx, environment.Id)
			if err != nil {
				return nil, err
			}
			for _, resource := range resources {
				isMatch, err := selector.Match(ctx, deployment.ResourceSelector, resource)
				if err != nil {
					return nil, err
				}
				if isMatch {
					rt := &oapi.ReleaseTarget{
						EnvironmentId: environment.Id,
						DeploymentId:  deployment.Id,
						ResourceId:    resource.Id,
					}
					if _, ok := seen[rt.Key()]; !ok {
						seen[rt.Key()] = struct{}{}
						releaseTargets = append(releaseTargets, rt)
					}
				}
			}
		}
	}
	return releaseTargets, nil
}

func makeEnvironmentReleaseTargets(
	ctx context.Context,
	ws *workspace.Workspace,
	environment *oapi.Environment,
) ([]*oapi.ReleaseTarget, error) {
	seen := make(map[string]struct{})
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, systemID := range ws.SystemEnvironments().GetSystemIDsForEnvironment(environment.Id) {
		deployments := ws.Systems().Deployments(systemID)
		for _, deployment := range deployments {
			resources, err := ws.Deployments().Resources(ctx, deployment.Id)
			if err != nil {
				return nil, err
			}
			for _, resource := range resources {
				isMatch, err := selector.Match(ctx, environment.ResourceSelector, resource)
				if err != nil {
					return nil, err
				}
				if isMatch {
					rt := &oapi.ReleaseTarget{
						EnvironmentId: environment.Id,
						DeploymentId:  deployment.Id,
						ResourceId:    resource.Id,
					}
					if _, ok := seen[rt.Key()]; !ok {
						seen[rt.Key()] = struct{}{}
						releaseTargets = append(releaseTargets, rt)
					}
				}
			}
		}
	}
	return releaseTargets, nil
}

func diffReleaseTargets(old, new []*oapi.ReleaseTarget) (added, removed []*oapi.ReleaseTarget) {
	oldSet := make(map[string]struct{}, len(old))
	for _, rt := range old {
		oldSet[rt.Key()] = struct{}{}
	}
	newSet := make(map[string]struct{}, len(new))
	for _, rt := range new {
		newSet[rt.Key()] = struct{}{}
	}

	for _, rt := range new {
		if _, ok := oldSet[rt.Key()]; !ok {
			added = append(added, rt)
		}
	}
	for _, rt := range old {
		if _, ok := newSet[rt.Key()]; !ok {
			removed = append(removed, rt)
		}
	}
	return added, removed
}

// HandleSystemDeploymentLinked adds a system association to a deployment and
// reconciles the resulting release targets.
func HandleSystemDeploymentLinked(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var link systemDeploymentLink
	if err := json.Unmarshal(event.Data, &link); err != nil {
		return err
	}

	deployment, ok := ws.Deployments().Get(link.DeploymentID)
	if !ok {
		return fmt.Errorf("deployment %q not found", link.DeploymentID)
	}

	existingSystemIDs := ws.SystemDeployments().GetSystemIDsForDeployment(deployment.Id)
	if slices.Contains(existingSystemIDs, link.SystemID) {
		return nil
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	if err := ws.SystemDeployments().Link(link.SystemID, link.DeploymentID); err != nil {
		return err
	}

	newReleaseTargets, err := makeDeploymentReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}

	added, _ := diffReleaseTargets(oldReleaseTargets, newReleaseTargets)

	for _, rt := range added {
		if err := ws.ReleaseTargets().Upsert(ctx, rt); err != nil {
			return err
		}
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, added,
		releasemanager.WithTrigger(trace.TriggerSystemDeploymentLinked))

	return nil
}

// HandleSystemDeploymentUnlinked removes a system association from a deployment
// and cleans up orphaned release targets.
func HandleSystemDeploymentUnlinked(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var link systemDeploymentLink
	if err := json.Unmarshal(event.Data, &link); err != nil {
		return err
	}

	deployment, ok := ws.Deployments().Get(link.DeploymentID)
	if !ok {
		return fmt.Errorf("deployment %q not found", link.DeploymentID)
	}

	existingSystemIDs := ws.SystemDeployments().GetSystemIDsForDeployment(deployment.Id)
	if !slices.Contains(existingSystemIDs, link.SystemID) {
		return nil
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForDeployment(ctx, deployment.Id)
	if err != nil {
		return err
	}

	if err := ws.SystemDeployments().Unlink(link.SystemID, link.DeploymentID); err != nil {
		return err
	}

	newReleaseTargets, err := makeDeploymentReleaseTargets(ctx, ws, deployment)
	if err != nil {
		return err
	}

	_, removed := diffReleaseTargets(oldReleaseTargets, newReleaseTargets)

	for _, rt := range removed {
		ws.ReleaseTargets().Remove(rt.Key())
	}

	return nil
}

// HandleSystemEnvironmentLinked adds a system association to an environment and
// reconciles the resulting release targets.
func HandleSystemEnvironmentLinked(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var link systemEnvironmentLink
	if err := json.Unmarshal(event.Data, &link); err != nil {
		return err
	}

	environment, ok := ws.Environments().Get(link.EnvironmentID)
	if !ok {
		return fmt.Errorf("environment %q not found", link.EnvironmentID)
	}

	existingSystemIDs := ws.SystemEnvironments().GetSystemIDsForEnvironment(environment.Id)
	if slices.Contains(existingSystemIDs, link.SystemID) {
		return nil
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForEnvironment(ctx, environment.Id)
	if err != nil {
		return err
	}

	if err := ws.SystemEnvironments().Link(link.SystemID, link.EnvironmentID); err != nil {
		return err
	}

	newReleaseTargets, err := makeEnvironmentReleaseTargets(ctx, ws, environment)
	if err != nil {
		return err
	}

	added, _ := diffReleaseTargets(oldReleaseTargets, newReleaseTargets)

	for _, rt := range added {
		if err := ws.ReleaseTargets().Upsert(ctx, rt); err != nil {
			return err
		}
		ws.ReleaseManager().DirtyDesiredRelease(rt)
	}
	ws.ReleaseManager().RecomputeState(ctx)

	_ = ws.ReleaseManager().ReconcileTargets(ctx, added,
		releasemanager.WithTrigger(trace.TriggerSystemEnvironmentLinked))

	return nil
}

// HandleSystemEnvironmentUnlinked removes a system association from an
// environment and cleans up orphaned release targets.
func HandleSystemEnvironmentUnlinked(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var link systemEnvironmentLink
	if err := json.Unmarshal(event.Data, &link); err != nil {
		return err
	}

	environment, ok := ws.Environments().Get(link.EnvironmentID)
	if !ok {
		return fmt.Errorf("environment %q not found", link.EnvironmentID)
	}

	existingSystemIDs := ws.SystemEnvironments().GetSystemIDsForEnvironment(environment.Id)
	if !slices.Contains(existingSystemIDs, link.SystemID) {
		return nil
	}

	oldReleaseTargets, err := ws.ReleaseTargets().GetForEnvironment(ctx, environment.Id)
	if err != nil {
		return err
	}

	if err := ws.SystemEnvironments().Unlink(link.SystemID, link.EnvironmentID); err != nil {
		return err
	}

	newReleaseTargets, err := makeEnvironmentReleaseTargets(ctx, ws, environment)
	if err != nil {
		return err
	}

	_, removed := diffReleaseTargets(oldReleaseTargets, newReleaseTargets)

	for _, rt := range removed {
		ws.ReleaseTargets().Remove(rt.Key())
	}

	return nil
}
