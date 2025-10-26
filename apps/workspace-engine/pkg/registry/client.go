package registry

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/charmbracelet/log"
)

// Client handles registration with the workspace-engine-router
type Client struct {
	routerURL  string
	workerID   string
	httpClient *http.Client
}

// NewClient creates a new registry client
func NewClient(routerURL, workerID string) *Client {
	return &Client{
		routerURL: routerURL,
		workerID:  workerID,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// RegisterRequest represents the request body for worker registration
type RegisterRequest struct {
	WorkerID    string  `json:"workerId"`
	HTTPAddress string  `json:"httpAddress"`
	Partitions  []int32 `json:"partitions"`
}

// Register registers this worker with the router
func (c *Client) Register(ctx context.Context, httpAddress string, partitions []int32) error {
	req := RegisterRequest{
		WorkerID:    c.workerID,
		HTTPAddress: httpAddress,
		Partitions:  partitions,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/register", c.routerURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send registration request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("registration failed with status %d", resp.StatusCode)
	}

	log.Info("Successfully registered with router",
		"worker_id", c.workerID,
		"http_address", httpAddress,
		"partitions", partitions)

	return nil
}

// HeartbeatRequest represents the request body for worker heartbeat
type HeartbeatRequest struct {
	WorkerID string `json:"workerId"`
}

// Heartbeat sends a heartbeat to the router
func (c *Client) Heartbeat(ctx context.Context) error {
	req := HeartbeatRequest{
		WorkerID: c.workerID,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/heartbeat", c.routerURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send heartbeat: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("heartbeat failed with status %d", resp.StatusCode)
	}

	return nil
}

// UnregisterRequest represents the request body for worker unregistration
type UnregisterRequest struct {
	WorkerID string `json:"workerId"`
}

// Unregister removes this worker from the router
func (c *Client) Unregister(ctx context.Context) error {
	req := UnregisterRequest{
		WorkerID: c.workerID,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/api/unregister", c.routerURL)
	httpReq, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return fmt.Errorf("failed to send unregister request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Warn("Unregistration failed", "status", resp.StatusCode)
		// Don't return error on unregister failure (best effort)
	}

	log.Info("Successfully unregistered from router", "worker_id", c.workerID)
	return nil
}

// StartHeartbeat starts a background goroutine that sends periodic heartbeats
func (c *Client) StartHeartbeat(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info("Stopping heartbeat", "worker_id", c.workerID)
			return
		case <-ticker.C:
			if err := c.Heartbeat(ctx); err != nil {
				log.Error("Failed to send heartbeat", "error", err, "worker_id", c.workerID)
			} else {
				log.Debug("Heartbeat sent", "worker_id", c.workerID)
			}
		}
	}
}

