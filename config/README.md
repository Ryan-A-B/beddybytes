# Encrypted configuration

This directory contains SOPS-encrypted runtime configuration.

Only files matching `*.sops.env` may be committed here. Create
`local.sops.env` from the repository's `.env.example` by following the SOPS
instructions in the root `README.md`.

The marketing build and deployment use a separate `marketing.sops.env` file.
Create it from `marketing.env.example`, encrypt it before committing, and run
the scripts through `scripts/marketing/build.sh` and
`scripts/marketing/push.sh`. Set `BEDDYBYTES_MARKETING_SOPS_ENV_FILE` to use a
different encrypted file.

The backend CloudFormation shell reads `backend.sops.env` through SOPS. Run
`cloudformation/backend/node.sh` to expose the decrypted dotenv through a
one-read FIFO and pass every value into the Node container with Docker's
`--env-file`. No plaintext `.env` file is written, and new encrypted variables
do not need corresponding script changes. Set `BEDDYBYTES_BACKEND_SOPS_ENV_FILE`
to use a different encrypted file.

Never commit an age identity or a decrypted environment file.
