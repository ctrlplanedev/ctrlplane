package deployableversions

import (
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

type Getters interface {
	GetReleases() map[string]*oapi.Release
}

var _ Getters = (*storeGetters)(nil)

type storeGetters struct {
	store *store.Store
}

func (s *storeGetters) GetReleases() map[string]*oapi.Release {
	return s.store.Releases.Items()
}
