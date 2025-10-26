package router

import (
	"net/http"
	"strings"

	"workspace-engine-router/pkg/kafka"
	"workspace-engine-router/pkg/partitioner"
	"workspace-engine-router/pkg/proxy"
	"workspace-engine-router/pkg/registry"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
)

// Router handles HTTP routing to workspace-engine workers
type Router struct {
	registry         registry.WorkerRegistry
	partitionCounter *kafka.PartitionCounter
	proxy            *proxy.ReverseProxy
}

// New creates a new Router instance
func New(
	reg registry.WorkerRegistry,
	pc *kafka.PartitionCounter,
	prx *proxy.ReverseProxy,
) *Router {
	return &Router{
		registry:         reg,
		partitionCounter: pc,
		proxy:            prx,
	}
}

// SetupManagementRouter configures and returns the management API router
func (r *Router) SetupManagementRouter() *gin.Engine {
	router := gin.New()
	gin.SetMode(gin.ReleaseMode)

	// Middleware
	router.Use(RecoveryMiddleware())
	router.Use(LoggerMiddleware())
	router.Use(TracingMiddleware())
	router.Use(CORSMiddleware())

	// Health check
	router.GET("/healthz", r.HealthCheck)

	// Management API for worker registration
	router.POST("/register", r.RegisterWorker)
	router.POST("/heartbeat", r.HeartbeatWorker)
	router.POST("/unregister", r.UnregisterWorker)
	router.GET("/workers", r.ListWorkersHandler)

	return router
}

// SetupRoutingRouter configures and returns the routing/proxy router
func (r *Router) SetupRoutingRouter() *gin.Engine {
	router := gin.New()
	gin.SetMode(gin.ReleaseMode)

	// Middleware
	router.Use(RecoveryMiddleware())
	router.Use(LoggerMiddleware())
	router.Use(TracingMiddleware())
	router.Use(CORSMiddleware())

	// Proxy ALL requests to workers
	router.NoRoute(r.RouteToWorkerAllPaths)

	return router
}

// HealthCheck returns the router health status
func (r *Router) HealthCheck(c *gin.Context) {
	workers, err := r.registry.ListWorkers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "unhealthy",
			"error":  err.Error(),
		})
		return
	}

	partitionCount, err := r.partitionCounter.GetPartitionCount()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"status": "unhealthy",
			"error":  "Failed to get partition count",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":          "ok",
		"service":         "workspace-engine-router",
		"workers":         len(workers),
		"partition_count": partitionCount,
	})
}

// RegisterWorkerRequest represents the request body for worker registration
type RegisterWorkerRequest struct {
	WorkerID    string  `json:"workerId" binding:"required"`
	HTTPAddress string  `json:"httpAddress" binding:"required"`
	Partitions  []int32 `json:"partitions" binding:"required"`
}

// RegisterWorker handles worker registration
func (r *Router) RegisterWorker(c *gin.Context) {
	var req RegisterWorkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	log.Info("Registering worker",
		"worker_id", req.WorkerID,
		"http_address", req.HTTPAddress,
		"partitions", req.Partitions)

	if err := r.registry.Register(req.WorkerID, req.HTTPAddress, req.Partitions); err != nil {
		log.Error("Failed to register worker", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to register worker",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "registered",
		"message": "Worker successfully registered",
	})
}

// HeartbeatWorkerRequest represents the request body for worker heartbeat
type HeartbeatWorkerRequest struct {
	WorkerID string `json:"workerId" binding:"required"`
}

// HeartbeatWorker handles worker heartbeat updates
func (r *Router) HeartbeatWorker(c *gin.Context) {
	var req HeartbeatWorkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	if err := r.registry.Heartbeat(req.WorkerID); err != nil {
		if err == registry.ErrWorkerNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Worker not found. Please register first.",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update heartbeat",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

// UnregisterWorkerRequest represents the request body for worker unregistration
type UnregisterWorkerRequest struct {
	WorkerID string `json:"workerId" binding:"required"`
}

// UnregisterWorker handles worker unregistration
func (r *Router) UnregisterWorker(c *gin.Context) {
	var req UnregisterWorkerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	log.Info("Unregistering worker", "worker_id", req.WorkerID)

	if err := r.registry.Unregister(req.WorkerID); err != nil {
		if err == registry.ErrWorkerNotFound {
			c.JSON(http.StatusNotFound, gin.H{
				"error": "Worker not found",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to unregister worker",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "unregistered",
		"message": "Worker successfully unregistered",
	})
}

// ListWorkersHandler returns all registered workers
func (r *Router) ListWorkersHandler(c *gin.Context) {
	workers, err := r.registry.ListWorkers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to list workers",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"workers": workers,
		"count":   len(workers),
	})
}

// RouteToWorkerAllPaths extracts workspace ID from path, calculates partition, and routes to the appropriate worker
// This handles ALL paths by extracting workspace ID from the URL path
func (r *Router) RouteToWorkerAllPaths(c *gin.Context) {
	path := c.Request.URL.Path
	
	// Extract workspace ID from path
	// Expected patterns: /v1/workspaces/{workspaceId}/... or similar
	workspaceID := r.extractWorkspaceID(path)
	if workspaceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Workspace ID required",
			"message": "Could not extract workspace ID from path. Expected pattern: /v1/workspaces/{workspaceId}/...",
			"path":    path,
		})
		return
	}

	// Get partition count
	numPartitions, err := r.partitionCounter.GetPartitionCount()
	if err != nil {
		log.Error("Failed to get partition count", "error", err)
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Service temporarily unavailable",
			"message": "Failed to determine partition count",
		})
		return
	}

	// Calculate partition for this workspace
	partition := partitioner.PartitionForWorkspace(workspaceID, numPartitions)

	log.Debug("Routing request",
		"workspace_id", workspaceID,
		"partition", partition,
		"num_partitions", numPartitions,
		"path", path)

	// Get worker for this partition
	worker, err := r.registry.GetWorkerForPartition(partition)
	if err != nil {
		if err == registry.ErrNoWorkerForPartition || err == registry.ErrWorkerNotFound {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":        "No worker available",
				"message":      "No healthy worker is currently handling this workspace",
				"workspace_id": workspaceID,
				"partition":    partition,
			})
			return
		}
		log.Error("Failed to get worker for partition", "partition", partition, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to route request",
		})
		return
	}

	// Build target URL
	targetURL := worker.HTTPAddress
	// Ensure targetURL doesn't end with /
	targetURL = strings.TrimSuffix(targetURL, "/")
	
	log.Debug("Proxying request",
		"workspace_id", workspaceID,
		"partition", partition,
		"worker_id", worker.WorkerID,
		"target_url", targetURL,
		"full_path", path)

	// Add routing metadata to context for logging
	c.Set("workspace_id", workspaceID)
	c.Set("partition", partition)
	c.Set("worker_id", worker.WorkerID)
	c.Set("worker_address", worker.HTTPAddress)

	// Proxy the request to the worker
	r.proxy.ProxyRequest(c, targetURL)
}

// extractWorkspaceID extracts workspace ID from the URL path
// Supports patterns like: /v1/workspaces/{workspaceId}/...
func (r *Router) extractWorkspaceID(path string) string {
	// Split path into segments
	parts := strings.Split(strings.Trim(path, "/"), "/")
	
	// Look for "workspaces" followed by the workspace ID
	for i := 0; i < len(parts)-1; i++ {
		if parts[i] == "workspaces" {
			return parts[i+1]
		}
	}
	
	return ""
}

