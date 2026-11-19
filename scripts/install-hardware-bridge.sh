#!/usr/bin/env bash
set -euo pipefail

BINARY="${1:-}"
if [ -z "$BINARY" ]; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) BINARY="target/release/kudiba-hardware-bridge.exe" ;;
    *) BINARY="target/release/kudiba-hardware-bridge" ;;
  esac
fi

if [ ! -f "$BINARY" ]; then
  echo "Binário não encontrado: $BINARY" >&2
  echo "Compile primeiro: make bridge-build" >&2
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

mkdir -p "$DEST"
cp "$BINARY" "$TARGET"
chmod 755 "$TARGET"

cat > "$DEST/bridge.env.example" <<EOF
KUDIBA_BRIDGE_PORT=17842
KUDIBA_PRINTER_CONNECTION=RAW_TCP:127.0.0.1:9100
KUDIBA_PRINTER_MODEL=POS-80
KUDIBA_ESC_POS_CODE_PAGE=CP850
KUDIBA_BRIDGE_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
KUDIBA_CLOUD_API_URL=https://api.kudiba.ao
EOF

echo "Agente instalado em: $TARGET"
echo "Configure as variáveis a partir de: $DEST/bridge.env.example"
echo "Para Windows, registe a execução ao login com: schtasks /Create /SC ONLOGON /TN KudibaHardwareBridge /TR \"$TARGET\" /F"
echo "Para TLS, gere certificado loopback e defina KUDIBA_BRIDGE_TLS_CERT e KUDIBA_BRIDGE_TLS_KEY."
