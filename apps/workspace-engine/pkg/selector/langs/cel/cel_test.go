package cel

import (
	"encoding/json"
	"testing"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/pb"

	"google.golang.org/protobuf/types/known/structpb"
)

// Helper function to convert oapi.Resource to pb.Resource
func oapiResourceToPb(t *testing.T, r *oapi.Resource) pb.Resource {
	t.Helper()

	configStruct, err := structpb.NewStruct(r.Config)
	if err != nil {
		t.Fatalf("Failed to convert config to structpb: %v", err)
	}

	pbResource := pb.Resource{
		Id:          r.Id,
		Name:        r.Name,
		Version:     r.Version,
		Kind:        r.Kind,
		Identifier:  r.Identifier,
		CreatedAt:   r.CreatedAt,
		WorkspaceId: r.WorkspaceId,
		Config:      configStruct,
		Metadata:    r.Metadata,
	}

	if r.ProviderId != nil {
		pbResource.ProviderId = r.ProviderId
	}
	if r.LockedAt != nil {
		pbResource.LockedAt = r.LockedAt
	}
	if r.UpdatedAt != nil {
		pbResource.UpdatedAt = r.UpdatedAt
	}
	if r.DeletedAt != nil {
		pbResource.DeletedAt = r.DeletedAt
	}

	return pbResource
}

// Helper function to convert oapi.System to pb.System
func oapiSystemToPb(t *testing.T, s *oapi.System) pb.System {
	t.Helper()

	pbSystem := pb.System{
		Id:          s.Id,
		WorkspaceId: s.WorkspaceId,
		Name:        s.Name,
	}

	if s.Description != nil {
		pbSystem.Description = s.Description
	}

	return pbSystem
}

// Helper function to convert oapi.Deployment to pb.Deployment
func oapiDeploymentToPb(t *testing.T, d *oapi.Deployment) pb.Deployment {
	t.Helper()

	jobAgentConfig, err := structpb.NewStruct(d.JobAgentConfig)
	if err != nil {
		t.Fatalf("Failed to convert jobAgentConfig to structpb: %v", err)
	}

	pbDeployment := pb.Deployment{
		Id:             d.Id,
		Name:           d.Name,
		Slug:           d.Slug,
		SystemId:       d.SystemId,
		JobAgentConfig: jobAgentConfig,
	}

	if d.Description != nil {
		pbDeployment.Description = d.Description
	}
	if d.JobAgentId != nil {
		pbDeployment.JobAgentId = d.JobAgentId
	}

	return pbDeployment
}

// Helper function to create a CEL context from oapi types
func createCelContext(t *testing.T, resource *oapi.Resource, system *oapi.System, deployment *oapi.Deployment) map[string]interface{} {
	t.Helper()

	context := make(map[string]interface{})

	if resource != nil {
		resourceMap := map[string]interface{}{
			"id":          resource.Id,
			"name":        resource.Name,
			"version":     resource.Version,
			"kind":        resource.Kind,
			"identifier":  resource.Identifier,
			"createdAt":   resource.CreatedAt,
			"workspaceId": resource.WorkspaceId,
			"config":      resource.Config,
			"metadata":    resource.Metadata,
		}
		context["resource"] = resourceMap
	}

	if deployment != nil {
		deploymentMap := map[string]interface{}{
			"id":             deployment.Id,
			"name":           deployment.Name,
			"slug":           deployment.Slug,
			"systemId":       deployment.SystemId,
			"jobAgentConfig": deployment.JobAgentConfig,
		}
		context["deployment"] = deploymentMap
	}

	if system != nil {
		environmentMap := map[string]interface{}{
			"id":          system.Id,
			"workspaceId": system.WorkspaceId,
			"name":        system.Name,
		}
		context["environment"] = environmentMap
	}

	return context
}

func TestCompile_ValidExpressions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		wantErr    bool
	}{
		{
			name:       "simple resource name check",
			expression: "resource.name == 'production-server'",
			wantErr:    false,
		},
		{
			name:       "resource kind contains",
			expression: "resource.kind.contains('kubernetes')",
			wantErr:    false,
		},
		{
			name:       "metadata access",
			expression: "resource.metadata['region'] == 'us-east-1'",
			wantErr:    false,
		},
		{
			name:       "deployment name check",
			expression: "deployment.name == 'api-deployment'",
			wantErr:    false,
		},
		{
			name:       "environment name check",
			expression: "environment.name == 'production'",
			wantErr:    false,
		},
		{
			name:       "complex AND condition",
			expression: "resource.kind == 'service' && deployment.name == 'api'",
			wantErr:    false,
		},
		{
			name:       "complex OR condition",
			expression: "resource.metadata['env'] == 'prod' || resource.metadata['env'] == 'production'",
			wantErr:    false,
		},
		{
			name:       "nested config access",
			expression: "resource.config['replicas'] == 3",
			wantErr:    false,
		},
		{
			name:       "startsWith check",
			expression: "resource.name.startsWith('prod-')",
			wantErr:    false,
		},
		{
			name:       "endsWith check",
			expression: "resource.kind.endsWith('-service')",
			wantErr:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if (err != nil) != tt.wantErr {
				t.Errorf("Compile() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && selector == nil {
				t.Error("Compile() returned nil selector without error")
			}
		})
	}
}

func TestCompile_InvalidExpressions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
	}{
		{
			name:       "syntax error",
			expression: "resource.name ==",
		},
		{
			name:       "invalid operator",
			expression: "resource.name === 'test'",
		},
		{
			name:       "unclosed parenthesis",
			expression: "(resource.name == 'test'",
		},
		{
			name:       "invalid variable",
			expression: "invalid_var.name == 'test'",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Compile(tt.expression)
			if err == nil {
				t.Error("Compile() expected error but got none")
			}
		})
	}
}

func TestCelSelector_Matches_ResourceConditions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   *oapi.Resource
		want       bool
		wantErr    bool
	}{
		{
			name:       "exact name match - positive",
			expression: "resource.name == 'production-server'",
			resource: &oapi.Resource{
				Id:          "1",
				Name:        "production-server",
				Kind:        "server",
				Version:     "1.0.0",
				Identifier:  "prod-srv-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "exact name match - negative",
			expression: "resource.name == 'production-server'",
			resource: &oapi.Resource{
				Id:          "2",
				Name:        "staging-server",
				Kind:        "server",
				Version:     "1.0.0",
				Identifier:  "stg-srv-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    false,
			wantErr: false,
		},
		{
			name:       "kind contains - positive",
			expression: "resource.kind.contains('kubernetes')",
			resource: &oapi.Resource{
				Id:          "3",
				Name:        "api-service",
				Kind:        "kubernetes-service",
				Version:     "1.0.0",
				Identifier:  "k8s-api",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "startsWith - positive",
			expression: "resource.name.startsWith('prod-')",
			resource: &oapi.Resource{
				Id:          "4",
				Name:        "prod-api",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "prod-api-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "endsWith - positive",
			expression: "resource.kind.endsWith('-service')",
			resource: &oapi.Resource{
				Id:          "5",
				Name:        "api",
				Kind:        "web-service",
				Version:     "1.0.0",
				Identifier:  "web-api",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, tt.resource, nil, nil)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

func TestCelSelector_Matches_MetadataConditions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   *oapi.Resource
		want       bool
		wantErr    bool
	}{
		{
			name:       "metadata equals - positive",
			expression: "resource.metadata['env'] == 'production'",
			resource: &oapi.Resource{
				Id:          "1",
				Name:        "server-1",
				Kind:        "server",
				Version:     "1.0.0",
				Identifier:  "srv-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env": "production",
				},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "metadata equals - negative",
			expression: "resource.metadata['env'] == 'production'",
			resource: &oapi.Resource{
				Id:          "2",
				Name:        "server-2",
				Kind:        "server",
				Version:     "1.0.0",
				Identifier:  "srv-2",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env": "staging",
				},
			},
			want:    false,
			wantErr: false,
		},
		{
			name:       "metadata region check",
			expression: "resource.metadata['region'].startsWith('us-')",
			resource: &oapi.Resource{
				Id:          "3",
				Name:        "server-3",
				Kind:        "server",
				Version:     "1.0.0",
				Identifier:  "srv-3",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"region": "us-east-1",
				},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "multiple metadata conditions",
			expression: "resource.metadata['env'] == 'production' && resource.metadata['tier'] == 'premium'",
			resource: &oapi.Resource{
				Id:          "4",
				Name:        "server-4",
				Kind:        "server",
				Version:     "1.0.0",
				Identifier:  "srv-4",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env":  "production",
					"tier": "premium",
				},
			},
			want:    true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, tt.resource, nil, nil)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

func TestCelSelector_Matches_ConfigConditions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   *oapi.Resource
		want       bool
		wantErr    bool
	}{
		{
			name:       "config replicas check",
			expression: "resource.config['replicas'] == 3",
			resource: &oapi.Resource{
				Id:          "1",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"replicas": 3,
				},
				Metadata: map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "config string value check",
			expression: "resource.config['version'] == '1.2.0'",
			resource: &oapi.Resource{
				Id:          "2",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-2",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"version": "1.2.0",
				},
				Metadata: map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "config boolean check",
			expression: "resource.config['enabled'] == true",
			resource: &oapi.Resource{
				Id:          "3",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-3",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"enabled": true,
				},
				Metadata: map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "nested config access",
			expression: "resource.config['network']['type'] == 'public'",
			resource: &oapi.Resource{
				Id:          "4",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-4",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"network": map[string]interface{}{
						"type": "public",
					},
				},
				Metadata: map[string]string{},
			},
			want:    true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, tt.resource, nil, nil)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

func TestCelSelector_Matches_DeploymentConditions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		deployment *oapi.Deployment
		want       bool
		wantErr    bool
	}{
		{
			name:       "deployment name check",
			expression: "deployment.name == 'api-deployment'",
			deployment: &oapi.Deployment{
				Id:             "1",
				Name:           "api-deployment",
				Slug:           "api",
				SystemId:       "sys-1",
				JobAgentConfig: map[string]interface{}{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "deployment slug check",
			expression: "deployment.slug.startsWith('prod-')",
			deployment: &oapi.Deployment{
				Id:             "2",
				Name:           "production-api",
				Slug:           "prod-api",
				SystemId:       "sys-1",
				JobAgentConfig: map[string]interface{}{},
			},
			want:    true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, nil, nil, tt.deployment)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

func TestCelSelector_Matches_EnvironmentConditions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		system     *oapi.System
		want       bool
		wantErr    bool
	}{
		{
			name:       "environment name check",
			expression: "environment.name == 'production'",
			system: &oapi.System{
				Id:          "1",
				Name:        "production",
				WorkspaceId: "ws-1",
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "environment name contains",
			expression: "environment.name.contains('prod')",
			system: &oapi.System{
				Id:          "2",
				Name:        "production-us",
				WorkspaceId: "ws-1",
			},
			want:    true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, nil, tt.system, nil)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

func TestCelSelector_Matches_ComplexConditions(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   *oapi.Resource
		deployment *oapi.Deployment
		system     *oapi.System
		want       bool
		wantErr    bool
	}{
		{
			name:       "resource and deployment",
			expression: "resource.kind == 'service' && deployment.name == 'api-deployment'",
			resource: &oapi.Resource{
				Id:          "1",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			deployment: &oapi.Deployment{
				Id:             "1",
				Name:           "api-deployment",
				Slug:           "api",
				SystemId:       "sys-1",
				JobAgentConfig: map[string]interface{}{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "resource, deployment, and environment",
			expression: "resource.metadata['env'] == 'production' && deployment.slug == 'api' && environment.name == 'prod'",
			resource: &oapi.Resource{
				Id:          "2",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-2",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env": "production",
				},
			},
			deployment: &oapi.Deployment{
				Id:             "2",
				Name:           "api-deployment",
				Slug:           "api",
				SystemId:       "sys-1",
				JobAgentConfig: map[string]interface{}{},
			},
			system: &oapi.System{
				Id:          "1",
				Name:        "prod",
				WorkspaceId: "ws-1",
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "complex OR with metadata and config",
			expression: "(resource.metadata['tier'] == 'premium' && resource.config['replicas'] > 2) || deployment.name.contains('critical')",
			resource: &oapi.Resource{
				Id:          "3",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-3",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"replicas": 5,
				},
				Metadata: map[string]string{
					"tier": "premium",
				},
			},
			deployment: &oapi.Deployment{
				Id:             "3",
				Name:           "standard-deployment",
				Slug:           "standard",
				SystemId:       "sys-1",
				JobAgentConfig: map[string]interface{}{},
			},
			want:    true,
			wantErr: false,
		},
		{
			name:       "nested conditions with multiple ANDs and ORs",
			expression: "(resource.kind == 'service' || resource.kind == 'deployment') && (resource.metadata['region'].startsWith('us-') || resource.metadata['region'].startsWith('eu-')) && deployment.slug.contains('api')",
			resource: &oapi.Resource{
				Id:          "4",
				Name:        "api-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "api-4",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"region": "us-west-2",
				},
			},
			deployment: &oapi.Deployment{
				Id:             "4",
				Name:           "API Deployment",
				Slug:           "main-api",
				SystemId:       "sys-1",
				JobAgentConfig: map[string]interface{}{},
			},
			want:    true,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, tt.resource, tt.system, tt.deployment)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

func TestCelSelector_Matches_RealWorldScenarios(t *testing.T) {
	t.Run("production kubernetes services in US regions", func(t *testing.T) {
		expression := "resource.kind.contains('kubernetes') && resource.metadata['env'] == 'production' && resource.metadata['region'].startsWith('us-')"

		resources := []*oapi.Resource{
			{
				Id:          "1",
				Name:        "payment-service",
				Kind:        "kubernetes-service",
				Version:     "1.0.0",
				Identifier:  "payment",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env":    "production",
					"region": "us-east-1",
				},
			},
			{
				Id:          "2",
				Name:        "auth-service",
				Kind:        "kubernetes-service",
				Version:     "1.0.0",
				Identifier:  "auth",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env":    "staging",
					"region": "us-east-1",
				},
			},
			{
				Id:          "3",
				Name:        "billing-service",
				Kind:        "kubernetes-service",
				Version:     "1.0.0",
				Identifier:  "billing",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata: map[string]string{
					"env":    "production",
					"region": "eu-west-1",
				},
			},
		}

		selector, err := Compile(expression)
		if err != nil {
			t.Fatalf("Compile() error = %v", err)
		}

		matchCount := 0
		for _, resource := range resources {
			context := createCelContext(t, resource, nil, nil)
			got, err := selector.Program.Eval(context)
			if err != nil {
				t.Errorf("Eval() error = %v", err)
				continue
			}
			if result, ok := got.Value().(bool); ok && result {
				matchCount++
			}
		}

		if matchCount != 1 {
			t.Errorf("Expected 1 match, got %d", matchCount)
		}
	})

	t.Run("critical services with high replica count", func(t *testing.T) {
		expression := "resource.metadata['priority'] == 'critical' && resource.config['replicas'] >= 3"

		resources := []*oapi.Resource{
			{
				Id:          "1",
				Name:        "payment-gateway",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "payment",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"replicas": 5,
				},
				Metadata: map[string]string{
					"priority": "critical",
				},
			},
			{
				Id:          "2",
				Name:        "notification-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "notification",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"replicas": 2,
				},
				Metadata: map[string]string{
					"priority": "critical",
				},
			},
			{
				Id:          "3",
				Name:        "analytics-service",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "analytics",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config: map[string]interface{}{
					"replicas": 3,
				},
				Metadata: map[string]string{
					"priority": "low",
				},
			},
		}

		selector, err := Compile(expression)
		if err != nil {
			t.Fatalf("Compile() error = %v", err)
		}

		matchCount := 0
		matchedIDs := []string{}
		for _, resource := range resources {
			context := createCelContext(t, resource, nil, nil)
			got, err := selector.Program.Eval(context)
			if err != nil {
				t.Errorf("Eval() error = %v", err)
				continue
			}
			if result, ok := got.Value().(bool); ok && result {
				matchCount++
				matchedIDs = append(matchedIDs, resource.Id)
			}
		}

		if matchCount != 1 {
			t.Errorf("Expected 1 match, got %d (matched IDs: %v)", matchCount, matchedIDs)
		}
		if len(matchedIDs) > 0 && matchedIDs[0] != "1" {
			t.Errorf("Expected match ID '1', got '%s'", matchedIDs[0])
		}
	})
}

func TestCelSelector_EdgeCases(t *testing.T) {
	tests := []struct {
		name       string
		expression string
		resource   *oapi.Resource
		want       bool
		wantErr    bool
	}{
		{
			name:       "empty metadata access returns false",
			expression: "resource.metadata['nonexistent'] == 'value'",
			resource: &oapi.Resource{
				Id:          "1",
				Name:        "test",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "test-1",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    false,
			wantErr: false,
		},
		{
			name:       "empty config access",
			expression: "resource.config['nonexistent'] == 'value'",
			resource: &oapi.Resource{
				Id:          "2",
				Name:        "test",
				Kind:        "service",
				Version:     "1.0.0",
				Identifier:  "test-2",
				CreatedAt:   "2024-01-01T00:00:00Z",
				WorkspaceId: "ws-1",
				Config:      map[string]interface{}{},
				Metadata:    map[string]string{},
			},
			want:    false,
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			selector, err := Compile(tt.expression)
			if err != nil {
				t.Fatalf("Compile() error = %v", err)
			}

			context := createCelContext(t, tt.resource, nil, nil)
			got, err := selector.Program.Eval(context)
			if (err != nil) != tt.wantErr {
				t.Errorf("Matches() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if !tt.wantErr {
				result, ok := got.Value().(bool)
				if !ok {
					t.Fatalf("Result is not a boolean: %v", got.Value())
				}
				if result != tt.want {
					t.Errorf("Matches() = %v, want %v", result, tt.want)
				}
			}
		})
	}
}

// Benchmark tests
func BenchmarkCompile(b *testing.B) {
	expression := "resource.kind == 'service' && resource.metadata['env'] == 'production'"
	for i := 0; i < b.N; i++ {
		_, _ = Compile(expression)
	}
}

func BenchmarkMatches_Simple(b *testing.B) {
	expression := "resource.name == 'production-server'"
	selector, _ := Compile(expression)
	resource := &oapi.Resource{
		Id:          "1",
		Name:        "production-server",
		Kind:        "server",
		Version:     "1.0.0",
		Identifier:  "prod-srv-1",
		CreatedAt:   "2024-01-01T00:00:00Z",
		WorkspaceId: "ws-1",
		Config:      map[string]interface{}{},
		Metadata:    map[string]string{},
	}
	context := map[string]interface{}{
		"resource": map[string]interface{}{
			"id":          resource.Id,
			"name":        resource.Name,
			"version":     resource.Version,
			"kind":        resource.Kind,
			"identifier":  resource.Identifier,
			"createdAt":   resource.CreatedAt,
			"workspaceId": resource.WorkspaceId,
			"config":      resource.Config,
			"metadata":    resource.Metadata,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = selector.Program.Eval(context)
	}
}

func BenchmarkMatches_Complex(b *testing.B) {
	expression := "(resource.kind == 'service' || resource.kind == 'deployment') && resource.metadata['region'].startsWith('us-') && resource.config['replicas'] > 2"
	selector, _ := Compile(expression)
	resource := &oapi.Resource{
		Id:          "1",
		Name:        "api-service",
		Kind:        "service",
		Version:     "1.0.0",
		Identifier:  "api-1",
		CreatedAt:   "2024-01-01T00:00:00Z",
		WorkspaceId: "ws-1",
		Config: map[string]interface{}{
			"replicas": 5,
		},
		Metadata: map[string]string{
			"region": "us-west-2",
		},
	}
	context := map[string]interface{}{
		"resource": map[string]interface{}{
			"id":          resource.Id,
			"name":        resource.Name,
			"version":     resource.Version,
			"kind":        resource.Kind,
			"identifier":  resource.Identifier,
			"createdAt":   resource.CreatedAt,
			"workspaceId": resource.WorkspaceId,
			"config":      resource.Config,
			"metadata":    resource.Metadata,
		},
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = selector.Program.Eval(context)
	}
}
