package store

import (
	"bytes"
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewResourceVariables(store *Store) *ResourceVariables {
	return &ResourceVariables{
		repo:  store.repo.ResourceVariables(),
		store: store,
	}
}

type ResourceVariables struct {
	repo  repository.ResourceVariableRepo
	store *Store
}

func (r *ResourceVariables) SetRepo(repo repository.ResourceVariableRepo) {
	r.repo = repo
}

func (r *ResourceVariables) Upsert(ctx context.Context, resourceVariable *oapi.ResourceVariable) {
	if err := r.repo.Set(resourceVariable); err != nil {
		log.Error("Failed to upsert resource variable", "error", err)
	}
	r.store.changeset.RecordUpsert(resourceVariable)
}

func (r *ResourceVariables) Get(resourceId string, key string) (*oapi.ResourceVariable, bool) {
	return r.repo.Get(resourceId + "-" + key)
}

func (r *ResourceVariables) Remove(ctx context.Context, resourceId string, key string) {
	resourceVariable, ok := r.repo.Get(resourceId + "-" + key)
	if !ok || resourceVariable == nil {
		return
	}

	if err := r.repo.Remove(resourceId + "-" + key); err != nil {
		log.Error("Failed to remove resource variable", "error", err)
	}
	r.store.changeset.RecordDelete(resourceVariable)
}

func (r *ResourceVariables) BulkUpdate(ctx context.Context, resourceId string, variables map[string]any) (bool, error) {
	currentVars, err := r.repo.GetByResourceID(resourceId)
	if err != nil {
		return false, err
	}

	currentVariables := make(map[string]*oapi.ResourceVariable, len(currentVars))
	for _, v := range currentVars {
		currentVariables[v.Key] = v
	}

	hasChanges := false

	for key, currentVar := range currentVariables {
		if _, ok := variables[key]; !ok {
			hasChanges = true
			if err := r.repo.Remove(resourceId + "-" + key); err != nil {
				log.Error("Failed to remove resource variable", "error", err)
			}
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
	return r.repo.Items()
}
