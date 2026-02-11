package indexstore

import (
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/hashicorp/go-memdb"
)

var ReleaseTargetsSchema = &memdb.TableSchema{
	Name: "release_target",
	Indexes: map[string]*memdb.IndexSchema{
		"id": {
			Name:    "id",
			Unique:  true,
			Indexer: &ReleaseTargetIDIndexer{},
		},
		"resource_id": {
			Name:   "resource_id",
			Unique: false,
			Indexer: &memdb.StringFieldIndex{
				Field: "ResourceId",
			},
		},
		"environment_id": {
			Name:   "environment_id",
			Unique: false,
			Indexer: &memdb.StringFieldIndex{
				Field: "EnvironmentId",
			},
		},
		"deployment_id": {
			Name:   "deployment_id",
			Unique: false,
			Indexer: &memdb.StringFieldIndex{
				Field: "DeploymentId",
			},
		},
	},
}

type ReleaseTargetIDIndexer struct{}

func (r *ReleaseTargetIDIndexer) FromObject(obj any) (bool, []byte, error) {
	rt, ok := obj.(*oapi.ReleaseTarget)
	if !ok {
		return false, nil, fmt.Errorf("expected *oapi.ReleaseTarget, got %T", obj)
	}
	key := rt.Key()
	return true, []byte(key + "\x00"), nil
}

func (r *ReleaseTargetIDIndexer) FromArgs(args ...any) ([]byte, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("must provide exactly one argument")
	}
	key, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("argument must be a string")
	}
	return []byte(key + "\x00"), nil
}
