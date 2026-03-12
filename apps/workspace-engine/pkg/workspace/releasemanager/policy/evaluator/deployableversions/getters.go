package deployableversions

import "workspace-engine/pkg/oapi"

type Getters interface {
	GetReleases() map[string]*oapi.Release
}
