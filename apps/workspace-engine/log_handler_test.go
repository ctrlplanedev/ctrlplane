package main

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"
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
