# Google browser authentication

Google is an independent account creation and sign-in method alongside the
existing email/password method. It requests the `openid` and `email` scopes. Google email is stored as account data. Account lookup and uniqueness use only the verified issuer and opaque subject; email does not affect identity or uniqueness.

- **Sign in with Google** requires an existing `(issuer, subject)` identity. It
  never creates an account.
- **Create account with Google** creates a new identity. An existing Google
  identity returns “already registered” and offers explicit sign-in.
- Google and password accounts can share an email. Their stations and purchases
  remain independent. There is no email-based linking or password reset for a
  Google-only account.

## Configure Google

In the existing Google Cloud project, configure Google Auth Platform branding,
audience (external users for public BeddyBytes), and a **Web application OAuth
client**. OAuth client registration is also required for authentication through
OpenID Connect. Add test users while the Google application is in testing mode.
The requested scopes are `openid` and `email`; no name or picture is requested.

Register the backend callback for each environment that will use that client:

```text
https://api.beddybytes.com/auth/google/callback
https://api.qa.beddybytes.com/auth/google/callback
```

Verify host names against the deployment configuration. The frontend completion
URL is registered with BeddyBytes, not with Google. Google's client secret stays
on the backend. The browser's BeddyBytes client ID is `beddybytes-browser` and is
public.

Backend runtime settings:

```text
GOOGLE_CLIENT_ID=<Google web client ID>
GOOGLE_CLIENT_SECRET=<Google web client secret>
GOOGLE_CALLBACK_URL=https://api.beddybytes.com/auth/google/callback
GOOGLE_FRONTEND_URL=https://app.beddybytes.com
```

`GOOGLE_FRONTEND_URL` must be an HTTPS origin. BeddyBytes derives the only allowed
frontend return URL as `/auth/google/complete` on that origin. Leaving all four
settings empty disables Google and hides its buttons. Partial configuration
fails startup. Store local settings in the encrypted local SOPS environment.
Google does not accept `.local` callback domains; use QA or registered public
HTTPS development hosts with the configured frontend origin and API routing.

For ECS deployments, create an AWS Secrets Manager secret whose entire secret
string is the Google client secret. Add these optional entries to the encrypted
backend deployment environment, independently per environment:

```text
GOOGLE_CLIENT_ID_QA=<Google web client ID>
GOOGLE_CLIENT_SECRET_ARN_QA=<complete Secrets Manager ARN>
GOOGLE_CLIENT_ID_PROD=<Google web client ID>
GOOGLE_CLIENT_SECRET_ARN_PROD=<complete Secrets Manager ARN>
```

CDK supplies the callback/frontend URLs from its environment host names and
injects the secret through ECS Secrets Manager integration. It does not put the
client secret in a plaintext task environment or frontend build. Existing
deployments without these optional entries keep password authentication.

## Code exchange

1. Frontend saves an S256 PKCE verifier and correlation state in per-tab session
   storage and starts `/auth/google/start` with `intent=login` or `intent=signup`,
   the challenge, public client ID, and exact frontend completion URI.
2. Backend saves that intent, uses separate upstream state/nonce/PKCE values,
   and binds the Google callback to a host-only HttpOnly/Secure/Lax cookie.
3. Backend exchanges Google's code, verifies its signed ID token, issuer,
   audience, expiry and nonce, and requires a nonempty subject plus a verified email. Email is stored as account data and is not used for identity lookup or uniqueness.
4. After resolving the explicit signup/login intent, backend redirects with a
   fresh opaque BeddyBytes code and the original frontend state. Codes expire
   after 60 seconds and are redeemed once with atomic consumption. Transaction
   state expires after ten minutes.
5. Frontend validates state, clears the code from the URL, and posts
   `grant_type=authorization_code`, `code`, `code_verifier`, `client_id`, and
   `redirect_uri` to `/token` with credentials included. The backend requires
   the registered frontend Origin and exact client/redirect match.
6. The access token is returned in the existing JSON format. The refresh token
   is set in the existing HttpOnly cookie. The frontend loads and caches the
   current account before enabling stations and MQTT.

The frontend deduplicates completion under React StrictMode. Completion failures
require starting a new sign-in; a consumed code is not retried. Callback URLs
contain codes, never ID/access/refresh tokens. Referrer policy prevents callback
query strings reaching other resources. Do not log callback query strings or
token request bodies at a proxy.

## Persistence and deployment boundary

Account events persist provider issuer/subject and reconstruct both account and
identity indexes. Legacy password events remain readable with their original
account/user IDs and password email index. Event append and in-process identity
creation are serialized; concurrent Google signup creates only one account.
Account deletion is recorded as an `account.deleted` event so replay does not
restore deleted identities. Account replay completes before accepting requests.
Live account creation, password reset and deletion append their event and update
account state synchronously under the account lock. They are not replayed a
second time by an asynchronous live account projector.

Pending Google transactions and authorization codes are process-local. This
matches the current backend's single ECS replica and local event-log projection.
Restarting or redeploying invalidates pending sign-ins safely; the user must
restart authentication. Scaling to multiple replicas requires a shared atomic
transaction/code store and a shared account-creation constraint before enabling
this flow across replicas. No code-store data or upstream Google tokens are
written into the account event log.

Once Google accounts have been created, rollback must use a backend version that
understands provider identities and deletion events. Older versions index every
account by email and cannot safely replay same-email Google/password accounts.
To disable Google while retaining data compatibility, leave its four runtime
settings empty on this implementation rather than restoring the older backend.

## Release checks

Run backend tests (including race checks for accounts) and frontend tests/build.
Before enabling production, validate with the registered Google client in QA:
new signup, repeat login, unknown-account login, existing-account signup,
cancellation, reload/replay, same-email password and Google accounts, restored
session, and monitoring/MQTT startup after callback. No Google client credentials
are included in this change, so live Google authentication needs that setup.
