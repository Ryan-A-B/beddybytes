# Encrypted configuration

This directory contains SOPS-encrypted runtime configuration.

Only files matching `*.sops.env` may be committed here. Create
`local.sops.env` from the repository's `.env.example` by following the SOPS
instructions in the root `README.md`.

Never commit an age identity or a decrypted environment file.
