package oapi

import "strconv"

// CompactionKey implementations for all entities
// These enable entities to be persisted using the persistence layer

func (r *Resource) CompactionKey() (string, string) {
	return "resource", r.Id
}

func (rp *ResourceProvider) CompactionKey() (string, string) {
	return "resource_provider", rp.Id
}

func (rv *ResourceVariable) CompactionKey() (string, string) {
	return "resource_variable", rv.ID()
}

func (d *Deployment) CompactionKey() (string, string) {
	return "deployment", d.Id
}

func (dv *DeploymentVersion) CompactionKey() (string, string) {
	return "deployment_version", dv.Id
}

func (dvar *DeploymentVariable) CompactionKey() (string, string) {
	return "deployment_variable", dvar.Id
}

func (e *Environment) CompactionKey() (string, string) {
	return "environment", e.Id
}

func (p *Policy) CompactionKey() (string, string) {
	return "policy", p.Id
}

func (s *System) CompactionKey() (string, string) {
	return "system", s.Id
}

func (r *Release) CompactionKey() (string, string) {
	return "release", r.ID()
}

func (j *Job) CompactionKey() (string, string) {
	return "job", j.Id
}

func (ja *JobAgent) CompactionKey() (string, string) {
	return "job_agent", ja.Id
}

func (uar *UserApprovalRecord) CompactionKey() (string, string) {
	return "user_approval_record", uar.Key()
}

func (rr *RelationshipRule) CompactionKey() (string, string) {
	return "relationship_rule", rr.Id
}

func (ge *GithubEntity) CompactionKey() (string, string) {
	return "github_entity", ge.Slug + "-" + strconv.Itoa(ge.InstallationId)
}
