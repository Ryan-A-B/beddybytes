package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
)

func TestMonitoringRoutesRequireMonitorScope(t *testing.T) {
	key := []byte("test-key")
	handlers := &Handlers{Key: key}
	router := mux.NewRouter()
	handlers.AddRoutes(router)
	// Retain the actual route registration and middleware, replacing terminal
	// handlers so allowed requests do not need real stores or live streams.
	err := router.Walk(func(route *mux.Route, _ *mux.Router, _ []*mux.Route) error {
		if route.GetName() != "" {
			route.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
				responseWriter.WriteHeader(http.StatusNoContent)
			})
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, endpoint := range []struct{ method, path string }{
		{"GET", "/clients"}, {"GET", "/clients/client-1/websocket"},
		{"GET", "/clients/client-1/connections/connection-1"},
		{"GET", "/sessions"}, {"PUT", "/sessions/session-1"}, {"DELETE", "/sessions/session-1"},
		{"GET", "/events"}, {"GET", "/baby_station_list_snapshot"},
	} {
		for _, test := range []struct {
			name, scope, tokenUse string
			want                  int
		}{
			{"account only", "account", internal.TokenUseAccess, 403},
			{"missing scope", "", internal.TokenUseAccess, 403},
			{"scope prefix", "account monitoring", internal.TokenUseAccess, 403},
			{"monitor", "account monitor", internal.TokenUseAccess, 204},
			{"scope order", "monitor account", internal.TokenUseAccess, 204},
			{"refresh", "account monitor", internal.TokenUseRefresh, 401},
			{"no token", "", "", 401},
		} {
			t.Run(endpoint.method+endpoint.path+"/"+test.name, func(t *testing.T) {
				request := httptest.NewRequest(endpoint.method, endpoint.path, nil)
				if test.tokenUse != "" {
					claims := internal.Claims{Issuer: "beddybytes", Audience: "beddybytes", Subject: internal.URN{Service: "iam", AccountID: "account", ResourceType: "user", ResourceID: "user"}, Scope: test.scope, TokenUse: test.tokenUse, Expiry: time.Now().Add(time.Hour).Unix()}
					token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims).SignedString(key)
					if err != nil {
						t.Fatal(err)
					}
					request.Header.Set("Authorization", "Bearer "+token)
				}
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				if response.Code != test.want {
					t.Fatalf("status=%d body=%s, want %d", response.Code, response.Body.String(), test.want)
				}
				if test.want == 403 {
					var output httpx.ErrorFrame
					if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
						t.Fatal(err)
					}
					if output.Code != "insufficient_scope" {
						t.Fatalf("code=%q", output.Code)
					}
				}
			})
		}
	}
}
