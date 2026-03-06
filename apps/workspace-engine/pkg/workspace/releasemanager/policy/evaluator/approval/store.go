package approval

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func NewStoreGetters(store *store.Store) Getters {
	return &storeGetters{store: store}
}

func (s *storeGetters) GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	return s.store.UserApprovalRecords.GetApprovalRecords(versionID, environmentID), nil
}
