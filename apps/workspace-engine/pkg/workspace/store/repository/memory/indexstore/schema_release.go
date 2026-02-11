package indexstore

import (
	"fmt"
	"workspace-engine/pkg/oapi"

	"github.com/hashicorp/go-memdb"
)

var ReleaseSchema = &memdb.TableSchema{
	Name: "release",
	Indexes: map[string]*memdb.IndexSchema{
		"id": {
			Name:    "id",
			Unique:  true,
			Indexer: &ReleaseIDIndexer{},
		},
		"release_target_key": {
			Name:    "release_target_key",
			Unique:  false,
			Indexer: &ReleaseTargetKeyIndexer{},
		},
	},
}

type ReleaseIDIndexer struct{}

func (r *ReleaseIDIndexer) FromObject(obj any) (bool, []byte, error) {
	release, ok := obj.(*oapi.Release)
	if !ok {
		return false, nil, fmt.Errorf("expected *oapi.Release, got %T", obj)
	}
	id := release.ID()
	return true, []byte(id + "\x00"), nil
}

func (r *ReleaseIDIndexer) FromArgs(args ...any) ([]byte, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("must provide exactly one argument")
	}
	id, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("argument must be a string")
	}
	return []byte(id + "\x00"), nil
}

type ReleaseTargetKeyIndexer struct{}

func (r *ReleaseTargetKeyIndexer) FromObject(obj any) (bool, []byte, error) {
	release, ok := obj.(*oapi.Release)
	if !ok {
		return false, nil, fmt.Errorf("expected *oapi.Release, got %T", obj)
	}
	key := release.ReleaseTarget.Key()
	return true, []byte(key + "\x00"), nil
}

func (r *ReleaseTargetKeyIndexer) FromArgs(args ...any) ([]byte, error) {
	if len(args) != 1 {
		return nil, fmt.Errorf("must provide exactly one argument")
	}
	key, ok := args[0].(string)
	if !ok {
		return nil, fmt.Errorf("argument must be a string")
	}
	return []byte(key + "\x00"), nil
}
