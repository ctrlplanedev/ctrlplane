package e2e

import (
	"testing"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/test/integration"
)

func TestEngineRepoWrite(t *testing.T) {
	engine := integration.NewTestWorkspace(t,
		// Job Agents
		integration.WithJobAgent(
			integration.JobAgentID("agent-kubernetes"),
			integration.JobAgentName("Kubernetes Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID("agent-terraform"),
			integration.JobAgentName("Terraform Agent"),
		),
		integration.WithJobAgent(
			integration.JobAgentID("agent-ansible"),
			integration.JobAgentName("Ansible Agent"),
		),

		// E-commerce System
		integration.WithSystem(
			integration.SystemID("system-ecommerce"),
			integration.SystemName("ecommerce-platform"),
			integration.WithDeployment(
				integration.DeploymentID("deploy-api"),
				integration.DeploymentName("api-service"),
				integration.DeploymentJobAgent("agent-kubernetes"),
				integration.DeploymentJobAgentConfig(map[string]any{
					"namespace": "production",
					"replicas":  3,
				}),
				integration.WithDeploymentVariable(
					"app_version",
					integration.DeploymentVariableStringValue("2.5.0"),
				),
				integration.WithDeploymentVariable(
					"log_level",
					integration.DeploymentVariableStringValue("info"),
				),
				integration.WithDeploymentVariable(
					"max_connections",
					integration.DeploymentVariableIntValue(1000),
				),
				integration.WithDeploymentVariable(
					"feature_flags",
					integration.DeploymentVariableLiteralValue(map[string]any{
						"new_checkout":    true,
						"recommendations": true,
						"experimental":    false,
					}),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID("deploy-worker"),
				integration.DeploymentName("background-worker"),
				integration.DeploymentJobAgent("agent-kubernetes"),
				integration.WithDeploymentVariable(
					"queue_name",
					integration.DeploymentVariableStringValue("processing"),
				),
				integration.WithDeploymentVariable(
					"worker_count",
					integration.DeploymentVariableIntValue(5),
				),
			),
			integration.WithDeployment(
				integration.DeploymentID("deploy-frontend"),
				integration.DeploymentName("web-frontend"),
				integration.DeploymentJobAgent("agent-kubernetes"),
				integration.WithDeploymentVariable(
					"cdn_enabled",
					integration.DeploymentVariableBoolValue(true),
				),
			),
			integration.WithEnvironment(
				integration.EnvironmentID("env-production"),
				integration.EnvironmentName("production"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID("env-staging"),
				integration.EnvironmentName("staging"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID("env-dev"),
				integration.EnvironmentName("development"),
			),
		),

		// Analytics System
		integration.WithSystem(
			integration.SystemID("system-analytics"),
			integration.SystemName("analytics-platform"),
			integration.WithDeployment(
				integration.DeploymentID("deploy-analytics-api"),
				integration.DeploymentName("analytics-api"),
				integration.DeploymentJobAgent("agent-kubernetes"),
			),
			integration.WithEnvironment(
				integration.EnvironmentID("env-analytics-prod"),
				integration.EnvironmentName("production"),
			),
		),

		// Infrastructure Resources - VPCs
		integration.WithResource(
			integration.ResourceID("vpc-us-east"),
			integration.ResourceName("vpc-us-east-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region":      "us-east-1",
				"cidr":        "10.0.0.0/16",
				"provider":    "aws",
				"environment": "production",
			}),
		),
		integration.WithResource(
			integration.ResourceID("vpc-us-west"),
			integration.ResourceName("vpc-us-west-2"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region":      "us-west-2",
				"cidr":        "10.1.0.0/16",
				"provider":    "aws",
				"environment": "staging",
			}),
		),
		integration.WithResource(
			integration.ResourceID("vpc-eu-west"),
			integration.ResourceName("vpc-eu-west-1"),
			integration.ResourceKind("vpc"),
			integration.ResourceMetadata(map[string]string{
				"region":      "eu-west-1",
				"cidr":        "10.2.0.0/16",
				"provider":    "aws",
				"environment": "production",
			}),
		),

		// Kubernetes Clusters
		integration.WithResource(
			integration.ResourceID("cluster-us-east-prod"),
			integration.ResourceName("k8s-us-east-prod"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id":      "vpc-us-east",
				"region":      "us-east-1",
				"version":     "1.28",
				"node_count":  "5",
				"environment": "production",
			}),
			integration.WithResourceVariable(
				"vpc_cidr",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "cidr"}),
			),
			integration.WithResourceVariable(
				"vpc_region",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "region"}),
			),
			integration.WithResourceVariable(
				"cluster_endpoint",
				integration.ResourceVariableStringValue("https://k8s-us-east.example.com"),
			),
			integration.WithResourceVariable(
				"node_count",
				integration.ResourceVariableIntValue(5),
			),
			integration.WithResourceVariable(
				"autoscaling",
				integration.ResourceVariableBoolValue(true),
			),
		),
		integration.WithResource(
			integration.ResourceID("cluster-us-west-staging"),
			integration.ResourceName("k8s-us-west-staging"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id":      "vpc-us-west",
				"region":      "us-west-2",
				"version":     "1.28",
				"node_count":  "3",
				"environment": "staging",
			}),
			integration.WithResourceVariable(
				"vpc_cidr",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "cidr"}),
			),
			integration.WithResourceVariable(
				"cluster_endpoint",
				integration.ResourceVariableStringValue("https://k8s-us-west.example.com"),
			),
			integration.WithResourceVariable(
				"node_count",
				integration.ResourceVariableIntValue(3),
			),
		),
		integration.WithResource(
			integration.ResourceID("cluster-eu-west-prod"),
			integration.ResourceName("k8s-eu-west-prod"),
			integration.ResourceKind("kubernetes-cluster"),
			integration.ResourceMetadata(map[string]string{
				"vpc_id":      "vpc-eu-west",
				"region":      "eu-west-1",
				"version":     "1.28",
				"node_count":  "4",
				"environment": "production",
			}),
			integration.WithResourceVariable(
				"vpc_cidr",
				integration.ResourceVariableReferenceValue("vpc", []string{"metadata", "cidr"}),
			),
			integration.WithResourceVariable(
				"cluster_endpoint",
				integration.ResourceVariableStringValue("https://k8s-eu-west.example.com"),
			),
		),

		// Databases
		integration.WithResource(
			integration.ResourceID("db-postgres-primary"),
			integration.ResourceName("postgres-primary"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"cluster_id": "cluster-us-east-prod",
				"engine":     "postgres",
				"version":    "15.3",
				"size":       "db.r5.xlarge",
				"region":     "us-east-1",
			}),
			integration.WithResourceVariable(
				"connection_string",
				integration.ResourceVariableStringValue("postgres://db-primary.example.com:5432/ecommerce"),
			),
			integration.WithResourceVariable(
				"max_connections",
				integration.ResourceVariableIntValue(200),
			),
			integration.WithResourceVariable(
				"ssl_enabled",
				integration.ResourceVariableBoolValue(true),
			),
			integration.WithResourceVariable(
				"backup_config",
				integration.ResourceVariableLiteralValue(map[string]any{
					"enabled":            true,
					"retention_days":     30,
					"backup_window":      "03:00-04:00",
					"maintenance_window": "mon:04:00-mon:05:00",
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID("db-postgres-replica"),
			integration.ResourceName("postgres-replica"),
			integration.ResourceKind("database"),
			integration.ResourceMetadata(map[string]string{
				"cluster_id": "cluster-eu-west-prod",
				"engine":     "postgres",
				"version":    "15.3",
				"size":       "db.r5.large",
				"region":     "eu-west-1",
				"primary_db": "db-postgres-primary",
			}),
			integration.WithResourceVariable(
				"connection_string",
				integration.ResourceVariableStringValue("postgres://db-replica.example.com:5432/ecommerce"),
			),
			integration.WithResourceVariable(
				"read_only",
				integration.ResourceVariableBoolValue(true),
			),
		),

		// Cache/Redis
		integration.WithResource(
			integration.ResourceID("cache-redis-main"),
			integration.ResourceName("redis-main"),
			integration.ResourceKind("cache"),
			integration.ResourceMetadata(map[string]string{
				"cluster_id": "cluster-us-east-prod",
				"engine":     "redis",
				"version":    "7.0",
				"region":     "us-east-1",
			}),
			integration.WithResourceVariable(
				"endpoint",
				integration.ResourceVariableStringValue("redis://redis-main.example.com:6379"),
			),
			integration.WithResourceVariable(
				"max_memory",
				integration.ResourceVariableStringValue("2gb"),
			),
			integration.WithResourceVariable(
				"eviction_policy",
				integration.ResourceVariableStringValue("allkeys-lru"),
			),
			integration.WithResourceVariable(
				"ttl_seconds",
				integration.ResourceVariableIntValue(3600),
			),
		),

		// Application Services
		integration.WithResource(
			integration.ResourceID("svc-api-us-east"),
			integration.ResourceName("api-service-us-east"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"cluster_id": "cluster-us-east-prod",
				"db_id":      "db-postgres-primary",
				"cache_id":   "cache-redis-main",
				"port":       "8080",
			}),
			integration.WithResourceVariable(
				"db_host",
				integration.ResourceVariableReferenceValue("database", []string{"metadata", "host"}),
			),
			integration.WithResourceVariable(
				"cache_endpoint",
				integration.ResourceVariableReferenceValue("cache", []string{"metadata", "endpoint"}),
			),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(3),
			),
			integration.WithResourceVariable(
				"health_check",
				integration.ResourceVariableLiteralValue(map[string]any{
					"path":     "/health",
					"interval": 30,
					"timeout":  5,
					"retries":  3,
				}),
			),
		),
		integration.WithResource(
			integration.ResourceID("svc-api-eu-west"),
			integration.ResourceName("api-service-eu-west"),
			integration.ResourceKind("service"),
			integration.ResourceMetadata(map[string]string{
				"cluster_id": "cluster-eu-west-prod",
				"db_id":      "db-postgres-replica",
				"port":       "8080",
			}),
			integration.WithResourceVariable(
				"replicas",
				integration.ResourceVariableIntValue(2),
			),
		),

		// Relationship Rules
		// Cluster -> VPC
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rule-cluster-vpc"),
			integration.RelationshipRuleName("cluster-to-vpc"),
			integration.RelationshipRuleReference("vpc"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "vpc",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "vpc_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		// Database -> Cluster
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rule-db-cluster"),
			integration.RelationshipRuleName("database-to-cluster"),
			integration.RelationshipRuleReference("cluster"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cluster_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		// Service -> Database
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rule-svc-db"),
			integration.RelationshipRuleName("service-to-database"),
			integration.RelationshipRuleReference("database"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "database",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "db_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		// Service -> Cache
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rule-svc-cache"),
			integration.RelationshipRuleName("service-to-cache"),
			integration.RelationshipRuleReference("cache"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "cache",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cache_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		// Service -> Cluster
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rule-svc-cluster"),
			integration.RelationshipRuleName("service-to-cluster"),
			integration.RelationshipRuleReference("cluster"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "service",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cluster_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
		// Cache -> Cluster
		integration.WithRelationshipRule(
			integration.RelationshipRuleID("rule-cache-cluster"),
			integration.RelationshipRuleName("cache-to-cluster"),
			integration.RelationshipRuleReference("cluster"),
			integration.RelationshipRuleFromType("resource"),
			integration.RelationshipRuleToType("resource"),
			integration.RelationshipRuleFromJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "cache",
			}),
			integration.RelationshipRuleToJsonSelector(map[string]any{
				"type":     "kind",
				"operator": "equals",
				"value":    "kubernetes-cluster",
			}),
			integration.WithPropertyMatcher(
				integration.PropertyMatcherFromProperty([]string{"metadata", "cluster_id"}),
				integration.PropertyMatcherToProperty([]string{"id"}),
				integration.PropertyMatcherOperator("equals"),
			),
		),
	)

	repo := engine.Workspace().Store().Repo()
	repository.WriteToJSONFile(repo, "repo.json")
}
