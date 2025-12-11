package httphandler

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/ctrlplanedev/relay"
	"github.com/ctrlplanedev/relay/server/conn/ws"
	"github.com/ctrlplanedev/relay/server/hub"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// Server provides HTTP/WebSocket handlers for the relay.
// It is a thin transport layer that delegates all business logic to a Hub instance.
type Server struct {
	hub    *hub.Hub
	logger *slog.Logger
}

// NewServer creates a new HTTP server with the given hub.
func NewServer(h *hub.Hub) *Server {
	return &Server{
		hub:    h,
		logger: h.Logger(),
	}
}

// New creates a new Server with a default Hub configuration.
// This is a convenience function for simple single-node deployments.
func New(logger *slog.Logger) *Server {
	h := hub.New(hub.WithLogger(logger))
	return NewServer(h)
}

// Hub returns the underlying Hub instance.
func (s *Server) Hub() *hub.Hub {
	return s.hub
}

// -----------------------------------------------------------------------------
// HTTP Handlers
// -----------------------------------------------------------------------------

// HandleAgent handles WebSocket connections from agents.
func (s *Server) HandleAgent(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("failed to upgrade agent connection", "error", err)
		return
	}

	ctx := r.Context()

	// Read and parse registration message
	agentConn, err := s.readAgentRegistration(conn)
	if err != nil {
		s.logger.Error("agent registration failed", "error", err)
		conn.WriteMessage(websocket.TextMessage, []byte("error: "+err.Error()))
		conn.Close()
		return
	}

	// Register with hub (handles authorization)
	if err := s.hub.RegisterAgent(ctx, agentConn, map[string]string{
		"remote_addr": r.RemoteAddr,
		"hostname":    agentConn.Info().Hostname,
	}); err != nil {
		s.logger.Error("agent registration failed", "agent", agentConn.ID(), "error", err)
		conn.WriteMessage(websocket.TextMessage, []byte("error: "+err.Error()))
		conn.Close()
		return
	}

	// Run the agent message loop
	s.hub.RunAgentLoop(ctx, agentConn, func() {
		agentConn.Send(ctx, &relay.Message{Type: relay.MessageTypeHeartbeat})
	})

	// Cleanup on disconnect
	s.hub.UnregisterAgent(ctx, agentConn.ID())
}

// readAgentRegistration reads the registration message and creates an AgentConn.
func (s *Server) readAgentRegistration(conn *websocket.Conn) (relay.AgentConn, error) {
	_, data, err := conn.ReadMessage()
	if err != nil {
		return nil, err
	}

	var msg relay.Message
	if err := json.Unmarshal(data, &msg); err != nil {
		return nil, err
	}

	if msg.Type != relay.MessageTypeRegister {
		return nil, relay.NewMeshError(relay.ErrorCodeInvalidMessage, "expected register message")
	}

	var info relay.AgentInfo
	if err := json.Unmarshal(msg.Payload, &info); err != nil {
		return nil, err
	}

	info.ConnectedAt = time.Now()
	info.LastHeartbeat = time.Now()

	return ws.NewAgentConn(conn, &info), nil
}

// HandleClient handles WebSocket connections from clients.
// Clients can open multiple sessions over a single connection.
func (s *Server) HandleClient(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		s.logger.Error("failed to upgrade client connection", "error", err)
		return
	}

	ctx := r.Context()
	subject := s.extractSubject(r)
	authCtx := map[string]string{
		"remote_addr": r.RemoteAddr,
	}

	s.logger.Info("client connected", "remote", r.RemoteAddr)

	// Create client connection wrapper
	clientConn := ws.NewClientConn(conn)

	// Run the client message loop (handles multiple sessions)
	if err := s.hub.RunClientLoop(ctx, clientConn, subject, authCtx); err != nil {
		s.logger.Debug("client disconnected", "error", err)
	}
}

// extractSubject extracts the client identity from the request.
func (s *Server) extractSubject(r *http.Request) string {
	if subject := r.Header.Get("Authorization"); subject != "" {
		return subject
	}
	if subject := r.Header.Get("X-User-ID"); subject != "" {
		return subject
	}
	return r.RemoteAddr
}

// HandleListAgents handles the REST endpoint for listing agents.
func (s *Server) HandleListAgents(w http.ResponseWriter, r *http.Request) {
	agents, _ := s.hub.ListAgents(r.Context(), nil)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(agents)
}

// ListAgents is a convenience method that delegates to the hub.
func (s *Server) ListAgents() []*relay.AgentInfo {
	agents, _ := s.hub.ListAgents(context.Background(), nil)
	return agents
}
