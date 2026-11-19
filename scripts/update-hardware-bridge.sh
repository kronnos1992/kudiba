#!/usr/bin/env bash
set -euo pipefail

URL="${KUDIBA_BRIDGE_RELEASE_URL:-}"
EXPECTED_SHA256="${KUDIBA_BRIDGE_RELEASE_SHA256:-}"

if [ -z "$URL" ]; then
  echo "Defina KUDIBA_BRIDGE_RELEASE_URL com a URL do artefacto publicado." >&2
  exit 1
fi

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    DEST="${LOCALAPPDATA:-$HOME/AppData/Local}/Kudiba/HardwareBridge"
    TARGET="$DEST/kudiba-hardware-bridge.exe"
    ;;
  *)
    DEST="${XDG_DATA_HOME:-$HOME/.local/share}/kudiba-hardware-bridge"
    TARGET="$DEST/kudiba-hardware-bridge"
    ;;
esac

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

curl --fail --location --silent --show-error "$URL" --output "$TMP"

if [ -n "$EXPECTED_SHA256" ]; then
  ACTUAL_SHA256="$(sha256sum "$TMP" | cut -d' ' -f1)"
  if [ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]; then
    echo "Hash do artefacto não coincide; atualização abortada." >&2
    exit 1
  fi
fi

mkdir -p "$DEST"
chmod 755 "$TMP"
mv "$TMP" "$TARGET"
trap - EXIT

echo "Agente atualizado em: $TARGET"
