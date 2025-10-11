package changeset

import (
	"sync"
	"time"
)

type ChangeType string

const (
	ChangeTypeInsert ChangeType = "insert"
	ChangeTypeUpdate ChangeType = "update"
	ChangeTypeDelete ChangeType = "delete"
)

type EntityType string

const (
	EntityTypeResource                 EntityType = "resource"
	EntityTypeDeployment               EntityType = "deployment"
	EntityTypeEnvironment              EntityType = "environment"
	EntityTypeReleaseTarget            EntityType = "releaseTarget"
	EntityTypeJob                      EntityType = "job"
	EntityTypeJobAgent                 EntityType = "jobAgent"
	EntityTypeRelease                  EntityType = "release"
	EntityTypeDeploymentVariable       EntityType = "deploymentVariable"
	EntityTypeDeploymentVersion        EntityType = "deploymentVersion"
	EntityTypeVariableSet              EntityType = "variableSet"
	EntityTypeSystem                   EntityType = "system"
	EntityTypeResourceProvider         EntityType = "resourceProvider"
	EntityTypeResourceMetadataGroup    EntityType = "resourceMetadataGroup"
	EntityTypeResourceRelationshipRule EntityType = "resourceRelationshipRule"
	EntityTypePolicy                   EntityType = "policy"
)

type Change struct {
	EntityType EntityType
	Type       ChangeType
	ID         string
	Entity     any
	Timestamp  time.Time
}

type ChangeSet struct {
	IsInitialLoad bool
	Changes       []Change
	Mutex         sync.Mutex
}

func NewChangeSet() *ChangeSet {
	return &ChangeSet{
		Changes: make([]Change, 0),
	}
}

func (cs *ChangeSet) Record(entityType EntityType, changeType ChangeType, id string, entity any) {
	cs.Mutex.Lock()
	defer cs.Mutex.Unlock()

	cs.Changes = append(cs.Changes, Change{
		EntityType: entityType,
		Type:       changeType,
		ID:         id,
		Entity:     entity,
		Timestamp:  time.Now(),
	})
}
