# Local Stripe webhook listener

The `stripe-cli` Compose service forwards thin sandbox Checkout notifications to
`http://api:9000/payments/stripe/webhook` over the internal Docker network.
It needs no published port, public webhook endpoint or TLS bypass. Browser
success/cancel redirects still use `https://api.local.beddybytes.com`.

The service is opt-in through the `payments` Compose profile. Its named
`stripe_cli_config` volume mounts `/root/.config/stripe`, retaining the CLI
configuration and credentials across container replacements. Its hostname is
fixed so the CLI's default device name remains stable.

Run these commands from the repository root. They use the existing encrypted
local configuration; substitute your `BEDDYBYTES_SOPS_ENV_FILE` if overridden.

## First-time login

```sh
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose run --rm --no-deps stripe-cli login'
```

Open the URL printed by the CLI, approve access, and select the same sandbox
that contains your BeddyBytes price. No browser needs to run inside Docker.
If Stripe asks you to enable CLI access, enable it for that sandbox under
Settings → Team and security → MCP and CLI access.

Check or change the selected sandbox using the same persistent volume:

```sh
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose run --rm --no-deps stripe-cli login list'
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose run --rm --no-deps stripe-cli switch'
```

The API continues to use its own restricted sandbox key from
`STRIPE_SECRET_KEY`. CLI login is separate; that key is not passed to the
listener container.

## Start listening

For the complete local stack, including the listener:

```sh
COMPOSE_PROFILES=payments ./run_local_stack.sh
```

If the stack is already running:

```sh
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose --profile payments up -d --no-deps stripe-cli'
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose logs -f stripe-cli'
```

The listener prints a signing secret beginning `whsec_`. Put that value in
`STRIPE_WEBHOOK_SECRET` using the SOPS editor:

```sh
sops "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}"
```

Recreate the API to load the new value. A restart alone does not reload its
environment:

```sh
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose up -d --no-deps --force-recreate api'
```

Use the listener's signing secret, not a Dashboard webhook destination's
secret. The listener secret remains stable across listener restarts. If you
change the CLI account/sandbox, check the printed secret again and update the
API configuration to match.

Only these thin notifications from your own Stripe account are forwarded
(`--events-from=@self`):

- `v1.checkout.session.completed`
- `v1.checkout.session.expired`
- `v1.checkout.session.async_payment_succeeded`
- `v1.checkout.session.async_payment_failed`

For a QA webhook destination, choose **Thin** and subscribe to the same four
`v1.checkout.session.*` notifications at `/payments/stripe/webhook`. Set
`STRIPE_WEBHOOK_SECRET` to that destination's signing secret. Snapshot destinations
are no longer accepted by this handler. The backend retrieves the current Checkout
Session with its PaymentIntent expanded before applying a license change.

After updating from the snapshot listener, recreate `stripe-cli` and check its
printed signing secret before recreating the API. This change does not update a
Dashboard destination automatically.

Complete a sandbox checkout through the app to test account-bound fulfillment.
Standalone `stripe trigger` fixtures don't contain one of our actual account
IDs and cannot demonstrate a license upgrade.

## Persistent credentials

The volume survives ordinary container removal and the local stack script's
cleanup. `docker compose down --volumes` explicitly deletes named volumes,
including this login. Reauthenticate when the CLI asks you to.

To sign out without deleting other volumes:

```sh
sops exec-env "${BEDDYBYTES_SOPS_ENV_FILE:-config/local.sops.env}" \
  'docker compose run --rm --no-deps stripe-cli logout'
```

References: [Stripe CLI Docker image](https://github.com/stripe/stripe-cli#docker),
[login](https://docs.stripe.com/cli/login),
[listener and signing secret](https://docs.stripe.com/cli/listen).
