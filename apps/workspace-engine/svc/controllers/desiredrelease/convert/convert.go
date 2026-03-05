package convert

import (
	"encoding/json"

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

func Policy(row db.Policy) *oapi.Policy {
	p := &oapi.Policy{
		Id:          row.ID.String(),
		Name:        row.Name,
		Selector:    row.Selector,
		Metadata:    row.Metadata,
		Priority:    int(row.Priority),
		Enabled:     row.Enabled,
		WorkspaceId: row.WorkspaceID.String(),
	}
	if row.Description.Valid {
		p.Description = &row.Description.String
	}
	if row.CreatedAt.Valid {
		p.CreatedAt = row.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	return p
}

func UserApprovalRecord(row db.UserApprovalRecord) *oapi.UserApprovalRecord {
	r := &oapi.UserApprovalRecord{
		VersionId:     row.VersionID.String(),
		UserId:        row.UserID.String(),
		EnvironmentId: row.EnvironmentID.String(),
		Status:        oapi.ApprovalStatus(row.Status),
	}
	if row.Reason.Valid {
		r.Reason = &row.Reason.String
	}
	if row.CreatedAt.Valid {
		r.CreatedAt = row.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	return r
}

func PolicySkip(row db.PolicySkip) *oapi.PolicySkip {
	s := &oapi.PolicySkip{
		Id:        row.ID.String(),
		CreatedBy: row.CreatedBy,
		Reason:    row.Reason,
		RuleId:    row.RuleID.String(),
		VersionId: row.VersionID.String(),
	}
	if row.CreatedAt.Valid {
		s.CreatedAt = row.CreatedAt.Time
	}
	if row.EnvironmentID != uuid.Nil {
		e := row.EnvironmentID.String()
		s.EnvironmentId = &e
	}
	if row.ResourceID != uuid.Nil {
		r := row.ResourceID.String()
		s.ResourceId = &r
	}
	if row.ExpiresAt.Valid {
		t := row.ExpiresAt.Time
		s.ExpiresAt = &t
	}
	return s
}

func DeploymentVariable(row db.DeploymentVariable) oapi.DeploymentVariable {
	v := oapi.DeploymentVariable{
		Id:           row.ID.String(),
		DeploymentId: row.DeploymentID.String(),
		Key:          row.Key,
	}
	if row.Description.Valid {
		v.Description = &row.Description.String
	}
	if len(row.DefaultValue) > 0 {
		var lv oapi.LiteralValue
		if err := json.Unmarshal(row.DefaultValue, &lv); err == nil {
			v.DefaultValue = &lv
		}
	}
	return v
}

func DeploymentVariableValue(row db.DeploymentVariableValue) oapi.DeploymentVariableValue {
	v := oapi.DeploymentVariableValue{
		Id:                   row.ID.String(),
		DeploymentVariableId: row.DeploymentVariableID.String(),
		Priority:             row.Priority,
	}
	if len(row.Value) > 0 {
		_ = json.Unmarshal(row.Value, &v.Value)
	}
	if row.ResourceSelector.Valid {
		var sel oapi.Selector
		if err := sel.FromCelSelector(oapi.CelSelector{Cel: row.ResourceSelector.String}); err == nil {
			v.ResourceSelector = &sel
		}
	}
	return v
}

func ResourceVariable(row db.ResourceVariable) oapi.ResourceVariable {
	v := oapi.ResourceVariable{
		ResourceId: row.ResourceID.String(),
		Key:        row.Key,
	}
	if len(row.Value) > 0 {
		_ = json.Unmarshal(row.Value, &v.Value)
	}
	return v
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
