package policyeval

import (
	"workspace-engine/pkg/workspace/store"
)

type getterPostgres struct {
	approvalGetters
	environmentprogressionGetters
	deploymentwindowGetters
	deploymentdependencyGetters
	versioncooldownGetters
	deployableversionsGetters
	gradualrolloutGetters
}

func NewGetterPostgres(store *store.Store) Getter {
	return &getterPostgres{}
}