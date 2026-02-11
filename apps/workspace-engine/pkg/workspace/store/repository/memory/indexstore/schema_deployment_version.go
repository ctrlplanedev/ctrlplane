package indexstore

import (
	"github.com/hashicorp/go-memdb"
)

var DeploymentVersionSchema = &memdb.TableSchema{
	Name: "deployment_version",
	Indexes: map[string]*memdb.IndexSchema{
		"id": {
			Name:   "id",
			Unique: true,
			Indexer: &memdb.StringFieldIndex{
				Field: "Id",
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
