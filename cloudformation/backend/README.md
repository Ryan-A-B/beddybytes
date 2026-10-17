# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Local API DNS

`beddybytes-backend-local` contains only the `api.local.beddybytes.com` A record,
pointing to the shared core stack's Elastic IP. Traefik redirects requests to
`https://api.beddybytes.local`; the local backend runs on your machine.

With the usual CDK environment settings loaded, deploy with
`npx cdk deploy beddybytes-backend-local`. If this DNS record was created manually,
remove that record immediately before the first deployment so CloudFormation can
create and manage it. A normal deployment cannot adopt the existing record.

Run `npm run test:local` to verify the stack contains only the DNS record.

## Stripe configuration

The backend task injects `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and
`STRIPE_PERPETUAL_PRICE_ID` from matching JSON fields in its environment's
backend secrets bundle. Populate those fields before deploying the backend.
The task also sets `FRONTEND_PAYMENT_CALLBACK_URL` to the environment's app
`/payments/callback` URL. `API_ORIGIN` supplies the Stripe success/cancel origin.
The webhook endpoint is `https://<api-host>/payments/stripe/webhook`.

The backend stack references the existing bundle; it does not update its contents.
