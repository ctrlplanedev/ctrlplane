package policy

import "context"

var _ Repository[Policy] = (*PolicyRepository)(nil)

func NewPolicyRepository() Repository[Policy] {
	return &PolicyRepository{
		Policies: make(map[string]*Policy),
	}
}

type PolicyRepository struct {
	Policies map[string]*Policy
}

// Create implements Registry.
func (r *PolicyRepository) Create(ctx context.Context, entity *Policy) error {
	r.Policies[(*entity).GetID()] = entity
	return nil
}

// Delete implements Registry.
func (r *PolicyRepository) Delete(ctx context.Context, entityID string) error {
	delete(r.Policies, entityID)
	return nil
}

// Get implements Registry.
func (r *PolicyRepository) Get(ctx context.Context, entityID string) *Policy {
	return r.Policies[entityID]
}

// GetAll implements Registry.
func (r *PolicyRepository) GetAll(ctx context.Context) []*Policy {
	policies := make([]*Policy, 0, len(r.Policies))
	for _, policy := range r.Policies {
		policies = append(policies, policy)
	}
	return policies
}

// Update implements Registry.
func (r *PolicyRepository) Update(ctx context.Context, entity *Policy) error {
	r.Policies[(*entity).GetID()] = entity
	return nil
}

func (r *PolicyRepository) Exists(ctx context.Context, entityID string) bool {
	_, exists := r.Policies[entityID]
	return exists
}