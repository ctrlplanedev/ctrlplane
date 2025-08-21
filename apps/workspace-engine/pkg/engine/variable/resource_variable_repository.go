package variable

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"workspace-engine/pkg/model"
)

var _ model.Repository[ResourceVariable] = (*ResourceVariableRepository)(nil)

type ResourceVariableRepository struct {
	variables map[string]map[string]*ResourceVariable // resourceID -> key -> variable
	mu        sync.RWMutex
}

func NewResourceVariableRepository() *ResourceVariableRepository {
	return &ResourceVariableRepository{variables: make(map[string]map[string]*ResourceVariable)}
}

func (r *ResourceVariableRepository) GetAll(ctx context.Context) []*ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var variables []*ResourceVariable
	for _, resourceVariables := range r.variables {
		for _, variable := range resourceVariables {
			variableCopy := *variable
			if variableCopy == nil {
				continue
			}

			variables = append(variables, &variableCopy)
		}
	}

	return variables
}

func (r *ResourceVariableRepository) Get(ctx context.Context, id string) *ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, resourceVariables := range r.variables {
		for _, variable := range resourceVariables {
			if variable == nil || *variable == nil {
				continue
			}
			variableCopy := *variable
			if variableCopy.GetID() == id {
				return &variableCopy
			}
		}
	}

	return nil
}

func (r *ResourceVariableRepository) GetAllByResourceID(ctx context.Context, resourceID string) []*ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var variables []*ResourceVariable
	if resourceVariables, ok := r.variables[resourceID]; ok {
		for _, variable := range resourceVariables {
			if variable == nil || *variable == nil {
				continue
			}
			variableCopy := *variable
			variables = append(variables, &variableCopy)
		}
	}

	return variables
}

func (r *ResourceVariableRepository) GetByResourceIDAndKey(ctx context.Context, resourceID, key string) *ResourceVariable {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if resourceVariables, ok := r.variables[resourceID]; ok {
		if variable, ok := resourceVariables[key]; ok {
			if variable == nil || *variable == nil {
				return nil
			}
			variableCopy := *variable
			return &variableCopy
		}
	}

	return nil
}

func (r *ResourceVariableRepository) Create(ctx context.Context, variable *ResourceVariable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if variable == nil || *variable == nil {
		return errors.New("variable is nil")
	}

	variableCopy := *variable
	resourceID := variableCopy.GetResourceID()
	key := variableCopy.GetKey()

	if _, ok := r.variables[resourceID]; !ok {
		r.variables[resourceID] = make(map[string]*ResourceVariable)
	}

	if _, ok := r.variables[resourceID][key]; ok {
		return fmt.Errorf("variable already exists for resource %s and key %s", resourceID, key)
	}

	r.variables[resourceID][key] = &variableCopy

	return nil
}

func (r *ResourceVariableRepository) Update(ctx context.Context, variable *ResourceVariable) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if variable == nil || *variable == nil {
		return errors.New("variable is nil")
	}

	variableCopy := *variable
	resourceID := variableCopy.GetResourceID()
	key := variableCopy.GetKey()

	if _, ok := r.variables[resourceID]; !ok {
		return errors.New("resource not found")
	}

	current, ok := r.variables[resourceID][key]
	if !ok {
		return errors.New("variable key not found")
	}
	currentCopy := *current
	if currentCopy == nil {
		return errors.New("current variable is nil")
	}

	if currentCopy.GetID() != variableCopy.GetID() {
		return errors.New("variable ID mismatch")
	}

	r.variables[resourceID][key] = &variableCopy

	return nil
}

func (r *ResourceVariableRepository) Delete(ctx context.Context, id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, resourceVariables := range r.variables {
		for _, variable := range resourceVariables {
			if variable == nil || *variable == nil {
				continue
			}
			variableCopy := *variable
			if variableCopy.GetID() == id {
				delete(resourceVariables, variableCopy.GetKey())
			}
		}
	}

	return nil
}

func (r *ResourceVariableRepository) Exists(ctx context.Context, id string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	for _, resourceVariables := range r.variables {
		for _, variable := range resourceVariables {
			if variable == nil || *variable == nil {
				continue
			}
			variableCopy := *variable
			if variableCopy.GetID() == id {
				return true
			}
		}
	}
	return false
}
