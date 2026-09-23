#!/usr/bin/env bash
#
# Kustron installer
#
# Installs everything Kustron needs, asking before each install:
#   - container runtime (podman | OrbStack | Docker Desktop) — REQUIRED
#   - k3d                                            — REQUIRED
#   - kubectl                                        — REQUIRED
#   - railpack                                       — recommended (builds images
#                                                      when there is no Dockerfile)
#   - helm                                           — optional (helm apps only)
#   - git                                            — optional (git sources only)
#
# Then builds Kustron from source and puts a `kustron` command on your PATH.
#
# Usage:
#   ./install.sh            interactive (asks y/n before each install)
#   ./install.sh -y         accept everything, install whatever is missing
#   curl -fsSL https://raw.githubusercontent.com/itsmunim/kustron/master/install.sh | bash
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPO_URL="https://github.com/itsmunim/kustron.git"
CLONE_DIR="${KUSTRON_INSTALL_DIR:-$HOME/.kustron/kustron}"
BIN_DIR_DEFAULT="/usr/local/bin"
BIN_DIR_FALLBACK="$HOME/.local/bin"

AUTO_YES=0
if [[ "${1:-}" == "-y" || "${1:-}" == "--yes" ]]; then
  AUTO_YES=1
fi

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
c_green=$'\033[0;32m'; c_yellow=$'\033[0;33m'; c_red=$'\033[0;31m'; c_dim=$'\033[2m'; c_reset=$'\033[0m'

ok()   { printf '%s✓ %s%s\n' "$c_green" "$1" "$c_reset"; }
warn() { printf '%s! %s%s\n' "$c_yellow" "$1" "$c_reset"; }
err()  { printf '%s✖ %s%s\n' "$c_red" "$1" "$c_reset"; }
note() { printf '%s  %s%s\n' "$c_dim" "$1" "$c_reset"; }

# y/n prompt. First arg = question, second = default (y|n). Returns 0 for yes.
ask() {
  local question="$1" default="${2:-n}" answer
  if [[ "$AUTO_YES" -eq 1 ]]; then
    printf '%s✓ %s [auto-yes]%s\n' "$c_green" "$question" "$c_reset"
    return 0
  fi
  local hint
  [[ "$default" == "y" ]] && hint="Y/n" || hint="y/N"
  while true; do
    printf '%s%s (y/n) [%s]: %s' "$c_yellow" "$question" "$hint" "$c_reset"
    read -r answer
    answer="${answer:-$default}"
    case "$answer" in
      [yY]|[yY][eE][sS]) return 0 ;;
      [nN]|[nN][oO])     return 1 ;;
      *)                 printf '  Please answer y or n.\n' ;;
    esac
  done
}

# run with sudo when needed
SUDO=""
if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  fi
fi

# ---------------------------------------------------------------------------
# Platform detection
# ---------------------------------------------------------------------------
OS="$(uname -s)"
if [[ "$OS" == "Darwin" ]]; then
  PLATFORM="macos"
elif [[ "$OS" == "Linux" ]]; then
  PLATFORM="linux"
  if command -v apt-get >/dev/null 2>&1; then
    PKG_MGR="apt"
  elif command -v dnf >/dev/null 2>&1; then
    PKG_MGR="dnf"
  elif command -v pacman >/dev/null 2>&1; then
    PKG_MGR="pacman"
  elif command -v apk >/dev/null 2>&1; then
    PKG_MGR="apk"
  else
    err "Could not detect a package manager on Linux (apt/dnf/pacman/apk)."
    err "Install: podman or docker, k3d, kubectl manually, then re-run this script."
    exit 1
  fi
else
  err "Unsupported OS: $OS (only macOS and Linux are supported)."
  exit 1
fi

# ---------------------------------------------------------------------------
# Requirement: node/npm (needed to build + run kustron)
# ---------------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  err "Node.js >= 18 is required to build and run kustron, but 'node' was not found."
  if [[ "$PLATFORM" == "macos" ]]; then
    note "Install with:  brew install node"
  else
    note "Install with:  $SUDO $([[ "$PKG_MGR" == "apt" ]] && echo 'apt-get install -y nodejs npm' || echo 'your package manager')"
  fi
  note "Or use nvm:      https://github.com/nvm-sh/nvm"
  exit 1
fi
NODE_MAJOR="$(node -e 'console.log(Number(process.versions.node.split(".")[0]))')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  err "Node.js >= 18 is required; found $(node -v). Upgrade Node and re-run."
  exit 1
fi
ok "node $(node -v)"

# ---------------------------------------------------------------------------
# Helpers per platform
# ---------------------------------------------------------------------------
have() { command -v "$1" >/dev/null 2>&1; }

pkg_install() {
  # $1 = package name(s) for the distro package manager
  case "$PKG_MGR" in
    apt)   $SUDO apt-get install -y "$@";;
    dnf)   $SUDO dnf install -y "$@";;
    pacman) $SUDO pacman -S --noconfirm "$@";;
    apk)   $SUDO apk add --no-cache "$@";;
  esac
}

install_podman() {
  case "$PLATFORM" in
    macos)
      brew install podman
      # k3d needs a rootful machine; init once, then ensure it's running.
      if ! podman machine list >/dev/null 2>&1 || [[ -z "$(podman machine list --format '{{.Name}}' 2>/dev/null)" ]]; then
        note "Initializing podman machine (rootful) — first start can take a few minutes..."
        podman machine init --rootful
      fi
      podman machine start || true
      ;;
    linux)
      case "$PKG_MGR" in
        apt)   pkg_install podman ;;
        dnf)   pkg_install podman ;;
        pacman) pkg_install podman ;;
        apk)   pkg_install podman ;;
      esac
      ;;
  esac
}

install_docker() {
  case "$PLATFORM" in
    macos)
      brew install --cask docker
      warn "Docker Desktop installed — open it once and accept the license, then re-run kustron."
      ;;
    linux)
      case "$PKG_MGR" in
        apt)   pkg_install docker.io ;;
        dnf)   pkg_install docker ;;
        pacman) pkg_install docker ;;
        apk)   pkg_install docker ;;
      esac
      $SUDO systemctl enable --now docker 2>/dev/null || true
      ;;
  esac
}

install_orbstack() {
  if [[ "$PLATFORM" != "macos" ]]; then
    warn "OrbStack is macOS-only. Falling back to Docker Desktop as the second choice."
    install_docker
    return
  fi
  brew install --cask orbstack
  warn "Open OrbStack once to finish setup, then re-run kustron."
}

install_k3d() {
  case "$PLATFORM" in
    macos) brew install k3d ;;
    linux)
      if ! have curl; then pkg_install curl; fi
      curl -sS https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash
      ;;
  esac
}

install_kubectl() {
  case "$PLATFORM" in
    macos) brew install kubectl ;;
    linux)
      if ! have curl; then pkg_install curl; fi
      local ver
      ver="$(curl -L -s https://dl.k8s.io/release/stable.txt)"
      curl -LO "https://dl.k8s.io/release/${ver}/bin/linux/$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')/kubectl"
      chmod +x kubectl
      $SUDO mv kubectl /usr/local/bin/kubectl
      ;;
  esac
}

install_helm() {
  case "$PLATFORM" in
    macos) brew install helm ;;
    linux)
      if ! have curl; then pkg_install curl; fi
      curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
      ;;
  esac
}

install_railpack() {
  # railpack publishes a CLI on npm: https://www.npmjs.com/package/railpack
  npm install -g railpack
}

install_git() {
  case "$PLATFORM" in
    macos) brew install git ;;
    linux) pkg_install git ;;
  esac
}

# ---------------------------------------------------------------------------
# Runtime detection (docker CLI context includes Docker Desktop / OrbStack /
# podman-docker shim), podman, and the OrbStack CLI.
# ---------------------------------------------------------------------------
runtime_present() {
  have docker || have podman
}

docker_daemon_up() {
  docker info >/dev/null 2>&1
}
podman_daemon_up() {
  podman info >/dev/null 2>&1
}

# ---------------------------------------------------------------------------
# 1. Container runtime (REQUIRED)
# ---------------------------------------------------------------------------
printf '\n=== Container runtime ===\n'
if runtime_present && (docker_daemon_up || podman_daemon_up); then
  if docker_daemon_up; then
    ok "container runtime: docker (daemon reachable)"
  else
    ok "container runtime: podman (daemon reachable)"
  fi
  note "Kustron will use the reachable daemon for the k3d cluster and image builds."
else
  warn "No container runtime found — k3d (and therefore kustron) cannot run without one."
  if ask "Install podman? (either podman or Docker Desktop or OrbStack must be present)" "y"; then
    install_podman
    if ! podman_daemon_up; then
      warn "podman installed but the daemon is not responding. Start it (e.g. 'podman machine start') and re-run this script."
    else
      ok "podman daemon is running"
    fi
  elif ask "Install OrbStack? (recommended on macOS — fast and light)" "n"; then
    install_orbstack
  elif ask "Install Docker Desktop? (heavier, but works everywhere)" "n"; then
    install_docker
  else
    err "Kustron requires a container runtime (podman, OrbStack, or Docker Desktop)."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2. k3d (REQUIRED)
# ---------------------------------------------------------------------------
printf '\n=== k3d ===\n'
if have k3d; then
  ok "k3d $(k3d version | head -1)"
else
  if ask "Install k3d? (if not installed, kustron will not work)" "y"; then
    install_k3d
  else
    err "k3d is required for kustron to create the local Kubernetes cluster."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 3. kubectl (REQUIRED)
# ---------------------------------------------------------------------------
printf '\n=== kubectl ===\n'
if have kubectl; then
  ok "kubectl $(kubectl version --client 2>/dev/null | sed 's/Client Version: //' | head -1)"
else
  if ask "Install kubectl? (kustron uses it to apply and manage deployments)" "y"; then
    install_kubectl
  else
    err "kubectl is required by kustron."
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 4. railpack (recommended)
# ---------------------------------------------------------------------------
printf '\n=== railpack ===\n'
if have railpack; then
  ok "railpack"
elif ask "Install railpack? (railpack helps to create container images from source code without providing any Dockerfile)" "y"; then
  install_railpack
else
  warn "Skipping railpack — apps with a Dockerfile will still build fine."
fi

# ---------------------------------------------------------------------------
# 5. helm (optional)
# ---------------------------------------------------------------------------
printf '\n=== helm ===\n'
if have helm; then
  ok "helm"
elif ask "Install helm? (only needed if you want to deploy Helm charts)" "n"; then
  install_helm
fi

# ---------------------------------------------------------------------------
# 6. git (recommended)
# ---------------------------------------------------------------------------
printf '\n=== git ===\n'
if have git; then
  ok "git $(git --version | sed 's/git version //')"
elif ask "Install git? (only needed for apps that install from a git URL)" "n"; then
  install_git
fi

# ---------------------------------------------------------------------------
# 7. Build + install kustron itself
# ---------------------------------------------------------------------------
printf '\n=== Installing kustron ===\n'

if [[ -f package.json ]] && [[ -d src ]]; then
  SRC_DIR="$(pwd)"
  note "Using the current checkout: $SRC_DIR"
elif [[ -f "$CLONE_DIR/package.json" ]]; then
  SRC_DIR="$CLONE_DIR"
  note "Found existing source at: $SRC_DIR — updating..."
  (cd "$SRC_DIR" && git pull --ff-only) || warn "git pull failed; building whatever is checked out"
else
  note "Cloning kustron to $CLONE_DIR ..."
  mkdir -p "$CLONE_DIR"
  if have git; then
    git clone --depth 1 "$REPO_URL" "$CLONE_DIR"
  else
    err "git is needed to download kustron. Install git and re-run."
    exit 1
  fi
  SRC_DIR="$CLONE_DIR"
fi

(cd "$SRC_DIR" && npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund)
(cd "$SRC_DIR" && npm run build)

LAUNCHER="$SRC_DIR/dist/bin/kustron.js"
chmod +x "$LAUNCHER"

# Pick the bin dir + make sure it is on PATH
BIN_DIR="$BIN_DIR_FALLBACK"
if [[ -w "$BIN_DIR_DEFAULT" ]] || [[ "$(id -u)" -eq 0 ]]; then
  BIN_DIR="$BIN_DIR_DEFAULT"
else
  mkdir -p "$BIN_DIR_FALLBACK"
  note "No write access to $BIN_DIR_DEFAULT — installing to $BIN_DIR_FALLBACK"
fi

ln -sf "$LAUNCHER" "$BIN_DIR/kustron"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
printf '\n'
ok "kustron installation complete!"
note "Command:   $BIN_DIR/kustron"
if [[ "$BIN_DIR" == "$BIN_DIR_FALLBACK" ]] && [[ ":$PATH:" != *":$BIN_DIR_FALLBACK:"* ]]; then
  warn "$BIN_DIR_FALLBACK is not on your PATH — add it with:  export PATH=\"$BIN_DIR_FALLBACK:\$PATH\""
fi
printf '\n%sNext steps:%s\n' "$c_dim" "$c_reset"
note "  1. cd into your project"
note "  2. kustron env init   (creates kustron-env.yaml)"
note "  3. kustron env up     (builds and deploys your apps)"
printf '\n'