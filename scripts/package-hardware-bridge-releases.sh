#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-0.4.0}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/release-artifacts"
WINDOWS_BINARY="${2:-$ROOT/Backend/target/release/kudiba-hardware-bridge.exe}"
LINUX_BINARY="${3:-$ROOT/Backend/target/release/kudiba-hardware-bridge}"

mkdir -p "$OUT"
printf '%s\n' "$VERSION" > "$OUT/VERSION"

PUBLISHED=0
for entry in "windows-x64:$WINDOWS_BINARY" "linux-x64:$LINUX_BINARY"; do
  PLATFORM="${entry%%:*}"
  SOURCE="${entry#*:}"
  if [ ! -f "$SOURCE" ]; then
    continue
  fi
  TARGET="$OUT/kudiba-hardware-bridge-${PLATFORM}$([ "$PLATFORM" = "windows-x64" ] && printf '.exe')"
  cp "$SOURCE" "$TARGET"
  chmod 755 "$TARGET"
  printf '%s  %s\n' "$(sha256sum "$TARGET" | cut -d' ' -f1)" "$(basename "$TARGET")"
  PUBLISHED=$((PUBLISHED + 1))
done

if [ "$PUBLISHED" -eq 0 ]; then
  echo "Nenhum binário encontrado. Compile primeiro: make bridge-build" >&2
  exit 1
fi

echo "Artefactos publicados em: $OUT"
