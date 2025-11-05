package relationgraph

import "workspace-engine/pkg/oapi"

// EntityProvider is an interface that provides access to entities and rules
// This breaks the circular dependency between relationgraph and store packages
// The store layer implements this interface
type EntityProvider interface {
	// Entity access
	GetResources() map[string]*oapi.Resource
	GetDeployments() map[string]*oapi.Deployment
	GetEnvironments() map[string]*oapi.Environment

	// Rule access
	GetRelationshipRules() map[string]*oapi.RelationshipRule
	GetRelationshipRule(reference string) (*oapi.RelationshipRule, bool)
}
