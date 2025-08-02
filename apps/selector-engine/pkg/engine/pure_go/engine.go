package purego

import (
	"context"
	"github.com/ctrlplanedev/selector-engine/pkg/model"
	"github.com/ctrlplanedev/selector-engine/pkg/model/resource"
	"github.com/ctrlplanedev/selector-engine/pkg/model/selector"
	"sync"

	"github.com/charmbracelet/log"
	"github.com/ctrlplanedev/selector-engine/pkg/logger"
)

type GoDispatcherEngine struct {
	workspaceEngines map[string]*GoWorkspaceEngine
	mu               sync.Mutex
	logger           *log.Logger
}

func NewGoDispatcherEngine() *GoDispatcherEngine {
	return &GoDispatcherEngine{
		workspaceEngines: make(map[string]*GoWorkspaceEngine),
		logger:           logger.Get(),
	}
}

func (e *GoDispatcherEngine) LoadResources(ctx context.Context, resources []resource.Resource) []model.Match {
	var allMatches []model.Match = make([]model.Match, 0)
	for _, res := range resources {
		var engine = e.getWorkspaceEngine(res.WorkspaceID)
		allMatches = append(
			allMatches,
			engine.UpsertResource(ctx, res)...,
		)
	}
	return allMatches
}

func (e *GoDispatcherEngine) UpsertResource(ctx context.Context, resource resource.Resource) []model.Match {
	var engine = e.getWorkspaceEngine(resource.WorkspaceID)
	return engine.UpsertResource(ctx, resource)
}

func (e *GoDispatcherEngine) RemoveResources(ctx context.Context, resourceRefs []resource.ResourceRef) []model.Status {
	var allStatuses []model.Status = make([]model.Status, 0)
	for _, res := range resourceRefs {
		var engine = e.getWorkspaceEngine(res.WorkspaceID)
		allStatuses = append(
			allStatuses,
			engine.RemoveResources(ctx, []resource.ResourceRef{res})...,
		)
	}
	return allStatuses
}

func (e *GoDispatcherEngine) LoadSelectors(ctx context.Context, selectors []selector.ResourceSelector) []model.Match {
	var allMatches []model.Match = make([]model.Match, 0)
	for _, res := range selectors {
		var engine = e.getWorkspaceEngine(res.WorkspaceID)
		allMatches = append(
			allMatches,
			engine.UpsertSelector(ctx, res)...,
		)
	}
	return allMatches
}

func (e *GoDispatcherEngine) UpsertSelector(ctx context.Context, sel selector.ResourceSelector) []model.Match {
	var engine = e.getWorkspaceEngine(sel.WorkspaceID)
	return engine.UpsertSelector(ctx, sel)
}

func (e *GoDispatcherEngine) RemoveSelectors(ctx context.Context, selectorRefs []selector.ResourceSelectorRef) []model.Status {
	var allStatuses []model.Status = make([]model.Status, 0)
	for _, sel := range selectorRefs {
		var engine = e.getWorkspaceEngine(sel.WorkspaceID)
		allStatuses = append(
			allStatuses,
			engine.RemoveSelectors(ctx, []selector.ResourceSelectorRef{sel})...,
		)
	}
	return allStatuses
}

func (e *GoDispatcherEngine) getWorkspaceEngine(workspaceID string) *GoWorkspaceEngine {
	e.mu.Lock()
	defer e.mu.Unlock()

	engine, ok := e.workspaceEngines[workspaceID]
	if !ok {
		e.logger.Info("Creating engine for", "workspaceId", workspaceID)
		engine = &GoWorkspaceEngine{workspaceID: workspaceID, logger: e.logger}
		e.workspaceEngines[workspaceID] = engine
	}
	return engine
}

type GoWorkspaceEngine struct {
	workspaceID          string
	resources            sync.Map
	deploymentSelectors  sync.Map
	environmentSelectors sync.Map
	logger               *log.Logger
}

func (g *GoWorkspaceEngine) LoadResources(ctx context.Context, resources []resource.Resource) []model.Match {
	var allMatches []model.Match = make([]model.Match, 0)
	for _, res := range resources {
		g.resources.Store(g.workspaceID, res)
		allMatches = append(allMatches, g.resourceMatches(ctx, res)...)
	}
	return allMatches
}

func (g *GoWorkspaceEngine) UpsertResource(ctx context.Context, res resource.Resource) []model.Match {
	g.resources.Store(g.workspaceID, res)
	return g.resourceMatches(ctx, res)
}

func (g *GoWorkspaceEngine) RemoveResources(ctx context.Context, resourceRefs []resource.ResourceRef) []model.Status {
	var allStatuses []model.Status = make([]model.Status, 0)
	for _, ref := range resourceRefs {
		g.resources.Delete(ref.ID)
		allStatuses = append(allStatuses, model.Status{
			Error:   false,
			Message: "Resource removed successfully: " + ref.ID,
		})
	}
	return allStatuses
}

func (g *GoWorkspaceEngine) LoadSelectors(ctx context.Context, selectors []selector.ResourceSelector) []model.Match {
	var allMatches = make([]model.Match, 0)
	for _, sel := range selectors {
		if sel.EntityType == selector.DeploymentEntityType {
			g.deploymentSelectors.Store(sel.ID, &sel)
		} else {
			g.environmentSelectors.Store(sel.ID, &sel)
		}
		allMatches = append(allMatches, g.selectorMatches(ctx, sel)...)
	}
	return allMatches
}

func (g *GoWorkspaceEngine) UpsertSelector(ctx context.Context, sel selector.ResourceSelector) []model.Match {
	if sel.EntityType == selector.DeploymentEntityType {
		g.deploymentSelectors.Store(sel.ID, &sel)
	} else {
		g.environmentSelectors.Store(sel.ID, &sel)
	}
	return g.selectorMatches(ctx, sel)
}

func (g *GoWorkspaceEngine) RemoveSelectors(ctx context.Context, selectorRefs []selector.ResourceSelectorRef) []model.Status {
	var allStatuses []model.Status = make([]model.Status, 0)
	for _, ref := range selectorRefs {
		if ref.EntityType == selector.DeploymentEntityType {
			g.deploymentSelectors.Delete(ref.ID)
		} else {
			g.environmentSelectors.Delete(ref.ID)
		}
		allStatuses = append(allStatuses, model.Status{
			Error:   false,
			Message: "Selector " + string(ref.EntityType) + " removed successfully: " + ref.ID,
		})
	}
	return allStatuses
}

func (g *GoWorkspaceEngine) resourceMatches(ctx context.Context, resource resource.Resource) []model.Match {
	var allMatches []model.Match = make([]model.Match, 0)
	var ok bool
	var err error
	var testCount int
	var matchCount int

	// Check deployment selectors
	testCount = 0
	matchCount = 0
	g.deploymentSelectors.Range(
		func(key any, value any) bool {
			sel := value.(*selector.ResourceSelector)
			testCount++
			if err = sel.Condition.Validate(); err != nil {
				allMatches = append(allMatches, model.Match{
					Error:      true,
					Message:    err.Error(),
					SelectorID: sel.ID,
					ResourceID: resource.ID,
				})
			} else if ok, err = sel.Condition.Matches(resource); err != nil {
				allMatches = append(allMatches, model.Match{
					Error:      true,
					Message:    err.Error(),
					SelectorID: sel.ID,
					ResourceID: resource.ID,
				})
			} else if ok {
				matchCount++
				allMatches = append(allMatches, model.Match{
					SelectorID: sel.ID,
					ResourceID: resource.ID,
				})
			}
			g.logger.Debug("match result", "success", ok, "resource", resource, "condition", sel.Condition)
			return true
		})
	//g.logger.Debug("deployment selectors match rate", "matches", matchCount, "total", testCount, "resourceId", resource.ID)

	// Check environment selectors
	testCount = 0
	matchCount = 0
	g.environmentSelectors.Range(
		func(key any, value any) bool {
			sel := value.(*selector.ResourceSelector)
			testCount++
			if err = sel.Condition.Validate(); err != nil {
				allMatches = append(allMatches, model.Match{
					Error:      true,
					Message:    err.Error(),
					SelectorID: sel.ID,
					ResourceID: resource.ID,
				})
			} else if ok, err = sel.Condition.Matches(resource); err != nil {
				allMatches = append(allMatches, model.Match{
					Error:      true,
					Message:    err.Error(),
					SelectorID: sel.ID,
					ResourceID: resource.ID,
				})
			} else if ok {
				matchCount++
				allMatches = append(allMatches, model.Match{
					SelectorID: sel.ID,
					ResourceID: resource.ID,
				})
			}
			g.logger.Debug("match result", "success", ok, "resource", resource, "condition", sel.Condition)
			return true
		})
	//g.logger.Debug("environment selectors match rate", "matches", matchCount, "total", testCount, "resourceId", resource.ID)

	return allMatches
}

func (g *GoWorkspaceEngine) selectorMatches(
	ctx context.Context, sel selector.ResourceSelector,
) []model.Match {
	var allMatches []model.Match = make([]model.Match, 0)
	var ok bool
	var err error

	if err = sel.Condition.Validate(); err != nil {
		allMatches = append(allMatches, model.Match{
			Error:      true,
			Message:    err.Error(),
			SelectorID: sel.ID,
			ResourceID: "",
		})
	} else {
		// Check against resources
		testCount := 0
		matchCount := 0
		g.resources.Range(
			func(key any, value any) bool {
				res := value.(resource.Resource)
				testCount++
				if ok, err = sel.Condition.Matches(res); err != nil {
					allMatches = append(allMatches, model.Match{
						Error:      true,
						Message:    err.Error(),
						SelectorID: sel.ID,
						ResourceID: res.ID,
					})
				}
				if ok {
					matchCount++
					allMatches = append(allMatches, model.Match{
						SelectorID: sel.ID,
						ResourceID: res.ID,
					})
				}
				g.logger.Debug("match result", "success", ok, "resource", res, "condition", sel.Condition)
				return true
			})
		//g.logger.Debug("selector match rate", "selectorId", sel.ID, "matches", matchCount, "total", testCount)
	}

	return allMatches
}
