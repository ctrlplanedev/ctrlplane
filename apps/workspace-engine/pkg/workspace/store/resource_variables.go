package store

import (
	"bytes"
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository/memory"
)

func NewResourceVariables(store *Store) *ResourceVariables {
	return &ResourceVariables{
		repo:  store.repo,
		store: store,
	}
}

type ResourceVariables struct {
	repo  *memory.InMemory
	store *Store
}

func (r *ResourceVariables) Upsert(ctx context.Context, resourceVariable *oapi.ResourceVariable) {
	r.repo.ResourceVariables.Set(resourceVariable.ID(), resourceVariable)
	r.store.changeset.RecordUpsert(resourceVariable)
}

func (r *ResourceVariables) Get(resourceId string, key string) (*oapi.ResourceVariable, bool) {
	return r.repo.ResourceVariables.Get(resourceId + "-" + key)
}

func (r *ResourceVariables) Remove(ctx context.Context, resourceId string, key string) {
	resourceVariable, ok := r.repo.ResourceVariables.Get(resourceId + "-" + key)
	if !ok || resourceVariable == nil {
		return
	}

	r.repo.ResourceVariables.Remove(resourceId + "-" + key)
	r.store.changeset.RecordDelete(resourceVariable)
}

func (r *ResourceVariables) BulkUpdate(ctx context.Context, resourceId string, variables map[string]any) (bool, error) {
	currentVariables := make(map[string]*oapi.ResourceVariable)
	hasChanges := false

	for _, variable := range r.repo.ResourceVariables.Items() {
		if variable.ResourceId == resourceId {
			currentVariables[variable.Key] = variable
		}
	}

	for key, currentVar := range currentVariables {
		if _, ok := variables[key]; !ok {
			hasChanges = true
			r.repo.ResourceVariables.Remove(resourceId + "-" + key)
			r.store.changeset.RecordDelete(currentVar)
		}
	}

	for key, value := range variables {
		newValue := oapi.NewValueFromLiteral(oapi.NewLiteralValue(value))
		if currentVar, exists := currentVariables[key]; !exists {
			hasChanges = true
			r.Upsert(ctx, &oapi.ResourceVariable{
				ResourceId: resourceId,
				Key:        key,
				Value:      *newValue,
			})
		} else {
			oldBytes, err := currentVar.Value.MarshalJSON()
			if err != nil {
				return false, err
			}
			newBytes, err := newValue.MarshalJSON()
			if err != nil {
				return false, err
			}

			if !bytes.Equal(oldBytes, newBytes) {
				hasChanges = true
				currentVar.Value = *newValue
				r.Upsert(ctx, currentVar)
			}
		}
	}

	return hasChanges, nil
}

func (r *ResourceVariables) Items() map[string]*oapi.ResourceVariable {
	return r.repo.ResourceVariables.Items()
}
