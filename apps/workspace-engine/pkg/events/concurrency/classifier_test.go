package concurrency

import (
	"testing"
	"workspace-engine/pkg/events/handler"
)

// allEventTypes enumerates every EventType constant so we can verify
// complete profile coverage.
var allEventTypes = []handler.EventType{
	handler.ResourceCreate,
	handler.ResourceUpdate,
	handler.ResourceDelete,

	handler.ResourceVariableCreate,
	handler.ResourceVariableUpdate,
	handler.ResourceVariableDelete,
	handler.ResourceVariablesBulkUpdate,

	handler.ResourceProviderCreate,
	handler.ResourceProviderUpdate,
	handler.ResourceProviderDelete,
	handler.ResourceProviderSetResources,

	handler.DeploymentCreate,
	handler.DeploymentUpdate,
	handler.DeploymentDelete,

	handler.DeploymentVersionCreate,
	handler.DeploymentVersionUpdate,
	handler.DeploymentVersionDelete,

	handler.DeploymentVariableCreate,
	handler.DeploymentVariableUpdate,
	handler.DeploymentVariableDelete,

	handler.DeploymentVariableValueCreate,
	handler.DeploymentVariableValueUpdate,
	handler.DeploymentVariableValueDelete,

	handler.EnvironmentCreate,
	handler.EnvironmentUpdate,
	handler.EnvironmentDelete,

	handler.SystemCreate,
	handler.SystemUpdate,
	handler.SystemDelete,

	handler.JobAgentCreate,
	handler.JobAgentUpdate,
	handler.JobAgentDelete,

	handler.JobUpdate,

	handler.PolicyCreate,
	handler.PolicyUpdate,
	handler.PolicyDelete,

	handler.PolicySkipCreate,
	handler.PolicySkipDelete,

	handler.RelationshipRuleCreate,
	handler.RelationshipRuleUpdate,
	handler.RelationshipRuleDelete,

	handler.UserApprovalRecordCreate,
	handler.UserApprovalRecordUpdate,
	handler.UserApprovalRecordDelete,

	handler.GithubEntityCreate,
	handler.GithubEntityUpdate,
	handler.GithubEntityDelete,

	handler.WorkspaceTick,
	handler.WorkspaceSave,

	handler.ReleaseTargetDeploy,

	handler.WorkflowTemplateCreate,
	handler.WorkflowCreate,
}

// validDomains is the set of all known state domains for validation.
var validDomains = map[StateDomain]bool{
	DomainResources:      true,
	DomainDeployments:    true,
	DomainEnvironments:   true,
	DomainSystems:        true,
	DomainVersions:       true,
	DomainVariables:      true,
	DomainPolicies:       true,
	DomainJobs:           true,
	DomainJobAgents:      true,
	DomainApprovals:      true,
	DomainRelationships:  true,
	DomainReleaseTargets: true,
	DomainMetadata:       true,
	DomainWorkflows:      true,
	DomainReleases:       true,
}

// ---------------------------------------------------------------------------
// Profile completeness and validity
// ---------------------------------------------------------------------------

func TestAllEventTypesHaveProfiles(t *testing.T) {
	for _, et := range allEventTypes {
		if _, ok := eventProfiles[et]; !ok {
			t.Errorf("event type %q has no profile in eventProfiles map", et)
		}
	}
}

func TestProfileCountMatchesEventTypes(t *testing.T) {
	if len(eventProfiles) != len(allEventTypes) {
		t.Errorf("eventProfiles has %d entries but allEventTypes has %d entries",
			len(eventProfiles), len(allEventTypes))
	}
}

func TestNoExtraProfilesExist(t *testing.T) {
	known := make(map[handler.EventType]bool, len(allEventTypes))
	for _, et := range allEventTypes {
		known[et] = true
	}
	for et := range eventProfiles {
		if !known[et] {
			t.Errorf("eventProfiles contains %q which is not in allEventTypes", et)
		}
	}
}

func TestProfilesContainOnlyValidDomains(t *testing.T) {
	for et, p := range eventProfiles {
		for _, d := range p.Reads {
			if !validDomains[d] {
				t.Errorf("event %q reads unknown domain %q", et, d)
			}
		}
		for _, d := range p.Writes {
			if !validDomains[d] {
				t.Errorf("event %q writes unknown domain %q", et, d)
			}
		}
	}
}

func TestAllDomainsContainsAllKnownDomains(t *testing.T) {
	domainSet := make(map[StateDomain]bool, len(allDomains))
	for _, d := range allDomains {
		domainSet[d] = true
	}
	for d := range validDomains {
		if !domainSet[d] {
			t.Errorf("allDomains slice is missing domain %q", d)
		}
	}
	if len(allDomains) != len(validDomains) {
		t.Errorf("allDomains has %d entries but validDomains has %d",
			len(allDomains), len(validDomains))
	}
}

// ---------------------------------------------------------------------------
// Specific profile content checks
// ---------------------------------------------------------------------------

func TestGetProfile_KnownType(t *testing.T) {
	p := GetProfile(handler.GithubEntityCreate)
	if len(p.Reads) != 0 {
		t.Errorf("expected no reads for GithubEntityCreate, got %v", p.Reads)
	}
	if len(p.Writes) != 1 || p.Writes[0] != DomainMetadata {
		t.Errorf("expected writes=[metadata] for GithubEntityCreate, got %v", p.Writes)
	}
}

func TestGetProfile_UnknownType(t *testing.T) {
	p := GetProfile("nonexistent.event")
	if len(p.Reads) != len(allDomains) {
		t.Errorf("expected unknown type to read all domains, got %d reads", len(p.Reads))
	}
	if len(p.Writes) != len(allDomains) {
		t.Errorf("expected unknown type to write all domains, got %d writes", len(p.Writes))
	}
}

func TestGetProfile_ResourceCreate(t *testing.T) {
	p := GetProfile(handler.ResourceCreate)
	expectDomains(t, "reads", p.Reads, DomainEnvironments, DomainDeployments, DomainRelationships, DomainReleaseTargets)
	expectDomains(t, "writes", p.Writes, DomainResources, DomainRelationships, DomainReleaseTargets)
}

func TestGetProfile_WorkspaceTick(t *testing.T) {
	p := GetProfile(handler.WorkspaceTick)
	expectDomains(t, "reads", p.Reads, DomainReleaseTargets)
	if len(p.Writes) != 0 {
		t.Errorf("expected no writes for WorkspaceTick, got %v", p.Writes)
	}
}

func TestGetProfile_WorkspaceSave(t *testing.T) {
	p := GetProfile(handler.WorkspaceSave)
	if len(p.Reads) != len(allDomains) {
		t.Errorf("expected WorkspaceSave to read all domains, got %d", len(p.Reads))
	}
	if len(p.Writes) != len(allDomains) {
		t.Errorf("expected WorkspaceSave to write all domains, got %d", len(p.Writes))
	}
}

func TestGetProfile_DeploymentCreate(t *testing.T) {
	p := GetProfile(handler.DeploymentCreate)
	expectDomains(t, "reads", p.Reads,
		DomainSystems, DomainEnvironments, DomainResources,
		DomainRelationships, DomainReleaseTargets, DomainJobs, DomainReleases)
	expectDomains(t, "writes", p.Writes,
		DomainDeployments, DomainRelationships, DomainReleaseTargets, DomainJobs)
}

func TestGetProfile_PolicyCreate(t *testing.T) {
	p := GetProfile(handler.PolicyCreate)
	expectDomains(t, "reads", p.Reads, DomainReleaseTargets, DomainPolicies)
	expectDomains(t, "writes", p.Writes, DomainPolicies)
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — disjoint (should be concurrent)
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_DisjointDomains(t *testing.T) {
	tests := []struct {
		name string
		a, b handler.EventType
		want bool
	}{
		{
			name: "policy.created and github-entity.created are disjoint",
			a:    handler.PolicyCreate,
			b:    handler.GithubEntityCreate,
			want: true,
		},
		{
			name: "policy.created and deployment-version.created are disjoint",
			a:    handler.PolicyCreate,
			b:    handler.DeploymentVersionCreate,
			// PolicyCreate writes {policies}, reads {release_targets, policies}
			// DeploymentVersionCreate writes {versions}, reads {release_targets}
			// No write overlap with the other's read/write sets.
			want: true,
		},
		{
			name: "policy.created and job.updated are disjoint",
			a:    handler.PolicyCreate,
			b:    handler.JobUpdate,
			want: true,
		},
		{
			name: "github-entity.created and workflow.created are disjoint",
			a:    handler.GithubEntityCreate,
			b:    handler.WorkflowCreate,
			want: true,
		},
		{
			name: "job-agent.created and github-entity.created are disjoint",
			a:    handler.JobAgentCreate,
			b:    handler.GithubEntityCreate,
			want: true,
		},
		{
			name: "system.created and github-entity.created are disjoint",
			a:    handler.SystemCreate,
			b:    handler.GithubEntityCreate,
			want: true,
		},
		{
			name: "system.created and job-agent.created are disjoint",
			a:    handler.SystemCreate,
			b:    handler.JobAgentCreate,
			want: true,
		},
		{
			name: "system.created and workflow.created are disjoint",
			a:    handler.SystemCreate,
			b:    handler.WorkflowCreate,
			want: true,
		},
		{
			name: "job-agent.created and workflow-template.created are disjoint",
			a:    handler.JobAgentCreate,
			b:    handler.WorkflowTemplateCreate,
			want: true,
		},
		{
			name: "policy-skip.delete and github-entity.created are disjoint",
			a:    handler.PolicySkipDelete,
			b:    handler.GithubEntityCreate,
			want: true,
		},
		{
			name: "deployment-version.created and user-approval-record.created are disjoint",
			a:    handler.DeploymentVersionCreate,
			b:    handler.UserApprovalRecordCreate,
			// DeploymentVersionCreate writes {versions}, reads {release_targets}
			// UserApprovalRecordCreate writes {approvals}, reads {versions, environments, release_targets}
			// DeploymentVersionCreate writes versions, UserApprovalRecordCreate reads versions → conflict!
			want: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CanRunConcurrently(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("CanRunConcurrently(%q, %q) = %v, want %v", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — conflicting (should NOT be concurrent)
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_ConflictingDomains(t *testing.T) {
	tests := []struct {
		name string
		a, b handler.EventType
	}{
		{
			name: "resource.created and deployment.created both write release_targets",
			a:    handler.ResourceCreate,
			b:    handler.DeploymentCreate,
		},
		{
			name: "resource.created and resource.updated both write resources",
			a:    handler.ResourceCreate,
			b:    handler.ResourceUpdate,
		},
		{
			name: "deployment.created and environment.created both write relationships and release_targets",
			a:    handler.DeploymentCreate,
			b:    handler.EnvironmentCreate,
		},
		{
			name: "job.updated reads jobs, deployment.created writes jobs",
			a:    handler.JobUpdate,
			b:    handler.DeploymentCreate,
		},
		{
			name: "system.deleted writes deployments, deployment.created writes deployments",
			a:    handler.SystemDelete,
			b:    handler.DeploymentCreate,
		},
		{
			name: "resource.created and environment.created both write release_targets",
			a:    handler.ResourceCreate,
			b:    handler.EnvironmentCreate,
		},
		{
			name: "deployment-variable.created and deployment-variable-value.created overlap on variables",
			a:    handler.DeploymentVariableCreate,
			b:    handler.DeploymentVariableValueCreate,
		},
		{
			name: "resource-variable.created and deployment-variable.created both write variables",
			a:    handler.ResourceVariableCreate,
			b:    handler.DeploymentVariableCreate,
		},
		{
			name: "relationship-rule.created and resource.created both write relationships",
			a:    handler.RelationshipRuleCreate,
			b:    handler.ResourceCreate,
		},
		{
			name: "release-target.deploy and job.updated: deploy writes jobs, job.updated reads/writes jobs",
			a:    handler.ReleaseTargetDeploy,
			b:    handler.JobUpdate,
		},
		{
			name: "deployment-version.created and user-approval-record.created: version writes versions, approval reads versions",
			a:    handler.DeploymentVersionCreate,
			b:    handler.UserApprovalRecordCreate,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if CanRunConcurrently(tt.a, tt.b) {
				t.Errorf("CanRunConcurrently(%q, %q) = true, want false (should conflict)", tt.a, tt.b)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — symmetry
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_IsSymmetric(t *testing.T) {
	for i, a := range allEventTypes {
		for j := i + 1; j < len(allEventTypes); j++ {
			b := allEventTypes[j]
			ab := CanRunConcurrently(a, b)
			ba := CanRunConcurrently(b, a)
			if ab != ba {
				t.Errorf("asymmetric: CanRunConcurrently(%q, %q)=%v but CanRunConcurrently(%q, %q)=%v",
					a, b, ab, b, a, ba)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — self-conflict
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_SelfConflict(t *testing.T) {
	for _, et := range allEventTypes {
		p := GetProfile(et)
		hasWrites := len(p.Writes) > 0
		result := CanRunConcurrently(et, et)

		if hasWrites && result {
			t.Errorf("event %q writes domains but CanRunConcurrently(self, self) = true; "+
				"events that write should conflict with themselves", et)
		}
		if !hasWrites && !result {
			t.Errorf("event %q has no writes but CanRunConcurrently(self, self) = false; "+
				"read-only events should be concurrent with themselves", et)
		}
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — read-read has no conflict
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_ReadReadNoConflict(t *testing.T) {
	// WorkspaceTick only reads release_targets and writes nothing.
	// Two WorkspaceTick events should be able to run concurrently.
	if !CanRunConcurrently(handler.WorkspaceTick, handler.WorkspaceTick) {
		t.Error("two WorkspaceTick events (read-only) should be concurrent")
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — unknown event
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_UnknownEventSerializesWithEverything(t *testing.T) {
	unknown := handler.EventType("unknown.event")
	for _, et := range allEventTypes {
		if CanRunConcurrently(unknown, et) {
			t.Errorf("unknown event should conflict with %q but CanRunConcurrently returned true", et)
		}
	}
}

func TestCanRunConcurrently_TwoUnknownEventsConflict(t *testing.T) {
	a := handler.EventType("mystery.a")
	b := handler.EventType("mystery.b")
	if CanRunConcurrently(a, b) {
		t.Error("two unknown events should conflict (both get allDomains profile)")
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — WorkspaceSave serializes with everything
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_WorkspaceSaveConflictsWithAll(t *testing.T) {
	for _, et := range allEventTypes {
		if CanRunConcurrently(handler.WorkspaceSave, et) {
			t.Errorf("WorkspaceSave should conflict with %q but CanRunConcurrently returned true", et)
		}
	}
}

// ---------------------------------------------------------------------------
// CanRunConcurrently — write-read directionality
// ---------------------------------------------------------------------------

func TestCanRunConcurrently_WriteReadConflict(t *testing.T) {
	// ResourceCreate writes resources. ResourceProviderSetResources reads resources.
	// This should be a conflict regardless of direction.
	if CanRunConcurrently(handler.ResourceCreate, handler.ResourceProviderSetResources) {
		t.Error("ResourceCreate writes resources, ResourceProviderSetResources reads resources — should conflict")
	}
	if CanRunConcurrently(handler.ResourceProviderSetResources, handler.ResourceCreate) {
		t.Error("reversed order should also conflict")
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — basic cases
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_Nil(t *testing.T) {
	result := GroupConcurrentEvents(nil)
	if result != nil {
		t.Errorf("expected nil for nil input, got %v", result)
	}
}

func TestGroupConcurrentEvents_Empty(t *testing.T) {
	result := GroupConcurrentEvents([]handler.RawEvent{})
	if result != nil {
		t.Errorf("expected nil for empty input, got %v", result)
	}
}

func TestGroupConcurrentEvents_SingleEvent(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1"},
	}
	groups := GroupConcurrentEvents(events)
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if len(groups[0]) != 1 {
		t.Fatalf("expected 1 event in group, got %d", len(groups[0]))
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — disjoint events
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_DisjointEventsInOneGroup(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1"},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1"},
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1"},
		{EventType: handler.JobAgentCreate, WorkspaceID: "ws1"},
	}
	groups := GroupConcurrentEvents(events)
	if len(groups) != 1 {
		t.Errorf("expected 1 group for disjoint events, got %d groups", len(groups))
		for i, g := range groups {
			types := make([]handler.EventType, len(g))
			for j, e := range g {
				types[j] = e.EventType
			}
			t.Logf("  group %d: %v", i, types)
		}
	}
}

func TestGroupConcurrentEvents_ManyDisjointFamilies(t *testing.T) {
	// Pick one event from each independent domain family.
	events := []handler.RawEvent{
		{EventType: handler.SystemCreate, WorkspaceID: "ws1"},       // writes systems only
		{EventType: handler.JobAgentCreate, WorkspaceID: "ws1"},     // writes job_agents only
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1"}, // writes metadata only
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1"},     // writes workflows only
		{EventType: handler.PolicySkipDelete, WorkspaceID: "ws1"},   // writes policies only
	}
	groups := GroupConcurrentEvents(events)
	if len(groups) != 1 {
		t.Errorf("expected 1 group for fully disjoint families, got %d", len(groups))
		logGroups(t, groups)
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — conflicting events
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_ConflictingEventsSplit(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.ResourceCreate, WorkspaceID: "ws1"},
		{EventType: handler.ResourceUpdate, WorkspaceID: "ws1"},
	}
	groups := GroupConcurrentEvents(events)
	if len(groups) != 2 {
		t.Errorf("expected 2 groups for conflicting events, got %d", len(groups))
	}
}

func TestGroupConcurrentEvents_AllSameTypeConflict(t *testing.T) {
	// Three events of the same write-type must each be in their own group.
	events := []handler.RawEvent{
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 3},
	}
	groups := GroupConcurrentEvents(events)
	if len(groups) != 3 {
		t.Errorf("expected 3 groups for same-type events, got %d", len(groups))
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — mixed concurrency and conflict
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_MixedConcurrencyAndConflict(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1"},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1"},
		{EventType: handler.PolicyUpdate, WorkspaceID: "ws1"},
	}
	groups := GroupConcurrentEvents(events)

	// PolicyCreate and GithubEntityCreate are disjoint → same group.
	// PolicyUpdate conflicts with PolicyCreate (both write policies) → new group.
	if len(groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(groups))
	}
	if len(groups[0]) != 2 {
		t.Errorf("expected first group to have 2 events, got %d", len(groups[0]))
	}
	if len(groups[1]) != 1 {
		t.Errorf("expected second group to have 1 event, got %d", len(groups[1]))
	}
}

func TestGroupConcurrentEvents_ComplexMix(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.SystemCreate, WorkspaceID: "ws1", Timestamp: 1},        // writes {systems}
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 2},  // writes {metadata}
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1", Timestamp: 3},      // writes {workflows}
		{EventType: handler.SystemUpdate, WorkspaceID: "ws1", Timestamp: 4},        // writes {systems} - conflicts with SystemCreate
		{EventType: handler.GithubEntityUpdate, WorkspaceID: "ws1", Timestamp: 5},  // writes {metadata} - conflicts with GithubEntityCreate
		{EventType: handler.WorkflowTemplateCreate, WorkspaceID: "ws1", Timestamp: 6}, // writes {workflows} - conflicts with WorkflowCreate
	}
	groups := GroupConcurrentEvents(events)

	// Group 1: SystemCreate + GithubEntityCreate + WorkflowCreate (all disjoint)
	// Group 2: SystemUpdate + GithubEntityUpdate + WorkflowTemplateCreate (conflicts with group 1 members, but disjoint among themselves)
	if len(groups) != 2 {
		t.Errorf("expected 2 groups, got %d", len(groups))
		logGroups(t, groups)
	}
	if len(groups) >= 2 {
		if len(groups[0]) != 3 {
			t.Errorf("expected first group to have 3 events, got %d", len(groups[0]))
		}
		if len(groups[1]) != 3 {
			t.Errorf("expected second group to have 3 events, got %d", len(groups[1]))
		}
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — WorkspaceSave isolation
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_WorkspaceSaveIsolated(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.WorkspaceSave, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 3},
	}
	groups := GroupConcurrentEvents(events)

	// WorkspaceSave conflicts with everything, so it cannot share a group.
	// Order-preserving algorithm:
	//   1. PolicyCreate → group 0
	//   2. WorkspaceSave → conflicts with group 0 → group 1
	//   3. GithubEntityCreate → lastConflict is group 1 (WorkspaceSave), must go after → group 2
	// GithubEntityCreate cannot be placed before WorkspaceSave even though it
	// doesn't conflict with PolicyCreate, because that would violate ordering.
	if len(groups) != 3 {
		t.Errorf("expected 3 groups, got %d", len(groups))
		logGroups(t, groups)
	}

	// Verify WorkspaceSave is alone in its group.
	for i, g := range groups {
		for _, ev := range g {
			if ev.EventType == handler.WorkspaceSave && len(g) != 1 {
				t.Errorf("WorkspaceSave in group %d with %d events; should be alone", i, len(g))
			}
		}
	}
}

func TestGroupConcurrentEvents_WorkspaceSaveBetweenConflicting(t *testing.T) {
	// When WorkspaceSave is surrounded by events that conflict with each other,
	// it forces its own group while the others each need separate groups too.
	events := []handler.RawEvent{
		{EventType: handler.ResourceCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.WorkspaceSave, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.ResourceUpdate, WorkspaceID: "ws1", Timestamp: 3},
	}
	groups := GroupConcurrentEvents(events)

	// ResourceCreate → group 0
	// WorkspaceSave → conflicts with group 0 → group 1
	// ResourceUpdate → conflicts with group 0 (both write resources) and group 1 (WorkspaceSave) → group 2
	if len(groups) != 3 {
		t.Errorf("expected 3 groups, got %d", len(groups))
		logGroups(t, groups)
	}

	// Verify WorkspaceSave is alone.
	for i, g := range groups {
		for _, ev := range g {
			if ev.EventType == handler.WorkspaceSave && len(g) != 1 {
				t.Errorf("WorkspaceSave in group %d with %d events; should be alone", i, len(g))
			}
		}
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — order preservation
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_PreservesEventOrder(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.GithubEntityUpdate, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.GithubEntityDelete, WorkspaceID: "ws1", Timestamp: 3},
	}
	groups := GroupConcurrentEvents(events)

	// All three write to metadata → each in its own group, order preserved.
	if len(groups) != 3 {
		t.Fatalf("expected 3 groups, got %d", len(groups))
	}
	for i, g := range groups {
		if g[0].Timestamp != int64(i+1) {
			t.Errorf("group %d has event with timestamp %d, expected %d", i, g[0].Timestamp, i+1)
		}
	}
}

func TestGroupConcurrentEvents_PreservesOrderWithinGroup(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.SystemCreate, WorkspaceID: "ws1", Timestamp: 10},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 20},
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1", Timestamp: 30},
	}
	groups := GroupConcurrentEvents(events)
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	for i := 1; i < len(groups[0]); i++ {
		if groups[0][i].Timestamp < groups[0][i-1].Timestamp {
			t.Errorf("events within group are not in input order: timestamp %d before %d",
				groups[0][i-1].Timestamp, groups[0][i].Timestamp)
		}
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — all events are preserved
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_PreservesAllEvents(t *testing.T) {
	events := []handler.RawEvent{
		{EventType: handler.ResourceCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 3},
		{EventType: handler.ResourceUpdate, WorkspaceID: "ws1", Timestamp: 4},
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1", Timestamp: 5},
		{EventType: handler.DeploymentVersionCreate, WorkspaceID: "ws1", Timestamp: 6},
	}
	groups := GroupConcurrentEvents(events)

	total := 0
	for _, g := range groups {
		total += len(g)
	}
	if total != len(events) {
		t.Errorf("expected %d total events across groups, got %d", len(events), total)
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — group integrity invariant
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_GroupIntegrity(t *testing.T) {
	// Use a variety of events and verify no pair within a group conflicts.
	events := []handler.RawEvent{
		{EventType: handler.ResourceCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 3},
		{EventType: handler.DeploymentCreate, WorkspaceID: "ws1", Timestamp: 4},
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1", Timestamp: 5},
		{EventType: handler.SystemCreate, WorkspaceID: "ws1", Timestamp: 6},
		{EventType: handler.JobUpdate, WorkspaceID: "ws1", Timestamp: 7},
		{EventType: handler.EnvironmentCreate, WorkspaceID: "ws1", Timestamp: 8},
		{EventType: handler.ResourceUpdate, WorkspaceID: "ws1", Timestamp: 9},
		{EventType: handler.PolicyUpdate, WorkspaceID: "ws1", Timestamp: 10},
	}
	groups := GroupConcurrentEvents(events)

	for gi, g := range groups {
		for i := range g {
			for j := i + 1; j < len(g); j++ {
				if !CanRunConcurrently(g[i].EventType, g[j].EventType) {
					t.Errorf("group %d: events %q and %q conflict but were placed in the same group",
						gi, g[i].EventType, g[j].EventType)
				}
			}
		}
	}
}

func TestGroupConcurrentEvents_GroupIntegrity_AllEventTypes(t *testing.T) {
	// Build a batch containing every event type once.
	events := make([]handler.RawEvent, len(allEventTypes))
	for i, et := range allEventTypes {
		events[i] = handler.RawEvent{
			EventType:   et,
			WorkspaceID: "ws1",
			Timestamp:   int64(i + 1),
		}
	}

	groups := GroupConcurrentEvents(events)

	// Verify total count.
	total := 0
	for _, g := range groups {
		total += len(g)
	}
	if total != len(allEventTypes) {
		t.Errorf("expected %d total events, got %d", len(allEventTypes), total)
	}

	// Verify no intra-group conflicts.
	for gi, g := range groups {
		for i := 0; i < len(g); i++ {
			for j := i + 1; j < len(g); j++ {
				if !CanRunConcurrently(g[i].EventType, g[j].EventType) {
					t.Errorf("group %d: events %q and %q conflict but were grouped together",
						gi, g[i].EventType, g[j].EventType)
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — large batch stress test
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_LargeBatch(t *testing.T) {
	// Create a large batch with many repeated event types.
	var events []handler.RawEvent
	for i := range 200 {
		et := allEventTypes[i%len(allEventTypes)]
		events = append(events, handler.RawEvent{
			EventType:   et,
			WorkspaceID: "ws1",
			Timestamp:   int64(i),
		})
	}

	groups := GroupConcurrentEvents(events)

	// Verify all events are present.
	total := 0
	for _, g := range groups {
		total += len(g)
	}
	if total != 200 {
		t.Errorf("expected 200 events across groups, got %d", total)
	}

	// Verify no intra-group conflicts.
	for gi, g := range groups {
		for i := range g {
			for j := i + 1; j < len(g); j++ {
				if !CanRunConcurrently(g[i].EventType, g[j].EventType) {
					t.Errorf("group %d: events %q (idx %d) and %q (idx %d) conflict",
						gi, g[i].EventType, i, g[j].EventType, j)
				}
			}
		}
	}

	// Verify at least some concurrency was achieved (should have fewer groups than events).
	if len(groups) >= 200 {
		t.Errorf("expected fewer than 200 groups with concurrent batching, got %d", len(groups))
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — ordering invariant
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_OrderingInvariant(t *testing.T) {
	// For any two events where the earlier one (by input order) conflicts
	// with the later one, the earlier event must be in a strictly earlier
	// group. This is the invariant the algorithm fix addresses.
	events := []handler.RawEvent{
		{EventType: handler.ResourceCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.PolicyCreate, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 3},
		{EventType: handler.DeploymentCreate, WorkspaceID: "ws1", Timestamp: 4},
		{EventType: handler.WorkflowCreate, WorkspaceID: "ws1", Timestamp: 5},
		{EventType: handler.SystemCreate, WorkspaceID: "ws1", Timestamp: 6},
		{EventType: handler.JobUpdate, WorkspaceID: "ws1", Timestamp: 7},
		{EventType: handler.EnvironmentCreate, WorkspaceID: "ws1", Timestamp: 8},
		{EventType: handler.ResourceUpdate, WorkspaceID: "ws1", Timestamp: 9},
		{EventType: handler.PolicyUpdate, WorkspaceID: "ws1", Timestamp: 10},
	}
	groups := GroupConcurrentEvents(events)

	// Build event→group index mapping using timestamps as event identifiers.
	groupOf := make(map[int64]int)
	for gi, g := range groups {
		for _, ev := range g {
			groupOf[ev.Timestamp] = gi
		}
	}

	for i := 0; i < len(events); i++ {
		for j := i + 1; j < len(events); j++ {
			if !CanRunConcurrently(events[i].EventType, events[j].EventType) {
				gi := groupOf[events[i].Timestamp]
				gj := groupOf[events[j].Timestamp]
				if gi >= gj {
					t.Errorf("event %q (input %d, group %d) must be in an earlier group than %q (input %d, group %d) because they conflict",
						events[i].EventType, i, gi, events[j].EventType, j, gj)
				}
			}
		}
	}
}

func TestGroupConcurrentEvents_OrderingInvariant_AllEventTypes(t *testing.T) {
	events := make([]handler.RawEvent, len(allEventTypes))
	for i, et := range allEventTypes {
		events[i] = handler.RawEvent{
			EventType:   et,
			WorkspaceID: "ws1",
			Timestamp:   int64(i + 1),
		}
	}
	groups := GroupConcurrentEvents(events)

	groupOf := make(map[int64]int)
	for gi, g := range groups {
		for _, ev := range g {
			groupOf[ev.Timestamp] = gi
		}
	}

	for i := 0; i < len(events); i++ {
		for j := i + 1; j < len(events); j++ {
			if !CanRunConcurrently(events[i].EventType, events[j].EventType) {
				gi := groupOf[events[i].Timestamp]
				gj := groupOf[events[j].Timestamp]
				if gi >= gj {
					t.Errorf("event %q (input %d, group %d) must be before %q (input %d, group %d)",
						events[i].EventType, i, gi, events[j].EventType, j, gj)
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// GroupConcurrentEvents — regression: out-of-order placement bug
// ---------------------------------------------------------------------------

func TestGroupConcurrentEvents_NoReorderPastConflict(t *testing.T) {
	// Regression test: events 1, 2, 3 where 1 is compatible with 3 but 2
	// conflicts with both 1 and 3. The old algorithm placed 3 into group 0
	// (before event 2), violating ordering.
	//
	// ResourceCreate (1) and ResourceUpdate (3) both write {resources} → conflict
	// ResourceCreate (1) and WorkspaceSave (2) → conflict (WorkspaceSave conflicts with all)
	// WorkspaceSave (2) and ResourceUpdate (3) → conflict
	//
	// Correct grouping: [[ResourceCreate], [WorkspaceSave], [ResourceUpdate]]
	events := []handler.RawEvent{
		{EventType: handler.ResourceCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.WorkspaceSave, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.ResourceUpdate, WorkspaceID: "ws1", Timestamp: 3},
	}
	groups := GroupConcurrentEvents(events)

	if len(groups) != 3 {
		t.Fatalf("expected 3 groups, got %d", len(groups))
	}
	if groups[0][0].EventType != handler.ResourceCreate {
		t.Errorf("group 0: expected ResourceCreate, got %q", groups[0][0].EventType)
	}
	if groups[1][0].EventType != handler.WorkspaceSave {
		t.Errorf("group 1: expected WorkspaceSave, got %q", groups[1][0].EventType)
	}
	if groups[2][0].EventType != handler.ResourceUpdate {
		t.Errorf("group 2: expected ResourceUpdate, got %q", groups[2][0].EventType)
	}
}

func TestGroupConcurrentEvents_DisjointSkipsConflictingMiddle(t *testing.T) {
	// Events: A(systems), B(metadata), C(systems)
	// A and C conflict (both write systems). B is disjoint from both.
	// Old algorithm: C placed in group 0 with A (bug: C before B which may conflict)
	// In this case B doesn't conflict with C, but C still must not jump before B
	// because B might have intermediate effects. With the fix:
	//   A → group 0
	//   B → lastConflict=-1, group 0 compatible → group 0: [A, B]
	//   C → lastConflict=0 (conflicts with A in group 0), scan from 1 → new group 1
	events := []handler.RawEvent{
		{EventType: handler.SystemCreate, WorkspaceID: "ws1", Timestamp: 1},
		{EventType: handler.GithubEntityCreate, WorkspaceID: "ws1", Timestamp: 2},
		{EventType: handler.SystemUpdate, WorkspaceID: "ws1", Timestamp: 3},
	}
	groups := GroupConcurrentEvents(events)

	if len(groups) != 2 {
		t.Fatalf("expected 2 groups, got %d", len(groups))
	}
	if len(groups[0]) != 2 {
		t.Errorf("expected group 0 to have 2 events, got %d", len(groups[0]))
	}
	if groups[0][0].EventType != handler.SystemCreate {
		t.Errorf("group 0[0]: expected SystemCreate, got %q", groups[0][0].EventType)
	}
	if groups[0][1].EventType != handler.GithubEntityCreate {
		t.Errorf("group 0[1]: expected GithubEntityCreate, got %q", groups[0][1].EventType)
	}
	if groups[1][0].EventType != handler.SystemUpdate {
		t.Errorf("group 1[0]: expected SystemUpdate, got %q", groups[1][0].EventType)
	}
}

// ---------------------------------------------------------------------------
// domainsOverlap (exported via conflict detection, but verify edge cases)
// ---------------------------------------------------------------------------

func TestDomainsOverlap_BothEmpty(t *testing.T) {
	// Two events with no writes/reads should not conflict.
	// We test this through CanRunConcurrently with WorkspaceTick (read-only).
	if !CanRunConcurrently(handler.WorkspaceTick, handler.WorkspaceTick) {
		t.Error("two read-only events should be concurrent")
	}
}

func TestDomainsOverlap_OneEmpty(t *testing.T) {
	// WorkspaceTick writes nil, SystemCreate writes {systems}.
	// SystemCreate reads nil, WorkspaceTick reads {release_targets}.
	// No overlap: SystemCreate.writes ∩ WorkspaceTick.reads = {systems} ∩ {release_targets} = ∅
	// WorkspaceTick.writes ∩ SystemCreate.reads = nil ∩ nil = ∅
	// WorkspaceTick.writes ∩ SystemCreate.writes = nil ∩ {systems} = ∅
	if !CanRunConcurrently(handler.WorkspaceTick, handler.SystemCreate) {
		t.Error("WorkspaceTick (no writes) and SystemCreate (no reads, writes systems) should be concurrent")
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func expectDomains(t *testing.T, label string, got []StateDomain, expected ...StateDomain) {
	t.Helper()
	if len(got) != len(expected) {
		t.Errorf("%s: expected %d domains %v, got %d domains %v", label, len(expected), expected, len(got), got)
		return
	}
	set := make(map[StateDomain]bool, len(expected))
	for _, d := range expected {
		set[d] = true
	}
	for _, d := range got {
		if !set[d] {
			t.Errorf("%s: unexpected domain %q (expected %v)", label, d, expected)
		}
	}
}

func logGroups(t *testing.T, groups [][]handler.RawEvent) {
	t.Helper()
	for i, g := range groups {
		types := make([]handler.EventType, len(g))
		for j, e := range g {
			types[j] = e.EventType
		}
		t.Logf("  group %d: %v", i, types)
	}
}
