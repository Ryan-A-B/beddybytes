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
API_ORIGIN=https://api.beddybytes.com
FRONTEND_AUTH_REDIRECT=https://app.beddybytes.com/auth/callback
```

`API_ORIGIN` is the backend's public HTTPS origin. The backend derives Google's
redirect URL by appending its fixed router path `/auth/google/callback`. There is
no separately configurable Google callback path.

`FRONTEND_AUTH_REDIRECT` is the full HTTPS frontend callback URL shared by all
authentication providers. It must not contain credentials, query parameters, or
a fragment. The backend uses this exact URL for the redirect and code exchange;
it does not append a provider-specific path. Leaving the Google credentials and
frontend redirect empty disables Google and hides its buttons, even if the API
origin is configured. Partial configuration
fails startup. Store local settings in the encrypted local SOPS environment.
Google does not accept `.local` callback domains; use QA or registered public
HTTPS development hosts with the configured frontend origin and API routing.

For ECS deployments, the secrets stack defines two JSON bundles:
`beddybytes-secrets-backend-qa` and `beddybytes-secrets-backend-prod`.
Their initial values are empty placeholders. Populate them manually in Secrets
Manager before deploying either backend:

```json
{
  "ENCRYPTION_KEY": "existing-signing-key-value",
  "GOOGLE_CLIENT_ID": "environment-google-client-id",
  "GOOGLE_CLIENT_SECRET": "environment-google-client-secret"
}
```

Use the exact existing signing-key value for `ENCRYPTION_KEY` during migration.
Google authentication is always configured in both environment stacks. Populate
both Google fields with the environment's own client credentials before deploying
its backend. Production needs its separate OAuth client before deployment.

ECS injects individual JSON fields as environment variables. CDK supplies the
callback/frontend URLs from the environment host names; neither Google credential
is in the plaintext task environment or frontend build. The earlier
`GOOGLE_CLIENT_ID_QA/PROD` and `GOOGLE_CLIENT_SECRET_ARN_QA/PROD` deployment inputs
are no longer used. Local Compose configuration is unchanged.

## Bundle migration order

1. Deploy only `beddybytes-secrets` to create the bundles. Leave the old
   `beddybytes-secrets-signing-key` secret intact.
2. Populate each bundle manually, preserving the existing signing key.
3. Build and publish the updated MQTT authorizer using `scripts/lambda/build.sh`
   and `scripts/lambda/push.sh`, then set `iot_authorizer_sha` in each backend
   definition to the published ZIP hash if it differs from the checked-in hash.
   The checked-in hash identifies the locally built bundle-aware ZIP, which still
   needs uploading before either backend stack is deployed.
4. Publish/select the Google-aware backend image and deploy QA. Verify login,
   existing sessions, and MQTT. Deploy production separately when its bundle and
   Google OAuth client are ready.
5. Remove the old signing-key resource and secret only after both environments
   and all consumers have migrated. Its CloudFormation export may need to remain
   during the staged migration until neither deployed backend imports it.

The MQTT authorizer fetches the bundle ARN from `SIGNING_KEY_SECRET_ARN` and
extracts `SIGNING_KEY_SECRET_JSON_FIELD=ENCRYPTION_KEY`. Without that field setting,
the updated authorizer still supports the old raw signing-key secret. ECS tasks
must restart to pick up manual secret edits. The bundles use a retain policy;
removing their CloudFormation resources does not delete their values.

## Code exchange

1. Frontend saves an S256 PKCE verifier and correlation state in per-tab session
   storage and starts `/auth/start` with `provider=google`, `intent=login` or `intent=signup`,
   `scope=account monitor`, the challenge, public client ID, and exact frontend completion URI.
   The backend accepts the supported `account` and `monitor` scopes, rejects
   unknown or missing scopes, and retains them through the transaction and code.
   These are BeddyBytes scopes; Google still receives only `openid email`.
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
6. The shared frontend `/auth/callback` handles the BeddyBytes code independently
   of the selected provider. The provider is supplied only on the initial backend
   start request, not on callback completion or the `/token` request.
7. The access token is returned in the existing JSON format. The refresh token
   is set in the existing HttpOnly cookie. The frontend loads and caches the
   current account before enabling stations and MQTT.

The access token carries the granted scopes in its existing `scp` claim. Scope
issuance does not check account, trial, or subscription expiry; access tokens
still have their normal expiration. The refresh cookie retains the granted
access scopes so subsequent token refreshes and cookie rotations preserve them.
Legacy password and refresh tokens without access scopes keep their existing
behavior. Refresh-token delivery headers, new browser token endpoints, custom
cookie grants, and Android token changes are deferred outside this project.

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
