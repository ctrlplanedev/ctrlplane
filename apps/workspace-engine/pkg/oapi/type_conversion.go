package oapi

import "fmt"

func ConvertToOapiResource(entity any) (*Resource, error) {
	resource, ok := entity.(*Resource)
	if !ok {
		return nil, fmt.Errorf("entity is not a resource")
	}
	return resource, nil
}

func ConvertToOapiDeployment(entity any) (*Deployment, error) {
	deployment, ok := entity.(*Deployment)
	if !ok {
		return nil, fmt.Errorf("entity is not a deployment")
	}
	return deployment, nil
}

func ConvertToOapiEnvironment(entity any) (*Environment, error) {
	environment, ok := entity.(*Environment)
	if !ok {
		return nil, fmt.Errorf("entity is not an environment")
	}
	return environment, nil
}

func ConvertToOapiJob(entity any) (*Job, error) {
	job, ok := entity.(*Job)
	if !ok {
		return nil, fmt.Errorf("entity is not a job")
	}
	return job, nil
}

func ConvertToOapiJobAgent(entity any) (*JobAgent, error) {
	jobAgent, ok := entity.(*JobAgent)
	if !ok {
		return nil, fmt.Errorf("entity is not a job agent")
	}
	return jobAgent, nil
}

func ConvertToOapiRelease(entity any) (*Release, error) {
	release, ok := entity.(*Release)
	if !ok {
		return nil, fmt.Errorf("entity is not a release")
	}
	return release, nil
}

func ConvertToOapiRelationshipRule(entity any) (*RelationshipRule, error) {
	relationshipRule, ok := entity.(*RelationshipRule)
	if !ok {
		return nil, fmt.Errorf("entity is not a relationship rule")
	}
	return relationshipRule, nil
}

func ConvertToOapiPolicy(entity any) (*Policy, error) {
	policy, ok := entity.(*Policy)
	if !ok {
		return nil, fmt.Errorf("entity is not a policy")
	}
	return policy, nil
}

func ConvertToOapiPolicyTargetSelector(entity any) (*PolicyTargetSelector, error) {
	policyTargetSelector, ok := entity.(*PolicyTargetSelector)
	if !ok {
		return nil, fmt.Errorf("entity is not a policy target selector")
	}
	return policyTargetSelector, nil
}

func ConvertToOapiPolicyRule(entity any) (*PolicyRule, error) {
	policyRule, ok := entity.(*PolicyRule)
	if !ok {
		return nil, fmt.Errorf("entity is not a policy rule")
	}
	return policyRule, nil
}

func ConvertToOapiUserApprovalRecord(entity any) (*UserApprovalRecord, error) {
	userApprovalRecord, ok := entity.(*UserApprovalRecord)
	if !ok {
		return nil, fmt.Errorf("entity is not a user approval record")
	}

	return userApprovalRecord, nil
}
