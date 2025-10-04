package rules

import "workspace-engine/pkg/pb"

// GetRuleType extracts the rule type from a PolicyRule protobuf message.
func GetRuleType(rule *pb.PolicyRule) string {
	if rule == nil {
		return "unknown"
	}

	switch rule.GetRule().(type) {
	case *pb.PolicyRule_DenyWindow:
		return "deny_window"
	case *pb.PolicyRule_UserApproval:
		return "user_approval"
	case *pb.PolicyRule_RoleApproval:
		return "role_approval"
	case *pb.PolicyRule_AnyApproval:
		return "any_approval"
	case *pb.PolicyRule_Concurrency:
		return "concurrency"
	case *pb.PolicyRule_MaxRetries:
		return "max_retries"
	case *pb.PolicyRule_EnvironmentVersionRollout:
		return "environment_version_rollout"
	case *pb.PolicyRule_DeploymentVersionSelector:
		return "deployment_version_selector"
	default:
		return "unknown"
	}
}

