package main

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"
	"time"
)

func TestTeeHandlerForwardsToBoth(t *testing.T) {
	var bufA, bufB bytes.Buffer
	h := newTeeHandler(
		slog.NewTextHandler(&bufA, &slog.HandlerOptions{Level: slog.LevelDebug}),
		slog.NewTextHandler(&bufB, &slog.HandlerOptions{Level: slog.LevelDebug}),
	)
	logger := slog.New(h)
	logger.Info("hello", "key", "val")

	if !strings.Contains(bufA.String(), "hello") || !strings.Contains(bufA.String(), "key=val") {
		t.Fatalf("handler A missing record: %q", bufA.String())
	}
	if !strings.Contains(bufB.String(), "hello") || !strings.Contains(bufB.String(), "key=val") {
		t.Fatalf("handler B missing record: %q", bufB.String())
	}
}

func TestTeeHandlerEnabledIsUnion(t *testing.T) {
	infoOnly := slog.NewTextHandler(&bytes.Buffer{}, &slog.HandlerOptions{Level: slog.LevelInfo})
	debugOnly := slog.NewTextHandler(&bytes.Buffer{}, &slog.HandlerOptions{Level: slog.LevelDebug})
	h := newTeeHandler(infoOnly, debugOnly)

	if !h.Enabled(context.Background(), slog.LevelDebug) {
		t.Fatal("expected DEBUG enabled because debugOnly accepts it")
	}
	if !h.Enabled(context.Background(), slog.LevelInfo) {
		t.Fatal("expected INFO enabled")
	}
}

func TestTeeHandlerWithAttrsPropagates(t *testing.T) {
	var bufA, bufB bytes.Buffer
	h := newTeeHandler(
		slog.NewTextHandler(&bufA, nil),
		slog.NewTextHandler(&bufB, nil),
	)
	logger := slog.New(h).With("svc", "we")
	logger.Info("up")

	for name, got := range map[string]string{"A": bufA.String(), "B": bufB.String()} {
		if !strings.Contains(got, "svc=we") {
			t.Fatalf("handler %s missing With attrs: %q", name, got)
		}
	}
}

func TestTeeHandlerWithGroupPropagates(t *testing.T) {
	var bufA, bufB bytes.Buffer
	h := newTeeHandler(
		slog.NewTextHandler(&bufA, nil),
		slog.NewTextHandler(&bufB, nil),
	)
	logger := slog.New(h).WithGroup("net").With("port", 8080)
	logger.Info("up")

	for name, got := range map[string]string{"A": bufA.String(), "B": bufB.String()} {
		if !strings.Contains(got, "net.port=8080") {
			t.Fatalf("handler %s missing grouped attr: %q", name, got)
		}
	}
}

type errHandler struct {
	enabled bool
	err     error
}

func (e *errHandler) Enabled(context.Context, slog.Level) bool  { return e.enabled }
func (e *errHandler) Handle(context.Context, slog.Record) error { return e.err }
func (e *errHandler) WithAttrs([]slog.Attr) slog.Handler        { return e }
func (e *errHandler) WithGroup(string) slog.Handler             { return e }

func TestTeeHandlerJoinsErrors(t *testing.T) {
	errA := errors.New("a failed")
	errB := errors.New("b failed")
	h := newTeeHandler(
		&errHandler{enabled: true, err: errA},
		&errHandler{enabled: true, err: errB},
	)
	err := h.Handle(context.Background(), slog.NewRecord(time.Time{}, slog.LevelInfo, "msg", 0))
	if !errors.Is(err, errA) || !errors.Is(err, errB) {
		t.Fatalf("expected joined errors to wrap both errA and errB, got: %v", err)
	}
}

func TestLevelHandlerFiltersBelowThreshold(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, nil)
	h := newLevelHandler(slog.LevelWarn, inner)

	if h.Enabled(context.Background(), slog.LevelInfo) {
		t.Fatal("INFO should be disabled when threshold is WARN")
	}
	if !h.Enabled(context.Background(), slog.LevelWarn) {
		t.Fatal("WARN should be enabled at threshold WARN")
	}
	if !h.Enabled(context.Background(), slog.LevelError) {
		t.Fatal("ERROR should be enabled above threshold WARN")
	}

	logger := slog.New(h)
	logger.Info("hidden")
	logger.Warn("visible")

	got := buf.String()
	if strings.Contains(got, "hidden") {
		t.Fatalf("INFO record leaked through level filter: %q", got)
	}
	if !strings.Contains(got, "visible") {
		t.Fatalf("WARN record was dropped: %q", got)
	}
}
