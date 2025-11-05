package repository

import (
	"workspace-engine/pkg/memsql"
)

func EnvironmentsTable() *memsql.TableBuilder {
	return memsql.NewTableBuilder("environments").
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("description", "TEXT").
		WithColumn("systemId", "TEXT").
		WithColumn("resourceSelector", "TEXT"). // JSON
		WithColumn("createdAt", "INTEGER").
		WithPrimaryKey("id").
		WithIndex("CREATE INDEX idx_environments_systemId ON environments(systemId)")
}
