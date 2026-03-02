package concurrency

import (
	"workspace-engine/pkg/events/handler"
)

// StateDomain represents a logical group of store collections that are
// read or written together. Conflict detection operates at this granularity.
type StateDomain string

const (
	DomainResources      StateDomain = "resources"
	DomainDeployments    StateDomain = "deployments"
	DomainEnvironments   StateDomain = "environments"
	DomainSystems        StateDomain = "systems"
	DomainVersions       StateDomain = "versions"
	DomainVariables      StateDomain = "variables"
	DomainPolicies       StateDomain = "policies"
	DomainJobs           StateDomain = "jobs"
	DomainJobAgents      StateDomain = "job_agents"
	DomainApprovals      StateDomain = "approvals"
	DomainRelationships  StateDomain = "relationships"
	DomainReleaseTargets StateDomain = "release_targets"
	DomainMetadata       StateDomain = "metadata"
	DomainWorkflows      StateDomain = "workflows"
	DomainReleases       StateDomain = "releases"
)

// allDomains is used for event types that must serialize against everything.
var allDomains = []StateDomain{
	DomainResources, DomainDeployments, DomainEnvironments, DomainSystems,
	DomainVersions, DomainVariables, DomainPolicies, DomainJobs,
	DomainJobAgents, DomainApprovals, DomainRelationships,
	DomainReleaseTargets, DomainMetadata, DomainWorkflows, DomainReleases,
}

// EventProfile describes the state domains an event handler reads and writes.
type EventProfile struct {
	Reads  []StateDomain
	Writes []StateDomain
}

// eventProfiles maps every registered EventType to its read/write domain
// profile. Profiles are derived by inspecting the store operations each
// handler performs (excluding reconciliation calls which are thread-safe
// under the concurrent store design).
var eventProfiles = map[handler.EventType]EventProfile{
	// --- Resources ---
	handler.ResourceCreate: {
		Reads:  []StateDomain{DomainEnvironments, DomainDeployments, DomainRelationships, DomainReleaseTargets},
		Writes: []StateDomain{DomainResources, DomainRelationships, DomainReleaseTargets},
	},
	handler.ResourceUpdate: {
		Reads:  []StateDomain{DomainEnvironments, DomainDeployments, DomainRelationships, DomainReleaseTargets},
		Writes: []StateDomain{DomainResources, DomainRelationships, DomainReleaseTargets},
	},
	handler.ResourceDelete: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainResources, DomainReleaseTargets},
	},

	// --- Resource Variables ---
	handler.ResourceVariableCreate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.ResourceVariableUpdate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.ResourceVariableDelete: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.ResourceVariablesBulkUpdate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},

	// --- Resource Providers ---
	handler.ResourceProviderCreate: {
		Reads:  nil,
		Writes: []StateDomain{DomainResources},
	},
	handler.ResourceProviderUpdate: {
		Reads:  nil,
		Writes: []StateDomain{DomainResources},
	},
	handler.ResourceProviderDelete: {
		Reads:  nil,
		Writes: []StateDomain{DomainResources},
	},
	handler.ResourceProviderSetResources: {
		Reads:  []StateDomain{DomainResources},
		Writes: []StateDomain{DomainResources, DomainRelationships, DomainReleaseTargets},
	},

	// --- Deployments ---
	handler.DeploymentCreate: {
		Reads:  []StateDomain{DomainSystems, DomainEnvironments, DomainResources, DomainRelationships, DomainReleaseTargets, DomainJobs},
		Writes: []StateDomain{DomainDeployments, DomainRelationships, DomainReleaseTargets, DomainJobs},
	},
	handler.DeploymentUpdate: {
		Reads:  []StateDomain{DomainSystems, DomainEnvironments, DomainResources, DomainRelationships, DomainReleaseTargets, DomainJobs, DomainReleases},
		Writes: []StateDomain{DomainDeployments, DomainRelationships, DomainReleaseTargets, DomainJobs},
	},
	handler.DeploymentDelete: {
		Reads:  []StateDomain{DomainReleaseTargets, DomainJobs, DomainReleases},
		Writes: []StateDomain{DomainDeployments, DomainReleaseTargets, DomainJobs},
	},

	// --- Deployment Versions ---
	handler.DeploymentVersionCreate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVersions},
	},
	handler.DeploymentVersionUpdate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVersions},
	},
	handler.DeploymentVersionDelete: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVersions},
	},

	// --- Deployment Variables ---
	handler.DeploymentVariableCreate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.DeploymentVariableUpdate: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.DeploymentVariableDelete: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},

	// --- Deployment Variable Values ---
	handler.DeploymentVariableValueCreate: {
		Reads:  []StateDomain{DomainVariables, DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.DeploymentVariableValueUpdate: {
		Reads:  []StateDomain{DomainVariables, DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},
	handler.DeploymentVariableValueDelete: {
		Reads:  []StateDomain{DomainVariables, DomainReleaseTargets},
		Writes: []StateDomain{DomainVariables},
	},

	// --- Environments ---
	handler.EnvironmentCreate: {
		Reads:  []StateDomain{DomainSystems, DomainDeployments, DomainResources, DomainRelationships, DomainReleaseTargets},
		Writes: []StateDomain{DomainEnvironments, DomainRelationships, DomainReleaseTargets},
	},
	handler.EnvironmentUpdate: {
		Reads:  []StateDomain{DomainSystems, DomainDeployments, DomainResources, DomainRelationships, DomainReleaseTargets},
		Writes: []StateDomain{DomainEnvironments, DomainRelationships, DomainReleaseTargets},
	},
	handler.EnvironmentDelete: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: []StateDomain{DomainEnvironments, DomainReleaseTargets},
	},

	// --- Systems ---
	handler.SystemCreate: {
		Reads:  nil,
		Writes: []StateDomain{DomainSystems},
	},
	handler.SystemUpdate: {
		Reads:  nil,
		Writes: []StateDomain{DomainSystems},
	},
	handler.SystemDelete: {
		Reads:  []StateDomain{DomainSystems, DomainDeployments, DomainEnvironments, DomainReleaseTargets},
		Writes: []StateDomain{DomainSystems, DomainDeployments, DomainEnvironments, DomainReleaseTargets},
	},

	// --- Job Agents ---
	handler.JobAgentCreate: {
		Reads:  nil,
		Writes: []StateDomain{DomainJobAgents},
	},
	handler.JobAgentUpdate: {
		Reads:  []StateDomain{DomainDeployments, DomainReleaseTargets},
		Writes: []StateDomain{DomainJobAgents},
	},
	handler.JobAgentDelete: {
		Reads:  nil,
		Writes: []StateDomain{DomainJobAgents},
	},

	// --- Jobs ---
	handler.JobUpdate: {
		Reads:  []StateDomain{DomainJobs, DomainReleases},
		Writes: []StateDomain{DomainJobs},
	},

	// --- Policies ---
	handler.PolicyCreate: {
		Reads:  []StateDomain{DomainReleaseTargets, DomainPolicies},
		Writes: []StateDomain{DomainPolicies},
	},
	handler.PolicyUpdate: {
		Reads:  []StateDomain{DomainReleaseTargets, DomainPolicies},
		Writes: []StateDomain{DomainPolicies},
	},
	handler.PolicyDelete: {
		Reads:  []StateDomain{DomainReleaseTargets, DomainPolicies},
		Writes: []StateDomain{DomainPolicies},
	},

	// --- Policy Skips ---
	handler.PolicySkipCreate: {
		Reads:  []StateDomain{DomainVersions, DomainReleaseTargets},
		Writes: []StateDomain{DomainPolicies},
	},
	handler.PolicySkipDelete: {
		Reads:  nil,
		Writes: []StateDomain{DomainPolicies},
	},

	// --- Relationship Rules ---
	handler.RelationshipRuleCreate: {
		Reads:  []StateDomain{DomainRelationships},
		Writes: []StateDomain{DomainRelationships},
	},
	handler.RelationshipRuleUpdate: {
		Reads:  []StateDomain{DomainRelationships},
		Writes: []StateDomain{DomainRelationships},
	},
	handler.RelationshipRuleDelete: {
		Reads:  []StateDomain{DomainRelationships},
		Writes: []StateDomain{DomainRelationships},
	},

	// --- User Approval Records ---
	handler.UserApprovalRecordCreate: {
		Reads:  []StateDomain{DomainVersions, DomainEnvironments, DomainReleaseTargets},
		Writes: []StateDomain{DomainApprovals},
	},
	handler.UserApprovalRecordUpdate: {
		Reads:  []StateDomain{DomainVersions, DomainEnvironments, DomainReleaseTargets},
		Writes: []StateDomain{DomainApprovals},
	},
	handler.UserApprovalRecordDelete: {
		Reads:  []StateDomain{DomainVersions, DomainEnvironments, DomainReleaseTargets},
		Writes: []StateDomain{DomainApprovals},
	},

	// --- GitHub Entities ---
	handler.GithubEntityCreate: {
		Reads:  nil,
		Writes: []StateDomain{DomainMetadata},
	},
	handler.GithubEntityUpdate: {
		Reads:  nil,
		Writes: []StateDomain{DomainMetadata},
	},
	handler.GithubEntityDelete: {
		Reads:  nil,
		Writes: []StateDomain{DomainMetadata},
	},

	// --- Workspace ---
	handler.WorkspaceTick: {
		Reads:  []StateDomain{DomainReleaseTargets},
		Writes: nil,
	},
	// WorkspaceSave has no registered handler; mark conservatively so it
	// serializes against everything if it ever arrives.
	handler.WorkspaceSave: {
		Reads:  allDomains,
		Writes: allDomains,
	},

	// --- Release Targets ---
	handler.ReleaseTargetDeploy: {
		Reads:  []StateDomain{DomainReleases, DomainReleaseTargets},
		Writes: []StateDomain{DomainReleases, DomainJobs},
	},

	// --- Workflows ---
	handler.WorkflowTemplateCreate: {
		Reads:  nil,
		Writes: []StateDomain{DomainWorkflows},
	},
	handler.WorkflowCreate: {
		Reads:  nil,
		Writes: []StateDomain{DomainWorkflows},
	},
}

// GetProfile returns the read/write profile for an event type. If the event
// type is unknown, it returns a profile that conflicts with everything.
func GetProfile(et handler.EventType) EventProfile {
	if p, ok := eventProfiles[et]; ok {
		return p
	}
	return EventProfile{Reads: allDomains, Writes: allDomains}
}

// CanRunConcurrently returns true when two event types have no read/write
// domain conflicts — i.e., neither event's write set overlaps the other's
// read or write set.
func CanRunConcurrently(a, b handler.EventType) bool {
	pa := GetProfile(a)
	pb := GetProfile(b)

	if domainsOverlap(pa.Writes, pb.Reads) {
		return false
	}
	if domainsOverlap(pa.Writes, pb.Writes) {
		return false
	}
	if domainsOverlap(pa.Reads, pb.Writes) {
		return false
	}
	return true
}

// eventGroup tracks the accumulated read/write domains for a set of events
// that have been determined to be safe to run concurrently.
type eventGroup struct {
	events []handler.RawEvent
	writes map[StateDomain]bool
	reads  map[StateDomain]bool
}

// GroupConcurrentEvents partitions a slice of events into sequential groups
// where all events within a single group can safely run in parallel. Groups
// themselves must be executed in order.
//
// The algorithm uses order-preserving greedy bin-packing: for each event it
// first scans all existing groups to find the last one that conflicts, then
// searches for a compatible group strictly after that point. This guarantees
// an event is never placed into a group that runs before a conflicting
// predecessor, preserving causal ordering. The overall complexity is O(n²),
// which is acceptable for batch sizes of 50-200 events.
func GroupConcurrentEvents(events []handler.RawEvent) [][]handler.RawEvent {
	if len(events) == 0 {
		return nil
	}

	var groups []eventGroup

	for _, ev := range events {
		profile := GetProfile(ev.EventType)

		// Find the last group that conflicts with this event. The event
		// must not be placed into any group at or before this index to
		// preserve input ordering for conflicting events.
		lastConflict := -1
		for i := range groups {
			if conflictsWithGroup(&groups[i], &profile) {
				lastConflict = i
			}
		}

		// Search for the first compatible group after the last conflict.
		placed := false
		for i := lastConflict + 1; i < len(groups); i++ {
			if !conflictsWithGroup(&groups[i], &profile) {
				groups[i].events = append(groups[i].events, ev)
				addDomains(groups[i].writes, profile.Writes)
				addDomains(groups[i].reads, profile.Reads)
				placed = true
				break
			}
		}

		if !placed {
			g := eventGroup{
				events: []handler.RawEvent{ev},
				writes: make(map[StateDomain]bool),
				reads:  make(map[StateDomain]bool),
			}
			addDomains(g.writes, profile.Writes)
			addDomains(g.reads, profile.Reads)
			groups = append(groups, g)
		}
	}

	result := make([][]handler.RawEvent, len(groups))
	for i, g := range groups {
		result[i] = g.events
	}
	return result
}

// conflictsWithGroup checks whether adding an event with the given profile
// to the group would introduce a read/write conflict.
func conflictsWithGroup(g *eventGroup, p *EventProfile) bool {
	for _, d := range p.Writes {
		if g.reads[d] || g.writes[d] {
			return true
		}
	}
	for _, d := range p.Reads {
		if g.writes[d] {
			return true
		}
	}
	return false
}

func addDomains(set map[StateDomain]bool, domains []StateDomain) {
	for _, d := range domains {
		set[d] = true
	}
}

// domainsOverlap returns true if any domain appears in both slices.
func domainsOverlap(a, b []StateDomain) bool {
	if len(a) == 0 || len(b) == 0 {
		return false
	}

	set := make(map[StateDomain]bool, len(a))
	for _, d := range a {
		set[d] = true
	}
	for _, d := range b {
		if set[d] {
			return true
		}
	}
	return false
}
