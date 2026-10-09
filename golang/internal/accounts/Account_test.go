package accounts

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestLegacyPasswordUserConvertsAndWritesNewFormat(t *testing.T) {
	var user User
	if err := json.Unmarshal([]byte(`{"id":"legacy-user","email":"legacy@example.com","password_salt":"c2FsdA==","password_hash":"aGFzaA=="}`), &user); err != nil {
		t.Fatal(err)
	}
	if user.IdentityType != IdentityTypeInternal || user.ExternalIdentity != nil || !user.IsPasswordUser() {
		t.Fatal("legacy password user was not converted to an internal identity")
	}
	identity := user.InternalIdentity
	if identity.Email != "legacy@example.com" || string(identity.PasswordSalt) != "salt" || string(identity.PasswordHash) != "hash" {
		t.Fatal("legacy credentials changed during conversion")
	}
	if issuer, subject := user.IdentityPair(); issuer != "beddybytes" || subject != "legacy-user" {
		t.Fatal("legacy identity key changed")
	}
	data, err := json.Marshal(user)
	if err != nil {
		t.Fatal(err)
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	if string(fields["identity_type"]) != `"internal"` || fields["internal_identity"] == nil {
		t.Fatal("converted user was not written in the new format")
	}
	for _, field := range []string{"email", "password_salt", "password_hash", "external_identity"} {
		if _, present := fields[field]; present {
			t.Fatalf("unexpected field %s in converted user", field)
		}
	}
}

func TestIdentityJSONRoundTrip(t *testing.T) {
	for _, user := range []User{
		*NewInternalIdentityUser(&NewInternalIdentityUserInput{Email: "password@example.com", Password: "a-long-password"}),
		{ID: "external-user", IdentityType: IdentityTypeExternal, ExternalIdentity: &ExternalIdentity{
			Issuer: GoogleIssuer, Subject: "opaque/subject+01", Email: "password@example.com",
		}},
	} {
		t.Run(string(user.IdentityType), func(t *testing.T) {
			data, err := json.Marshal(user)
			if err != nil {
				t.Fatal(err)
			}
			var decoded User
			if err := json.Unmarshal(data, &decoded); err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(user, decoded) {
				t.Fatal("identity changed during JSON round trip")
			}
			if user.IdentityType == IdentityTypeExternal {
				if decoded.IsPasswordUser() {
					t.Fatal("external user gained password credentials")
				}
				if issuer, subject := decoded.IdentityPair(); issuer != GoogleIssuer || subject != "opaque/subject+01" {
					t.Fatal("external identity key changed")
				}
			}
		})
	}
}

func TestIdentityJSONRejectsInvalidDiscriminatorsAndShapes(t *testing.T) {
	for name, data := range map[string]string{
		"unknown type":           `{"id":"user","identity_type":"unknown"}`,
		"empty type":             `{"id":"user","identity_type":"","email":"old@example.com","password_salt":"c2FsdA==","password_hash":"aGFzaA=="}`,
		"null type":              `{"id":"user","identity_type":null}`,
		"missing internal":       `{"id":"user","identity_type":"internal"}`,
		"missing external":       `{"id":"user","identity_type":"external"}`,
		"wrong identity":         `{"id":"user","identity_type":"internal","external_identity":{"issuer":"google","subject":"subject"}}`,
		"both identities":        `{"id":"user","identity_type":"external","external_identity":{"issuer":"google","subject":"subject"},"internal_identity":{"email":"email","password_salt":"c2FsdA==","password_hash":"aGFzaA=="}}`,
		"missing discriminator":  `{"id":"user","external_identity":{"issuer":"google","subject":"subject"}}`,
		"incomplete credentials": `{"id":"user","identity_type":"internal","internal_identity":{"email":"email"}}`,
		"empty subject":          `{"id":"user","identity_type":"external","external_identity":{"issuer":"google"}}`,
	} {
		t.Run(name, func(t *testing.T) {
			user := *NewInternalIdentityUser(&NewInternalIdentityUserInput{Email: "unchanged@example.com", Password: "password"})
			original := user
			if err := json.Unmarshal([]byte(data), &user); err == nil {
				t.Fatal("invalid user accepted")
			}
			if !reflect.DeepEqual(user, original) {
				t.Fatal("failed decoding modified the existing user")
			}
			var wire userJSON
			if err := json.Unmarshal([]byte(data), &wire); err != nil {
				t.Fatal(err)
			}
			if _, err := json.Marshal(User(wire)); err == nil {
				t.Fatal("invalid user serialized")
			}
		})
	}
}
