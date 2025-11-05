package repository

import (
	"workspace-engine/pkg/memsql"
)

func EnvironmentsTable(workspaceId string) *memsql.TableBuilder {
	return memsql.NewTableBuilder("environments_" + workspaceId).
		WithColumn("id", "TEXT NOT NULL").
		WithColumn("name", "TEXT").
		WithColumn("description", "TEXT").
		WithColumn("systemId", "TEXT").
		WithColumn("resourceSelector", "TEXT"). // JSON
		WithColumn("createdAt", "INTEGER").
		WithPrimaryKey("id")
}
