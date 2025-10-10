package events

import (
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/events/handler/deployment"
	"workspace-engine/pkg/events/handler/deploymentvariables"
	"workspace-engine/pkg/events/handler/deploymentversion"
	"workspace-engine/pkg/events/handler/environment"
	"workspace-engine/pkg/events/handler/jobagents"
	"workspace-engine/pkg/events/handler/jobs"
	"workspace-engine/pkg/events/handler/policies"
	"workspace-engine/pkg/events/handler/relationshiprules"
	"workspace-engine/pkg/events/handler/resources"
	"workspace-engine/pkg/events/handler/resourcevariables"
	"workspace-engine/pkg/events/handler/system"
	"workspace-engine/pkg/events/handler/userapprovalrecords"
)

var handlers = handler.HandlerRegistry{
	handler.DeploymentVersionCreate: deploymentversion.HandleDeploymentVersionCreated,
	handler.DeploymentVersionUpdate: deploymentversion.HandleDeploymentVersionUpdated,
	handler.DeploymentVersionDelete: deploymentversion.HandleDeploymentVersionDeleted,

	handler.ResourceCreate: resources.HandleResourceCreated,
	handler.ResourceUpdate: resources.HandleResourceUpdated,
	handler.ResourceDelete: resources.HandleResourceDeleted,

	handler.ResourceProviderCreate: resources.HandleResourceProviderCreated,
	handler.ResourceProviderUpdate: resources.HandleResourceProviderUpdated,
	handler.ResourceProviderDelete: resources.HandleResourceProviderDeleted,

	handler.ResourceVariableCreate: resourcevariables.HandleResourceVariableCreated,
	handler.ResourceVariableUpdate: resourcevariables.HandleResourceVariableUpdated,
	handler.ResourceVariableDelete: resourcevariables.HandleResourceVariableDeleted,

	handler.DeploymentCreate: deployment.HandleDeploymentCreated,
	handler.DeploymentUpdate: deployment.HandleDeploymentUpdated,
	handler.DeploymentDelete: deployment.HandleDeploymentDeleted,

	handler.DeploymentVariableCreate: deploymentvariables.HandleDeploymentVariableCreated,
	handler.DeploymentVariableUpdate: deploymentvariables.HandleDeploymentVariableUpdated,
	handler.DeploymentVariableDelete: deploymentvariables.HandleDeploymentVariableDeleted,

	handler.SystemCreate: system.HandleSystemCreated,
	handler.SystemUpdate: system.HandleSystemUpdated,
	handler.SystemDelete: system.HandleSystemDeleted,

	handler.EnvironmentCreate: environment.HandleEnvironmentCreated,
	handler.EnvironmentUpdate: environment.HandleEnvironmentUpdated,
	handler.EnvironmentDelete: environment.HandleEnvironmentDeleted,

	handler.JobAgentCreate: jobagents.HandleJobAgentCreated,
	handler.JobAgentUpdate: jobagents.HandleJobAgentUpdated,
	handler.JobAgentDelete: jobagents.HandleJobAgentDeleted,

	handler.JobUpdate: jobs.HandleJobUpdated,

	handler.PolicyCreate: policies.HandlePolicyCreated,
	handler.PolicyUpdate: policies.HandlePolicyUpdated,
	handler.PolicyDelete: policies.HandlePolicyDeleted,

	handler.RelationshipRuleCreate: relationshiprules.HandleRelationshipRuleCreated,
	handler.RelationshipRuleUpdate: relationshiprules.HandleRelationshipRuleUpdated,
	handler.RelationshipRuleDelete: relationshiprules.HandleRelationshipRuleDeleted,

	handler.UserApprovalRecordCreate: userapprovalrecords.HandleUserApprovalRecordCreated,
	handler.UserApprovalRecordUpdate: userapprovalrecords.HandleUserApprovalRecordUpdated,
	handler.UserApprovalRecordDelete: userapprovalrecords.HandleUserApprovalRecordDeleted,
}

func NewEventHandler() *handler.EventListener {
	return handler.NewEventListener(handlers)
}
