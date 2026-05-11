package secrets

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
)

type stubProvider struct{ name string }

func (s *stubProvider) Type() string { return s.name }

func (s *stubProvider) Resolve(_ context.Context, _ SecretReference) (string, error) {
	return "", errors.New("not implemented")
}

func TestRegistryBuildAndTypes(t *testing.T) {
	r := NewRegistry()
	r.Register("doppler", func(_ json.RawMessage) (Provider, error) {
		return &stubProvider{name: "doppler"}, nil
	})
	r.Register("aws_secrets_manager", func(_ json.RawMessage) (Provider, error) {
		return &stubProvider{name: "aws_secrets_manager"}, nil
	})

	types := r.Types()
	if len(types) != 2 {
		t.Fatalf("expected 2 registered types, got %d (%v)", len(types), types)
	}

	p, err := r.Build(&ProviderConfig{Type: "doppler", Config: json.RawMessage(`{}`)})
	if err != nil {
		t.Fatalf("Build doppler: %v", err)
	}
	if p.Type() != "doppler" {
		t.Fatalf("got type %q, want doppler", p.Type())
	}
}

func TestRegistryUnknownTypeFails(t *testing.T) {
	r := NewRegistry()
	_, err := r.Build(&ProviderConfig{Type: "vault", Config: json.RawMessage(`{}`)})
	if err == nil {
		t.Fatal("expected error for unregistered type")
	}
}

func TestRegistryFactoryErrorPropagates(t *testing.T) {
	r := NewRegistry()
	wantErr := errors.New("bad config")
	r.Register("doppler", func(_ json.RawMessage) (Provider, error) {
		return nil, wantErr
	})
	_, err := r.Build(&ProviderConfig{Type: "doppler", Config: json.RawMessage(`{}`)})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected wrapped wantErr, got %v", err)
	}
}
