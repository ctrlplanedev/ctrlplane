package doppler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"workspace-engine/pkg/secrets"
)

func newTestProvider(t *testing.T, srv *httptest.Server) *Provider {
	t.Helper()
	p, err := Factory(map[string]any{"serviceToken": "dp.st.test1234567890"})
	if err != nil {
		t.Fatalf("Factory: %v", err)
	}
	prov := p.(*Provider)
	prov.baseURL = srv.URL
	prov.client = srv.Client()
	prov.client.Timeout = 2 * time.Second
	return prov
}

func TestResolveHappyPath(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.URL.Path; got != "/v3/configs/config/secret" {
			t.Errorf("path %q want /v3/configs/config/secret", got)
		}
		q := r.URL.Query()
		if q.Get("project") != "backend" || q.Get("config") != "production" ||
			q.Get("name") != "ARGOCD_TOKEN" {
			t.Errorf("unexpected query %v", q)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer dp.st.test1234567890" {
			t.Errorf("auth header %q", got)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(
			[]byte(`{"value":{"computed":"resolved-token","raw":"resolved-token"}}`),
		)
	}))
	defer srv.Close()

	p := newTestProvider(t, srv)
	got, err := p.Resolve(context.Background(), secrets.SecretReference{
		Path: "backend/production",
		Key:  "ARGOCD_TOKEN",
	})
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "resolved-token" {
		t.Fatalf("got %q want resolved-token", got)
	}
}

func TestResolveNon200(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	p := newTestProvider(t, srv)
	_, err := p.Resolve(
		context.Background(),
		secrets.SecretReference{Path: "p/c", Key: "K"},
	)
	if err == nil {
		t.Fatal("expected error on 404")
	}
}

func TestResolveEmptyValue(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"value":{"computed":"","raw":""}}`))
	}))
	defer srv.Close()

	p := newTestProvider(t, srv)
	_, err := p.Resolve(
		context.Background(),
		secrets.SecretReference{Path: "p/c", Key: "K"},
	)
	if err == nil {
		t.Fatal("expected error on empty value")
	}
}

func TestResolveFallsBackToRaw(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"value":{"computed":"","raw":"raw-val"}}`))
	}))
	defer srv.Close()

	p := newTestProvider(t, srv)
	got, err := p.Resolve(
		context.Background(),
		secrets.SecretReference{Path: "p/c", Key: "K"},
	)
	if err != nil {
		t.Fatalf("Resolve: %v", err)
	}
	if got != "raw-val" {
		t.Fatalf("got %q want raw-val", got)
	}
}

func TestParsePath(t *testing.T) {
	cases := []struct {
		in   string
		ok   bool
		proj string
		cfg  string
	}{
		{"backend/production", true, "backend", "production"},
		{"a/b", true, "a", "b"},
		{"single", false, "", ""},
		{"", false, "", ""},
		{"/missing-project", false, "", ""},
		{"missing-config/", false, "", ""},
	}
	for _, c := range cases {
		t.Run(c.in, func(t *testing.T) {
			p, cfg, err := parsePath(c.in)
			if c.ok && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if !c.ok && err == nil {
				t.Fatal("expected error")
			}
			if c.ok && (p != c.proj || cfg != c.cfg) {
				t.Fatalf("got (%q,%q) want (%q,%q)", p, cfg, c.proj, c.cfg)
			}
		})
	}
}

func TestFactoryRejectsBadConfigs(t *testing.T) {
	cases := []struct {
		name string
		cfg  map[string]any
	}{
		{"missing", map[string]any{}},
		{"wrong type", map[string]any{"serviceToken": 123}},
		{"empty", map[string]any{"serviceToken": ""}},
		{"bad prefix", map[string]any{"serviceToken": "not-a-doppler-token"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if _, err := Factory(c.cfg); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
