package server

import (
	"fmt"
	"net/http"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("server")

// Server implements the OpenAPI ServerInterface for the workspace engine
type Server struct {}

// New creates a new Server instance
func New() *Server {
	return &Server{}
}

// SetupRouter configures and returns a Gin router with all routes and middleware
func (s *Server) SetupRouter() *gin.Engine {
	router := gin.New()

	// Middleware
	router.Use(gin.Recovery())
	router.Use(LoggerMiddleware())
	router.Use(TracingMiddleware())
	router.Use(CORSMiddleware())

	// Health check
	router.GET("/healthz", s.HealthCheck)

	// API routes
	api := router.Group("/api/v1")
	{
		// Workspace routes
		workspaces := api.Group("/workspaces/:workspaceId")
		{
			// Release targets
			workspaces.POST("/release-targets/compute", s.ComputeReleaseTargets)
			workspaces.POST("/release-targets/list", s.ListReleaseTargets)

			// Deployments
			workspaces.POST("/deployments/list", s.ListDeployments)

			// Resources
			workspaces.GET("/resources", s.ListResources)
			workspaces.POST("/resources", s.UpsertResource)
			workspaces.DELETE("/resources/:resourceId", s.DeleteResource)

			// Environments
			workspaces.GET("/environments", s.ListEnvironments)
			workspaces.POST("/environments", s.UpsertEnvironment)
			workspaces.DELETE("/environments/:environmentId", s.DeleteEnvironment)

			// Jobs
			workspaces.GET("/jobs", s.ListJobs)
			workspaces.GET("/jobs/:jobId", s.GetJob)

			// Releases
			workspaces.GET("/releases", s.ListReleases)
			workspaces.GET("/releases/:releaseId", s.GetRelease)

			// Policies
			workspaces.GET("/policies", s.ListPolicies)
			workspaces.POST("/policies", s.UpsertPolicy)
			workspaces.DELETE("/policies/:policyId", s.DeletePolicy)
		}
	}

	return router
}

// HealthCheck returns the server health status
func (s *Server) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"service": "workspace-engine",
	})
}

// ComputeReleaseTargets computes release targets based on environments, deployments, and resources
func (s *Server) ComputeReleaseTargets(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "ComputeReleaseTargets")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	var req oapi.ComputeReleaseTargetsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ws := workspace.GetWorkspace(workspaceId)

	// Upsert all entities
	for _, env := range req.Environments {
		if err := ws.Environments().Upsert(ctx, &env); err != nil {
			span.RecordError(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to upsert environment: %v", err)})
			return
		}
	}

	for _, dep := range req.Deployments {
		if err := ws.Deployments().Upsert(ctx, &dep); err != nil {
			span.RecordError(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to upsert deployment: %v", err)})
			return
		}
	}

	for _, res := range req.Resources {
		if _, err := ws.Resources().Upsert(ctx, &res); err != nil {
			span.RecordError(err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("failed to upsert resource: %v", err)})
			return
		}
	}

	// Get computed release targets
	releaseTargets := ws.ReleaseTargets().Items(ctx)
	targets := make([]oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, rt := range releaseTargets {
		targets = append(targets, *rt)
	}

	span.SetAttributes(attribute.Int("release_targets.count", len(targets)))

	c.JSON(http.StatusOK, oapi.ComputeReleaseTargetsResponse{
		ReleaseTargets: targets,
	})
}

// ListReleaseTargets lists release targets with optional filtering
func (s *Server) ListReleaseTargets(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "ListReleaseTargets")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	var req oapi.ListReleaseTargetsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ws := workspace.GetWorkspace(workspaceId)
	releaseTargets := ws.ReleaseTargets().Items(ctx)

	// TODO: Apply selectors for filtering if provided in request
	// - req.ResourceSelector
	// - req.DeploymentSelector
	// - req.EnvironmentSelector

	targets := make([]oapi.ReleaseTarget, 0, len(releaseTargets))
	for _, rt := range releaseTargets {
		targets = append(targets, *rt)
	}

	span.SetAttributes(attribute.Int("release_targets.count", len(targets)))

	c.JSON(http.StatusOK, oapi.ListReleaseTargetsResponse{
		ReleaseTargets: targets,
	})
}

// ListDeployments lists deployments with optional filtering
func (s *Server) ListDeployments(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "ListDeployments")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	var req oapi.ListDeploymentsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ws := workspace.GetWorkspace(workspaceId)
	deployments := ws.Deployments().Items()

	// TODO: Apply deploymentSelector for filtering if provided

	depList := make([]oapi.Deployment, 0, len(deployments))
	for _, dep := range deployments {
		depList = append(depList, *dep)
	}

	span.SetAttributes(attribute.Int("deployments.count", len(depList)))

	c.JSON(http.StatusOK, oapi.ListDeploymentsResponse{
		Deployments: depList,
	})
}

// ListResources lists all resources in a workspace
func (s *Server) ListResources(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "ListResources")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	ws := workspace.GetWorkspace(workspaceId)
	resources := ws.Resources().Items()

	resList := make([]oapi.Resource, 0, len(resources))
	for _, res := range resources {
		resList = append(resList, *res)
	}

	span.SetAttributes(attribute.Int("resources.count", len(resList)))
	c.JSON(http.StatusOK, resList)
}

// UpsertResource creates or updates a resource
func (s *Server) UpsertResource(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "UpsertResource")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	var resource oapi.Resource
	if err := c.ShouldBindJSON(&resource); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resource.WorkspaceId = workspaceId
	span.SetAttributes(attribute.String("resource.id", resource.Id))

	ws := workspace.GetWorkspace(workspaceId)
	result, err := ws.Resources().Upsert(ctx, &resource)
	if err != nil {
		span.RecordError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// DeleteResource deletes a resource
func (s *Server) DeleteResource(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "DeleteResource")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	resourceId := c.Param("resourceId")
	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("resource.id", resourceId),
	)

	ws := workspace.GetWorkspace(workspaceId)
	ws.Resources().Remove(ctx, resourceId)

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ListEnvironments lists all environments in a workspace
func (s *Server) ListEnvironments(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "ListEnvironments")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	ws := workspace.GetWorkspace(workspaceId)
	environments := ws.Environments().Items()

	envList := make([]oapi.Environment, 0, len(environments))
	for _, env := range environments {
		envList = append(envList, *env)
	}

	span.SetAttributes(attribute.Int("environments.count", len(envList)))
	c.JSON(http.StatusOK, envList)
}

// UpsertEnvironment creates or updates an environment
func (s *Server) UpsertEnvironment(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "UpsertEnvironment")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	var env oapi.Environment
	if err := c.ShouldBindJSON(&env); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	span.SetAttributes(attribute.String("environment.id", env.Id))

	ws := workspace.GetWorkspace(workspaceId)
	if err := ws.Environments().Upsert(ctx, &env); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, env)
}

// DeleteEnvironment deletes an environment
func (s *Server) DeleteEnvironment(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "DeleteEnvironment")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	environmentId := c.Param("environmentId")
	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("environment.id", environmentId),
	)

	ws := workspace.GetWorkspace(workspaceId)
	ws.Environments().Remove(ctx, environmentId)

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// ListJobs lists all jobs in a workspace
func (s *Server) ListJobs(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "ListJobs")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	ws := workspace.GetWorkspace(workspaceId)
	jobs := ws.Jobs().Items()

	jobList := make([]oapi.Job, 0, len(jobs))
	for _, job := range jobs {
		jobList = append(jobList, *job)
	}

	span.SetAttributes(attribute.Int("jobs.count", len(jobList)))
	c.JSON(http.StatusOK, jobList)
}

// GetJob retrieves a specific job
func (s *Server) GetJob(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "GetJob")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	jobId := c.Param("jobId")
	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("job.id", jobId),
	)

	ws := workspace.GetWorkspace(workspaceId)
	job, exists := ws.Jobs().Get(jobId)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// ListReleases lists all releases in a workspace
func (s *Server) ListReleases(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "ListReleases")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	ws := workspace.GetWorkspace(workspaceId)
	
	// Iterate over releases to build list
	releaseList := make([]oapi.Release, 0)
	for item := range ws.Releases().IterBuffered() {
		releaseList = append(releaseList, *item.Val)
	}

	span.SetAttributes(attribute.Int("releases.count", len(releaseList)))
	c.JSON(http.StatusOK, releaseList)
}

// GetRelease retrieves a specific release
func (s *Server) GetRelease(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "GetRelease")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	releaseId := c.Param("releaseId")
	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("release.id", releaseId),
	)

	ws := workspace.GetWorkspace(workspaceId)
	release, exists := ws.Releases().Get(releaseId)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "release not found"})
		return
	}

	c.JSON(http.StatusOK, release)
}

// ListPolicies lists all policies in a workspace
func (s *Server) ListPolicies(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "ListPolicies")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	ws := workspace.GetWorkspace(workspaceId)
	policies := ws.Policies().Items()

	policyList := make([]oapi.Policy, 0, len(policies))
	for _, pol := range policies {
		policyList = append(policyList, *pol)
	}

	span.SetAttributes(attribute.Int("policies.count", len(policyList)))
	c.JSON(http.StatusOK, policyList)
}

// UpsertPolicy creates or updates a policy
func (s *Server) UpsertPolicy(c *gin.Context) {
	ctx, span := tracer.Start(c.Request.Context(), "UpsertPolicy")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	span.SetAttributes(attribute.String("workspace.id", workspaceId))

	var policy oapi.Policy
	if err := c.ShouldBindJSON(&policy); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	policy.WorkspaceId = workspaceId
	span.SetAttributes(attribute.String("policy.id", policy.Id))

	ws := workspace.GetWorkspace(workspaceId)
	if err := ws.Policies().Upsert(ctx, &policy); err != nil {
		span.RecordError(err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, policy)
}

// DeletePolicy deletes a policy
func (s *Server) DeletePolicy(c *gin.Context) {
	_, span := tracer.Start(c.Request.Context(), "DeletePolicy")
	defer span.End()

	workspaceId := c.Param("workspaceId")
	policyId := c.Param("policyId")
	span.SetAttributes(
		attribute.String("workspace.id", workspaceId),
		attribute.String("policy.id", policyId),
	)

	ws := workspace.GetWorkspace(workspaceId)
	ws.Policies().Remove(policyId)

	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

// LoggerMiddleware provides request logging
func LoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := c.Request.Context().Value("request_start")
		if start == nil {
			c.Next()
			return
		}

		log.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
		)

		c.Next()
	}
}

// TracingMiddleware adds OpenTelemetry tracing to requests
func TracingMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		ctx, span := tracer.Start(ctx, fmt.Sprintf("%s %s", c.Request.Method, c.Request.URL.Path),
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.path", c.Request.URL.Path),
				attribute.String("http.route", c.FullPath()),
			),
		)
		defer span.End()

		c.Request = c.Request.WithContext(ctx)
		c.Next()

		span.SetAttributes(attribute.Int("http.status_code", c.Writer.Status()))
		if c.Writer.Status() >= 400 {
			span.RecordError(fmt.Errorf("HTTP %d", c.Writer.Status()))
		}
	}
}

// CORSMiddleware handles CORS headers
func CORSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
