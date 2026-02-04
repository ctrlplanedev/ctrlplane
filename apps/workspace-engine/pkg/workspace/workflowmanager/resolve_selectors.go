package workflowmanager

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"workspace-engine/pkg/oapi"
)

func structToMap(v any) (map[string]interface{}, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (m *Manager) getResources(ctx context.Context, selector *oapi.Selector) []map[string]interface{} {
	resources := m.store.Resources.ForSelector(ctx, selector)
	resourcesSlice := make([]map[string]interface{}, 0, len(resources))
	for _, resource := range resources {
		entityMap, err := structToMap(resource)
		if err != nil {
			continue
		}
		resourcesSlice = append(resourcesSlice, entityMap)
	}
	return resourcesSlice
}

func (m *Manager) getEnvironments(ctx context.Context, selector *oapi.Selector) []map[string]interface{} {
	environments := m.store.Environments.ForSelector(ctx, selector)
	environmentsSlice := make([]map[string]interface{}, 0, len(environments))
	for _, environment := range environments {
		entityMap, err := structToMap(environment)
		if err != nil {
			continue
		}
		environmentsSlice = append(environmentsSlice, entityMap)
	}
	return environmentsSlice
}

func (m *Manager) getDeployments(ctx context.Context, selector *oapi.Selector) []map[string]interface{} {
	deployments := m.store.Deployments.ForSelector(ctx, selector)
	deploymentsSlice := make([]map[string]interface{}, 0, len(deployments))
	for _, deployment := range deployments {
		entityMap, err := structToMap(deployment)
		if err != nil {
			continue
		}
		deploymentsSlice = append(deploymentsSlice, entityMap)
	}
	return deploymentsSlice
}

func (m *Manager) getInputWithResolvedSelectors(ctx context.Context, workflowTemplate *oapi.WorkflowTemplate, inputs map[string]any) (map[string]any, error) {
	inputsClone := maps.Clone(inputs)

	for _, input := range workflowTemplate.Inputs {
		asArray, err := input.AsWorkflowArrayInput()
		if err != nil {
			continue
		}

		asSelectorArray, err := asArray.AsWorkflowSelectorArrayInput()
		if err != nil {
			continue
		}

		sel := asSelectorArray.Selector.Default

		selectorInputEntry, ok := inputsClone[asSelectorArray.Name]
		if ok {
			selectorInputEntryString := selectorInputEntry.(string)
			sel = &oapi.Selector{}
			if err := sel.FromCelSelector(oapi.CelSelector{Cel: selectorInputEntryString}); err != nil {
				return nil, fmt.Errorf("failed to parse selector: %w", err)
			}
		}

		if sel == nil {
			return nil, fmt.Errorf("selector is nil")
		}

		var matchedEntities []map[string]interface{}

		switch asSelectorArray.Selector.EntityType {
		case oapi.WorkflowSelectorArrayInputSelectorEntityTypeResource:
			matchedEntities = m.getResources(ctx, sel)
		case oapi.WorkflowSelectorArrayInputSelectorEntityTypeEnvironment:
			matchedEntities = m.getEnvironments(ctx, sel)
		case oapi.WorkflowSelectorArrayInputSelectorEntityTypeDeployment:
			matchedEntities = m.getDeployments(ctx, sel)
		}

		inputsClone[asSelectorArray.Name] = matchedEntities
	}

	return inputsClone, nil
}
