package proxy

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/charmbracelet/log"
	"github.com/gin-gonic/gin"
)

// ReverseProxy wraps httputil.ReverseProxy with error handling
type ReverseProxy struct {
	timeout time.Duration
}

// NewReverseProxy creates a new ReverseProxy
func NewReverseProxy(timeoutSeconds time.Duration) *ReverseProxy {
	return &ReverseProxy{
		timeout: timeoutSeconds,
	}
}

// ProxyRequest forwards the request to the target worker
func (rp *ReverseProxy) ProxyRequest(c *gin.Context, targetURL string) {
	// Parse target URL
	target, err := url.Parse(targetURL)
	if err != nil {
		log.Error("Failed to parse target URL", "url", targetURL, "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Invalid worker URL",
		})
		return
	}

	// Create reverse proxy
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Configure proxy with timeout and error handling
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		// Set timeout on the request context
		ctx, cancel := c.Request.Context(), func() {}
		if rp.timeout > 0 {
			ctx, cancel = c.Request.Context(), func() {}
			// Note: Context with timeout should be managed by transport
		}
		defer cancel()
		req = req.WithContext(ctx)
		
		// Preserve original request headers
		req.Header.Set("X-Forwarded-Host", req.Host)
		req.Header.Set("X-Forwarded-Proto", "http")
		
		// Add custom header to identify router
		req.Header.Set("X-Routed-By", "workspace-engine-router")
	}

	// Custom error handler
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		log.Error("Proxy error",
			"target", targetURL,
			"path", r.URL.Path,
			"error", err)
		
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error":   "Worker unavailable",
			"message": fmt.Sprintf("Failed to connect to worker: %v", err),
		})
	}

	// Custom transport with timeout
	proxy.Transport = &http.Transport{
		ResponseHeaderTimeout: rp.timeout,
		IdleConnTimeout:       90 * time.Second,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
	}

	// Proxy the request
	proxy.ServeHTTP(c.Writer, c.Request)
}

