package indexstore

import (
	"github.com/hashicorp/go-memdb"
)

var JobSchema = &memdb.TableSchema{
	Name: "job",
	Indexes: map[string]*memdb.IndexSchema{
		"id": {
			Name:   "id",
			Unique: true,
			Indexer: &memdb.StringFieldIndex{
				Field: "Id", // Must match oapi.Job.Id exactly
			},
		},
		"status": {
			Name:   "status",
			Unique: false,
			Indexer: &memdb.StringFieldIndex{
				Field: "Status",
			},
		},
		"release_id": {
			Name:         "release_id",
			Unique:       false,
			AllowMissing: true,
			Indexer: &memdb.StringFieldIndex{
				Field: "ReleaseId", // Must match oapi.Job.ReleaseId exactly
			},
		},
		"job_agent_id": {
			Name:         "job_agent_id",
			Unique:       false,
			AllowMissing: true,
			Indexer: &memdb.StringFieldIndex{
				Field: "JobAgentId",
			},
		},
	},
}

var Schema = &memdb.DBSchema{
	Tables: map[string]*memdb.TableSchema{
		"job":                JobSchema,
		"release":            ReleaseSchema,
		"release_target":     ReleaseTargetsSchema,
		"deployment_version": DeploymentVersionSchema,
	},
}

func NewDB() (*memdb.MemDB, error) {
	return memdb.NewMemDB(Schema)
}
