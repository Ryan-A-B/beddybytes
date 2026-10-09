package accounts

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

const GoogleIssuer = "https://accounts.google.com"

type GoogleIdentity struct {
	Issuer, Subject, Email string
}

type GoogleIdentityProvider interface {
	AuthorizationURL(state, nonce, verifier string) string
	Exchange(context.Context, string, string, string) (*GoogleIdentity, error)
}

type googleOIDCProvider struct {
	config   oauth2.Config
	verifier *oidc.IDTokenVerifier
	client   *http.Client
}

func NewGoogleIdentityProvider(clientID, clientSecret, callbackURL string) GoogleIdentityProvider {
	client := &http.Client{Timeout: 15 * time.Second}
	ctx := oidc.ClientContext(context.Background(), client)
	return &googleOIDCProvider{
		config: oauth2.Config{
			ClientID: clientID, ClientSecret: clientSecret, RedirectURL: callbackURL,
			Scopes: []string{oidc.ScopeOpenID, "email"},
			Endpoint: oauth2.Endpoint{
				AuthURL:   "https://accounts.google.com/o/oauth2/v2/auth",
				TokenURL:  "https://oauth2.googleapis.com/token",
				AuthStyle: oauth2.AuthStyleInParams,
			},
		},
		verifier: oidc.NewVerifier(GoogleIssuer, oidc.NewRemoteKeySet(ctx, "https://www.googleapis.com/oauth2/v3/certs"), &oidc.Config{
			ClientID: clientID, SupportedSigningAlgs: []string{oidc.RS256},
		}),
		client: client,
	}
}

func (provider *googleOIDCProvider) AuthorizationURL(state, nonce, verifier string) string {
	return provider.config.AuthCodeURL(state, oidc.Nonce(nonce), oauth2.S256ChallengeOption(verifier))
}

func (provider *googleOIDCProvider) Exchange(ctx context.Context, code, nonce, verifier string) (*GoogleIdentity, error) {
	ctx = oidc.ClientContext(ctx, provider.client)
	token, err := provider.config.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return nil, err
	}
	raw, ok := token.Extra("id_token").(string)
	if !ok {
		return nil, errors.New("Google response has no ID token")
	}
	idToken, err := provider.verifier.Verify(ctx, raw)
	if err != nil {
		return nil, err
	}
	if idToken.Nonce != nonce || idToken.Subject == "" {
		return nil, errors.New("invalid Google nonce or subject")
	}
	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, err
	}
	if claims.Email == "" || !claims.EmailVerified {
		return nil, errors.New("Google has not supplied a verified email")
	}
	// Google's equivalent issuer spellings must not create separate identities.
	return &GoogleIdentity{
		Issuer:  GoogleIssuer,
		Subject: idToken.Subject,
		Email:   claims.Email,
	}, nil
}
