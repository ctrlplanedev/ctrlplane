package oapi

import "fmt"

// ConvertToOapiResource converts a generic entity to a Resource type.
// Returns an error if the entity is not a *Resource.
func ConvertToOapiResource(entity any) (*Resource, error) {
	resource, ok := entity.(*Resource)
	if !ok {
		return nil, fmt.Errorf("entity is not a resource")
	}
	return resource, nil
}

// ConvertToOapiDeployment converts a generic entity to a Deployment type.
// Returns an error if the entity is not a *Deployment.
func ConvertToOapiDeployment(entity any) (*Deployment, error) {
	deployment, ok := entity.(*Deployment)
	if !ok {
		return nil, fmt.Errorf("entity is not a deployment")
	}
	return deployment, nil
}

// ConvertToOapiEnvironment converts a generic entity to an Environment type.
// Returns an error if the entity is not an *Environment.
func ConvertToOapiEnvironment(entity any) (*Environment, error) {
	environment, ok := entity.(*Environment)
	if !ok {
		return nil, fmt.Errorf("entity is not an environment")
	}
	return environment, nil
}

// ConvertToOapiJob converts a generic entity to a Job type.
// Returns an error if the entity is not a *Job.
func ConvertToOapiJob(entity any) (*Job, error) {
	job, ok := entity.(*Job)
	if !ok {
		return nil, fmt.Errorf("entity is not a job")
	}
	return job, nil
}

// ConvertToOapiJobAgent converts a generic entity to a JobAgent type.
// Returns an error if the entity is not a *JobAgent.
func ConvertToOapiJobAgent(entity any) (*JobAgent, error) {
	jobAgent, ok := entity.(*JobAgent)
	if !ok {
		return nil, fmt.Errorf("entity is not a job agent")
	}
	return jobAgent, nil
}

// ConvertToOapiRelease converts a generic entity to a Release type.
// Returns an error if the entity is not a *Release.
func ConvertToOapiRelease(entity any) (*Release, error) {
	release, ok := entity.(*Release)
	if !ok {
		return nil, fmt.Errorf("entity is not a release")
	}
	return release, nil
}

// ConvertToOapiRelationshipRule converts a generic entity to a RelationshipRule type.
// Returns an error if the entity is not a *RelationshipRule.
func ConvertToOapiRelationshipRule(entity any) (*RelationshipRule, error) {
	relationshipRule, ok := entity.(*RelationshipRule)
	if !ok {
		return nil, fmt.Errorf("entity is not a relationship rule")
	}
	return relationshipRule, nil
}

// ConvertToOapiPolicy converts a generic entity to a Policy type.
// Returns an error if the entity is not a *Policy.
func ConvertToOapiPolicy(entity any) (*Policy, error) {
	policy, ok := entity.(*Policy)
	if !ok {
		return nil, fmt.Errorf("entity is not a policy")
	}
	return policy, nil
}

// ConvertToOapiPolicyTargetSelector converts a generic entity to a PolicyTargetSelector type.
// Returns an error if the entity is not a *PolicyTargetSelector.
func ConvertToOapiPolicyTargetSelector(entity any) (*PolicyTargetSelector, error) {
	policyTargetSelector, ok := entity.(*PolicyTargetSelector)
	if !ok {
		return nil, fmt.Errorf("entity is not a policy target selector")
	}
	return policyTargetSelector, nil
}

// ConvertToOapiPolicyRule converts a generic entity to a PolicyRule type.
// Returns an error if the entity is not a *PolicyRule.
func ConvertToOapiPolicyRule(entity any) (*PolicyRule, error) {
	policyRule, ok := entity.(*PolicyRule)
	if !ok {
		return nil, fmt.Errorf("entity is not a policy rule")
	}
	return policyRule, nil
}

// ConvertToOapiUserApprovalRecord converts a generic entity to a UserApprovalRecord type.
// Returns an error if the entity is not a *UserApprovalRecord.
func ConvertToOapiUserApprovalRecord(entity any) (*UserApprovalRecord, error) {
	userApprovalRecord, ok := entity.(*UserApprovalRecord)
	if !ok {
		return nil, fmt.Errorf("entity is not a user approval record")
	}

	return userApprovalRecord, nil
}

// ConvertToOapiSystem converts a generic entity to a System type.
// Returns an error if the entity is not a *System.
func ConvertToOapiSystem(entity any) (*System, error) {
	system, ok := entity.(*System)
	if !ok {
		return nil, fmt.Errorf("entity is not a system")
	}
	return system, nil
}

// ConvertToOapiDeploymentVariable converts a generic entity to a DeploymentVariable type.
// Returns an error if the entity is not a *DeploymentVariable.
func ConvertToOapiDeploymentVariable(entity any) (*DeploymentVariable, error) {
	deploymentVariable, ok := entity.(*DeploymentVariable)
	if !ok {
		return nil, fmt.Errorf("entity is not a deployment variable")
	}
	return deploymentVariable, nil
}

// ConvertToOapiDeploymentVersion converts a generic entity to a DeploymentVersion type.
// Returns an error if the entity is not a *DeploymentVersion.
func ConvertToOapiDeploymentVersion(entity any) (*DeploymentVersion, error) {
	deploymentVersion, ok := entity.(*DeploymentVersion)
	if !ok {
		return nil, fmt.Errorf("entity is not a deployment version")
	}
	return deploymentVersion, nil
}
