package db

import (
	"encoding/json"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"workspace-engine/pkg/oapi"
)

func ToOapiDeployment(row Deployment) *oapi.Deployment {
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
	if row.JobAgents != nil {
		var jobAgents []oapi.DeploymentJobAgent
		if err := json.Unmarshal(row.JobAgents, &jobAgents); err == nil {
			d.JobAgents = &jobAgents
		}
	}
	return d
}

func ToOapiEnvironment(row Environment) *oapi.Environment {
	e := &oapi.Environment{
		Id:          row.ID.String(),
		Name:        row.Name,
		Metadata:    row.Metadata,
		WorkspaceId: row.WorkspaceID.String(),
	}
	if row.Description.Valid {
		e.Description = &row.Description.String
	}
	if row.CreatedAt.Valid {
		e.CreatedAt = row.CreatedAt.Time
	}
	return e
}

func ToOapiResource(row GetResourceByIDRow) *oapi.Resource {
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

func ToOapiPolicyWithRules(row ListPoliciesWithRulesByWorkspaceIDRow) *oapi.Policy {
	p := ToOapiPolicy(Policy{
		ID:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		Selector:    row.Selector,
		Metadata:    row.Metadata,
		Priority:    row.Priority,
		Enabled:     row.Enabled,
		WorkspaceID: row.WorkspaceID,
		CreatedAt:   row.CreatedAt,
	})

	type approvalJSON struct {
		Id           string `json:"id"`
		MinApprovals int32  `json:"minApprovals"`
	}
	var approvals []approvalJSON
	_ = json.Unmarshal(row.ApprovalRules, &approvals)
	for _, a := range approvals {
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:       a.Id,
			PolicyId: p.Id,
			AnyApproval: &oapi.AnyApprovalRule{
				MinApprovals: a.MinApprovals,
			},
		})
	}

	type windowJSON struct {
		Id              string  `json:"id"`
		AllowWindow     *bool   `json:"allowWindow"`
		DurationMinutes int32   `json:"durationMinutes"`
		Rrule           string  `json:"rrule"`
		Timezone        *string `json:"timezone"`
	}
	var windows []windowJSON
	_ = json.Unmarshal(row.DeploymentWindowRules, &windows)
	for _, w := range windows {
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:       w.Id,
			PolicyId: p.Id,
			DeploymentWindow: &oapi.DeploymentWindowRule{
				AllowWindow:     w.AllowWindow,
				DurationMinutes: w.DurationMinutes,
				Rrule:           w.Rrule,
				Timezone:        w.Timezone,
			},
		})
	}

	type dependencyJSON struct {
		Id        string `json:"id"`
		DependsOn string `json:"dependsOn"`
	}
	var deps []dependencyJSON
	_ = json.Unmarshal(row.DeploymentDependencyRules, &deps)
	for _, d := range deps {
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:       d.Id,
			PolicyId: p.Id,
			DeploymentDependency: &oapi.DeploymentDependencyRule{
				DependsOn: d.DependsOn,
			},
		})
	}

	type progressionJSON struct {
		Id                           string    `json:"id"`
		DependsOnEnvironmentSelector string    `json:"dependsOnEnvironmentSelector"`
		MaximumAgeHours              *int32    `json:"maximumAgeHours"`
		MinimumSoakTimeMinutes       *int32    `json:"minimumSoakTimeMinutes"`
		MinimumSuccessPercentage     *float32  `json:"minimumSuccessPercentage"`
		SuccessStatuses              *[]string `json:"successStatuses"`
	}
	var progs []progressionJSON
	_ = json.Unmarshal(row.EnvironmentProgressionRules, &progs)
	for _, pr := range progs {
		rule := oapi.EnvironmentProgressionRule{
			DependsOnEnvironmentSelector: pr.DependsOnEnvironmentSelector,
			MaximumAgeHours:              pr.MaximumAgeHours,
			MinimumSockTimeMinutes:       pr.MinimumSoakTimeMinutes,
			MinimumSuccessPercentage:     pr.MinimumSuccessPercentage,
		}
		if pr.SuccessStatuses != nil {
			statuses := make([]oapi.JobStatus, len(*pr.SuccessStatuses))
			for i, s := range *pr.SuccessStatuses {
				statuses[i] = oapi.JobStatus(s)
			}
			rule.SuccessStatuses = &statuses
		}
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:                     pr.Id,
			PolicyId:               p.Id,
			EnvironmentProgression: &rule,
		})
	}

	type rolloutJSON struct {
		Id                string `json:"id"`
		RolloutType       string `json:"rolloutType"`
		TimeScaleInterval int32  `json:"timeScaleInterval"`
	}
	var rollouts []rolloutJSON
	_ = json.Unmarshal(row.GradualRolloutRules, &rollouts)
	for _, r := range rollouts {
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:       r.Id,
			PolicyId: p.Id,
			GradualRollout: &oapi.GradualRolloutRule{
				RolloutType:       oapi.GradualRolloutRuleRolloutType(r.RolloutType),
				TimeScaleInterval: r.TimeScaleInterval,
			},
		})
	}

	type cooldownJSON struct {
		Id              string `json:"id"`
		IntervalSeconds int32  `json:"intervalSeconds"`
	}
	var cooldowns []cooldownJSON
	_ = json.Unmarshal(row.VersionCooldownRules, &cooldowns)
	for _, c := range cooldowns {
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:       c.Id,
			PolicyId: p.Id,
			VersionCooldown: &oapi.VersionCooldownRule{
				IntervalSeconds: c.IntervalSeconds,
			},
		})
	}

	type selectorJSON struct {
		Id          string  `json:"id"`
		Description *string `json:"description"`
		Selector    string  `json:"selector"`
	}
	var selectors []selectorJSON
	_ = json.Unmarshal(row.VersionSelectorRules, &selectors)
	for _, s := range selectors {
		p.Rules = append(p.Rules, oapi.PolicyRule{
			Id:       s.Id,
			PolicyId: p.Id,
			VersionSelector: &oapi.VersionSelectorRule{
				Description: s.Description,
				Selector:    s.Selector,
			},
		})
	}

	return p
}

func ToOapiPolicy(row Policy) *oapi.Policy {
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

func ToOapiUserApprovalRecord(row UserApprovalRecord) *oapi.UserApprovalRecord {
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

func ToOapiPolicySkip(row PolicySkip) *oapi.PolicySkip {
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

func ToOapiDeploymentVariable(row DeploymentVariable) oapi.DeploymentVariable {
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

func ToOapiDeploymentVariableValue(row DeploymentVariableValue) oapi.DeploymentVariableValue {
	v := oapi.DeploymentVariableValue{
		Id:                   row.ID.String(),
		DeploymentVariableId: row.DeploymentVariableID.String(),
		Priority:             row.Priority,
	}
	if len(row.Value) > 0 {
		_ = json.Unmarshal(row.Value, &v.Value)
	}
	if row.ResourceSelector.Valid && row.ResourceSelector.String != "" {
		v.ResourceSelector = &row.ResourceSelector.String
	}
	return v
}

func ToOapiVariableSetWithVariables(
	row ListVariableSetsWithVariablesByWorkspaceIDRow,
) oapi.VariableSetWithVariables {
	vs := oapi.VariableSetWithVariables{
		Id:          row.ID,
		Name:        row.Name,
		Description: row.Description,
		Selector:    row.Selector,
		Priority:    int64(row.Priority),
		CreatedAt:   row.CreatedAt.Time,
		UpdatedAt:   row.UpdatedAt.Time,
	}

	type varJSON struct {
		Id            string          `json:"id"`
		VariableSetId string          `json:"variableSetId"`
		Key           string          `json:"key"`
		Value         json.RawMessage `json:"value"`
	}
	var varsRaw []varJSON
	_ = json.Unmarshal(row.Variables, &varsRaw)
	vs.Variables = make([]oapi.VariableSetVariable, 0, len(varsRaw))
	for _, v := range varsRaw {
		var val oapi.Value
		_ = val.UnmarshalJSON(v.Value)
		id, err := uuid.Parse(v.Id)
		if err != nil {
			continue
		}
		variableSetId, err := uuid.Parse(v.VariableSetId)
		if err != nil {
			continue
		}
		vs.Variables = append(vs.Variables, oapi.VariableSetVariable{
			Id:            id,
			VariableSetId: variableSetId,
			Key:           v.Key,
			Value:         val,
		})
	}
	return vs
}

func ToOapiResourceVariable(row ResourceVariable) oapi.ResourceVariable {
	v := oapi.ResourceVariable{
		ResourceId: row.ResourceID.String(),
		Key:        row.Key,
	}
	if len(row.Value) > 0 {
		_ = json.Unmarshal(row.Value, &v.Value)
	}
	return v
}

func ToOapiSystem(row System) *oapi.System {
	s := &oapi.System{
		Id:          row.ID.String(),
		Name:        row.Name,
		WorkspaceId: row.WorkspaceID.String(),
	}
	if row.Description != "" {
		s.Description = &row.Description
	}
	return s
}

func ToOapiRelease(row Release) *oapi.Release {
	var createdAt string
	if row.CreatedAt.Valid {
		createdAt = row.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00")
	}
	return &oapi.Release{
		Id:        row.ID,
		CreatedAt: createdAt,
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    row.ResourceID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			DeploymentId:  row.DeploymentID.String(),
		},
		EncryptedVariables: []string{},
		Variables:          map[string]oapi.LiteralValue{},
	}
}

func ToOapiFullRelease(row GetDesiredReleaseByReleaseTargetRow) *oapi.Release {
	variables := make(map[string]oapi.LiteralValue)
	if len(row.Variables) > 0 {
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(row.Variables, &raw); err != nil {
			log.Error("failed to unmarshal release variables", "error", err)
		} else {
			for k, v := range raw {
				var lv oapi.LiteralValue
				if err := lv.UnmarshalJSON(v); err != nil {
					log.Error("failed to unmarshal literal value", "key", k, "error", err)
					continue
				}
				variables[k] = lv
			}
		}
	}

	var versionMessage *string
	if row.VersionMessage.Valid {
		versionMessage = &row.VersionMessage.String
	}

	return &oapi.Release{
		Id:        row.ID,
		CreatedAt: row.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		ReleaseTarget: oapi.ReleaseTarget{
			ResourceId:    row.ResourceID.String(),
			EnvironmentId: row.EnvironmentID.String(),
			DeploymentId:  row.DeploymentID.String(),
		},
		EncryptedVariables: []string{},
		Variables:          variables,
		Version: oapi.DeploymentVersion{
			Id:             row.VersionID.String(),
			Name:           row.VersionName,
			Tag:            row.VersionTag,
			Config:         row.VersionConfig,
			JobAgentConfig: oapi.JobAgentConfig(row.VersionJobAgentConfig),
			DeploymentId:   row.DeploymentID.String(),
			Metadata:       row.VersionMetadata,
			Status:         oapi.DeploymentVersionStatus(row.VersionStatus),
			Message:        versionMessage,
			CreatedAt:      row.VersionCreatedAt.Time,
		},
	}
}

func ToOapiDeploymentVersion(row DeploymentVersion) *oapi.DeploymentVersion {
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

func ToOapiJobFromLatestCompleted(row GetLatestCompletedJobForReleaseTargetRow) *oapi.Job {
	return ToOapiJob(ListJobsByReleaseIDRow(row))
}

func ToOapiJobFromGetJobByIDRow(row GetJobByIDRow) *oapi.Job {
	return ToOapiJob(ListJobsByReleaseIDRow(row))
}

func ToOapiJob(row ListJobsByReleaseIDRow) *oapi.Job {
	j := &oapi.Job{
		Id:        row.ID.String(),
		Status:    ToOapiJobStatus(row.Status),
		ReleaseId: row.ReleaseID.String(),
	}
	if row.CreatedAt.Valid {
		j.CreatedAt = row.CreatedAt.Time
	}
	if row.CompletedAt.Valid {
		t := row.CompletedAt.Time
		j.CompletedAt = &t
	}
	if row.StartedAt.Valid {
		t := row.StartedAt.Time
		j.StartedAt = &t
	}
	if row.UpdatedAt.Valid {
		j.UpdatedAt = row.UpdatedAt.Time
	}
	if row.ExternalID.Valid {
		j.ExternalId = &row.ExternalID.String
	}
	if row.Message.Valid {
		j.Message = &row.Message.String
	}
	if row.JobAgentID.Valid {
		j.JobAgentId = uuid.UUID(row.JobAgentID.Bytes).String()
	}
	if len(row.JobAgentConfig) > 0 {
		var cfg oapi.JobAgentConfig
		if err := json.Unmarshal(row.JobAgentConfig, &cfg); err == nil {
			j.JobAgentConfig = cfg
		}
	}
	j.Metadata = parseJobMetadata(row.Metadata)
	if len(row.DispatchContext) > 0 {
		j.DispatchContext = parseDispatchContext(row.DispatchContext)
	}
	return j
}

func extractVariablesKey(raw json.RawMessage) (json.RawMessage, json.RawMessage) {
	var obj map[string]json.RawMessage
	if json.Unmarshal(raw, &obj) != nil {
		return raw, nil
	}
	varsRaw := obj["variables"]
	delete(obj, "variables")
	out, err := json.Marshal(obj)
	if err != nil {
		return raw, nil
	}
	return out, varsRaw
}

func parseLiteralValues(raw json.RawMessage) map[string]oapi.LiteralValue {
	if len(raw) == 0 {
		return nil
	}
	var varsMap map[string]any
	if json.Unmarshal(raw, &varsMap) != nil {
		return nil
	}
	vars := make(map[string]oapi.LiteralValue, len(varsMap))
	for k, val := range varsMap {
		var lv oapi.LiteralValue
		switch t := val.(type) {
		case string:
			_ = lv.FromStringValue(t)
		case float64:
			_ = lv.FromNumberValue(float32(t))
		case bool:
			_ = lv.FromBooleanValue(oapi.BooleanValue(t))
		default:
			continue
		}
		vars[k] = lv
	}
	return vars
}

func parseDispatchContext(raw []byte) *oapi.DispatchContext {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil
	}

	varsRaw := fields["variables"]
	delete(fields, "variables")

	var releaseVarsRaw json.RawMessage
	if release, ok := fields["release"]; ok {
		fields["release"], releaseVarsRaw = extractVariablesKey(release)
	}

	stripped, err := json.Marshal(fields)
	if err != nil {
		return nil
	}

	var dc oapi.DispatchContext
	if err := json.Unmarshal(stripped, &dc); err != nil {
		return nil
	}

	if vars := parseLiteralValues(varsRaw); vars != nil {
		dc.Variables = &vars
	}

	if releaseVars := parseLiteralValues(releaseVarsRaw); releaseVars != nil && dc.Release != nil {
		dc.Release.Variables = releaseVars
	}

	return &dc
}

func parseJobMetadata(raw []byte) map[string]string {
	if len(raw) == 0 {
		return map[string]string{}
	}
	var items []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}
	if err := json.Unmarshal(raw, &items); err != nil {
		return map[string]string{}
	}
	result := make(map[string]string, len(items))
	for _, item := range items {
		result[item.Key] = item.Value
	}
	return result
}

var oapiToDBJobStatus = map[oapi.JobStatus]JobStatus{
	oapi.JobStatusPending:             JobStatusPending,
	oapi.JobStatusInProgress:          JobStatusInProgress,
	oapi.JobStatusActionRequired:      JobStatusActionRequired,
	oapi.JobStatusSuccessful:          JobStatusSuccessful,
	oapi.JobStatusFailure:             JobStatusFailure,
	oapi.JobStatusCancelled:           JobStatusCancelled,
	oapi.JobStatusSkipped:             JobStatusSkipped,
	oapi.JobStatusInvalidJobAgent:     JobStatusInvalidJobAgent,
	oapi.JobStatusInvalidIntegration:  JobStatusInvalidIntegration,
	oapi.JobStatusExternalRunNotFound: JobStatusExternalRunNotFound,
}

var dbToOapiJobStatus = map[JobStatus]oapi.JobStatus{
	JobStatusPending:             oapi.JobStatusPending,
	JobStatusInProgress:          oapi.JobStatusInProgress,
	JobStatusActionRequired:      oapi.JobStatusActionRequired,
	JobStatusSuccessful:          oapi.JobStatusSuccessful,
	JobStatusFailure:             oapi.JobStatusFailure,
	JobStatusCancelled:           oapi.JobStatusCancelled,
	JobStatusSkipped:             oapi.JobStatusSkipped,
	JobStatusInvalidJobAgent:     oapi.JobStatusInvalidJobAgent,
	JobStatusInvalidIntegration:  oapi.JobStatusInvalidIntegration,
	JobStatusExternalRunNotFound: oapi.JobStatusExternalRunNotFound,
}

func ToDBJobStatus(s oapi.JobStatus) JobStatus {
	if dbStatus, ok := oapiToDBJobStatus[s]; ok {
		return dbStatus
	}
	return JobStatus(s)
}

func ToOapiJobStatus(s JobStatus) oapi.JobStatus {
	if oapiStatus, ok := dbToOapiJobStatus[s]; ok {
		return oapiStatus
	}
	return oapi.JobStatus(s)
}

func ToOapiJobAgent(row JobAgent) *oapi.JobAgent {
	return &oapi.JobAgent{
		Id:          row.ID.String(),
		WorkspaceId: row.WorkspaceID.String(),
		Name:        row.Name,
		Type:        row.Type,
		Config:      oapi.JobAgentConfig(row.Config),
	}
}
