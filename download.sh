#!/usr/bin/env bash
#
# Kustron downloader
#
# Downloads kustron's install.sh to the current directory so you can review it
# and run it locally:
#
#   ./download.sh        # fetches ./install.sh
#   ./install.sh         # interactive install (asks y/n before each install)
#
# Downloading to a file (instead of `curl ... | bash`) has two advantages:
#   1. you can read the script before running it, and
#   2. the y/n prompts are read from your terminal — under `curl | bash` the
#      script shares stdin with the pipe, which makes interactive prompts
#      unreliable.
#
# Usage:
#   ./download.sh            downloads to ./install.sh
#   ./download.sh kustron.sh downloads to ./kustron.sh
#
set -euo pipefail

KUSTRON_INSTALL_URL="${KUSTRON_INSTALL_URL:-https://raw.githubusercontent.com/itsmunim/kustron/master/install.sh}"
DEST="${1:-install.sh}"

c_green=$'\033[0;32m'; c_yellow=$'\033[0;33m'; c_red=$'\033[0;31m'; c_dim=$'\033[2m'; c_reset=$'\033[0m'

if ! command -v curl >/dev/null 2>&1; then
  printf '%s✖ curl is required to download the installer.%s\n' "$c_red" "$c_reset" >&2
  exit 1
fi

printf '%sDownloading kustron installer...%s\n' "$c_dim" "$c_reset"
printf '%s  %s%s\n' "$c_dim" "$KUSTRON_INSTALL_URL" "$c_reset"
curl -fsSL "$KUSTRON_INSTALL_URL" -o "$DEST"

# Sanity check: it must actually be a shell script.
if ! head -1 "$DEST" | grep -q '^#!'; then
  printf '%s✖ Downloaded file is not a script. Aborting; %s was not touched.%s\n' "$c_red" "$DEST" "$c_reset" >&2
  rm -f "$DEST"
  exit 1
fi

chmod +x "$DEST"

printf '%s✓ Downloaded %s (%s bytes)%s\n' "$c_green" "$DEST" "$(wc -c < "$DEST" | tr -d ' ')" "$c_reset"
printf '%s  sha256: %s%s\n' "$c_dim" "$(shasum -a 256 "$DEST" | awk '{print $1}')" "$c_reset"

printf '\n%sNext step:%s\n' "$c_yellow" "$c_reset"
printf '  %s./%s%s\n' "$c_green" "$DEST" "$c_reset"
printf '%s  Review the script, then run it. It will ask before installing anything.%s\n' "$c_dim" "$c_reset"