package oapi

func IsJob(entity any) (*Job, bool) {
	job, ok := entity.(*Job)
	if !ok {
		return nil, false
	}
	return job, true
}

// ConvertToOapiResource converts a generic entity to a Resource type.
// Returns an error if the entity is not a *Resource.
func IsResource(entity any) (*Resource, bool) {
	resource, ok := entity.(*Resource)
	if !ok {
		return nil, false
	}
	return resource, true
}

// ConvertToOapiDeployment converts a generic entity to a Deployment type.
// Returns an error if the entity is not a *Deployment.
func IsDeployment(entity any) (*Deployment, bool) {
	deployment, ok := entity.(*Deployment)
	if !ok {
		return nil, false
	}
	return deployment, true
}

// ConvertToOapiEnvironment converts a generic entity to an Environment type.
// Returns an error if the entity is not an *Environment.
func IsEnvironment(entity any) (*Environment, bool) {
	environment, ok := entity.(*Environment)
	if !ok {
		return nil, false
	}
	return environment, true
}

// ConvertToOapiJob converts a generic entity to a Job type.
// Returns an error if the entity is not a *Job.
func ConvertToOapiJob(entity any) (*Job, bool) {
	job, ok := entity.(*Job)
	if !ok {
		return nil, false
	}
	return job, true
}

// ConvertToOapiJobAgent converts a generic entity to a JobAgent type.
// Returns an error if the entity is not a *JobAgent.
func ConvertToOapiJobAgent(entity any) (*JobAgent, bool) {
	jobAgent, ok := entity.(*JobAgent)
	if !ok {
		return nil, false
	}
	return jobAgent, true
}

// ConvertToOapiRelease converts a generic entity to a Release type.
// Returns an error if the entity is not a *Release.
func IsRelease(entity any) (*Release, bool) {
	release, ok := entity.(*Release)
	if !ok {
		return nil, false
	}
	return release, true
}

// ConvertToOapiRelationshipRule converts a generic entity to a RelationshipRule type.
// Returns an error if the entity is not a *RelationshipRule.
func IsRelationshipRule(entity any) (*RelationshipRule, bool) {
	relationshipRule, ok := entity.(*RelationshipRule)
	if !ok {
		return nil, false
	}
	return relationshipRule, true
}

// ConvertToOapiPolicy converts a generic entity to a Policy type.
// Returns an error if the entity is not a *Policy.
func IsPolicy(entity any) (*Policy, bool) {
	policy, ok := entity.(*Policy)
	if !ok {
		return nil, false
	}
	return policy, true
}

// ConvertToOapiPolicyTargetSelector converts a generic entity to a PolicyTargetSelector type.
// Returns an error if the entity is not a *PolicyTargetSelector.
func IsPolicyTargetSelector(entity any) (*PolicyTargetSelector, bool) {
	policyTargetSelector, ok := entity.(*PolicyTargetSelector)
	if !ok {
		return nil, false
	}
	return policyTargetSelector, true
}

// ConvertToOapiPolicyRule converts a generic entity to a PolicyRule type.
// Returns an error if the entity is not a *PolicyRule.
func IsPolicyRule(entity any) (*PolicyRule, bool) {
	policyRule, ok := entity.(*PolicyRule)
	if !ok {
		return nil, false
	}
	return policyRule, true
}

// ConvertToOapiUserApprovalRecord converts a generic entity to a UserApprovalRecord type.
// Returns an error if the entity is not a *UserApprovalRecord.
func IsUserApprovalRecord(entity any) (*UserApprovalRecord, bool) {
	userApprovalRecord, ok := entity.(*UserApprovalRecord)
	if !ok {
		return nil, false
	}

	return userApprovalRecord, true
}

// ConvertToOapiSystem converts a generic entity to a System type.
// Returns an error if the entity is not a *System.
func IsSystem(entity any) (*System, bool) {
	system, ok := entity.(*System)
	if !ok {
		return nil, false
	}
	return system, true
}

// ConvertToOapiDeploymentVariable converts a generic entity to a DeploymentVariable type.
// Returns an error if the entity is not a *DeploymentVariable.
func IsDeploymentVariable(entity any) (*DeploymentVariable, bool) {
	deploymentVariable, ok := entity.(*DeploymentVariable)
	if !ok {
		return nil, false
	}
	return deploymentVariable, true
}

// ConvertToOapiDeploymentVersion converts a generic entity to a DeploymentVersion type.
// Returns an error if the entity is not a *DeploymentVersion.
func IsDeploymentVersion(entity any) (*DeploymentVersion, bool) {
	deploymentVersion, ok := entity.(*DeploymentVersion)
	if !ok {
		return nil, false
	}
	return deploymentVersion, true
}
