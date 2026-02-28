package convert

import (
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

func Deployment(row db.Deployment) *oapi.Deployment {
	d := &oapi.Deployment{
		Id:             row.ID.String(),
		Name:           row.Name,
		JobAgentConfig: oapi.JobAgentConfig(row.JobAgentConfig),
		Metadata:       row.Metadata,
	}
	if row.Description != "" {
		d.Description = &row.Description
	}
	if row.JobAgentID != uuid.Nil {
		s := row.JobAgentID.String()
		d.JobAgentId = &s
	}
	return d
}

func Environment(row db.Environment) *oapi.Environment {
	e := &oapi.Environment{
		Id:       row.ID.String(),
		Name:     row.Name,
		Metadata: row.Metadata,
	}
	if row.Description.Valid {
		e.Description = &row.Description.String
	}
	if row.CreatedAt.Valid {
		e.CreatedAt = row.CreatedAt.Time
	}
	return e
}

func Resource(row db.GetResourceByIDRow) *oapi.Resource {
	r := &oapi.Resource{
		Id:          row.ID.String(),
		Name:        row.Name,
		Version:     row.Version,
		Kind:        row.Kind,
		Identifier:  row.Identifier,
		WorkspaceId: row.WorkspaceID.String(),
		Config:      row.Config,
		Metadata:    row.Metadata,
	}
	if row.ProviderID != uuid.Nil {
		s := row.ProviderID.String()
		r.ProviderId = &s
	}
	if row.CreatedAt.Valid {
		r.CreatedAt = row.CreatedAt.Time
	}
	if row.UpdatedAt.Valid {
		t := row.UpdatedAt.Time
		r.UpdatedAt = &t
	}
	if row.DeletedAt.Valid {
		t := row.DeletedAt.Time
		r.DeletedAt = &t
	}
	return r
}

func DeploymentVersion(row db.DeploymentVersion) *oapi.DeploymentVersion {
	v := &oapi.DeploymentVersion{
		Id:             row.ID.String(),
		Name:           row.Name,
		Tag:            row.Tag,
		Config:         row.Config,
		JobAgentConfig: oapi.JobAgentConfig(row.JobAgentConfig),
		DeploymentId:   row.DeploymentID.String(),
		Metadata:       row.Metadata,
		Status:         oapi.DeploymentVersionStatus(row.Status),
	}
	if row.Message.Valid {
		v.Message = &row.Message.String
	}
	if row.CreatedAt.Valid {
		v.CreatedAt = row.CreatedAt.Time
	}
	return v
}
