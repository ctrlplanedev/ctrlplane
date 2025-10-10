package server

import (
	"fmt"
	"net/http"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"

	"workspace-engine/pkg/server/openapi"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
	swaggerfiles "github.com/swaggo/files"
	ginswagger "github.com/swaggo/gin-swagger"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("server")

// Server implements the OpenAPI ServerInterface for the workspace engine
type Server struct{}

// New creates a new Server instance
func New() *Server {
	return &Server{}
}

// SetupRouter configures and returns a Gin router with all routes and middleware
func (s *Server) SetupRouter() *gin.Engine {
	router := gin.New()
	gin.SetMode(gin.ReleaseMode)

	// Middleware
	router.Use(gin.Recovery())
	router.Use(LoggerMiddleware())
	router.Use(TracingMiddleware())
	router.Use(CORSMiddleware())

	// Health check
	router.GET("/", func(c *gin.Context) {
		c.Redirect(http.StatusFound, "/swagger/index.html")
	})
	router.GET("/openapi.yaml", func(c *gin.Context) {
		c.File("oapi/spec.yaml")
	})
	router.GET("/healthz", s.HealthCheck)
	router.GET("/swagger/*any", ginswagger.WrapHandler(swaggerfiles.Handler, ginswagger.URL("/openapi.yaml")))

	// Register OpenAPI handlers
	oapi.RegisterHandlers(router, openapi.New())

	return router
}

// HealthCheck returns the server health status
func (s *Server) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "workspace-engine",
	})
}

// ListWorkspaceIds implements the OpenAPI workspaces endpoint
// (GET /v1/workspaces)
func (s *Server) ListWorkspaceIds(c *gin.Context) {
	workspaceIds := workspace.GetAllWorkspaceIds()
	c.JSON(http.StatusOK, gin.H{
		"workspaceIds": workspaceIds,
	})
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
