#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$repo_root"

tls_certificate="traefik/certificates/beddybytes.local.crt"
tls_private_key="traefik/certificates/beddybytes.local.key"

require_command() {
    local dependency="$1"

    if ! command -v "$dependency" >/dev/null 2>&1; then
        echo "$dependency is required to set up the local stack." >&2
        exit 1
    fi
}

local_tls_is_ready() {
    [[ -s "$tls_certificate" && -s "$tls_private_key" ]] || return 1
    openssl x509 -in "$tls_certificate" -noout -checkend 0 >/dev/null 2>&1 || return 1
    openssl pkey -in "$tls_private_key" -noout -check >/dev/null 2>&1 || return 1

    cmp -s \
        <(openssl x509 -in "$tls_certificate" -pubkey -noout 2>/dev/null | openssl pkey -pubin -outform DER 2>/dev/null) \
        <(openssl pkey -in "$tls_private_key" -pubout -outform DER 2>/dev/null)
}

setup_local_tls() {
    require_command openssl
    require_command cmp

    if local_tls_is_ready; then
        echo "Local TLS certificate is already set up."
        return
    fi

    require_command mkcert
    require_command make

    echo "Setting up the local certificate authority and TLS certificate..."
    mkcert -install
    make -C traefik/certificates clean
    make -C traefik/certificates

    if ! local_tls_is_ready; then
        echo "Local TLS setup did not produce a valid matching certificate and private key." >&2
        exit 1
    fi
}

setup_local_tls
