#!/usr/bin/env bash
# Ghostcut — one-shot: push to GitHub + deploy to Fly.io
# Run from Terminal on your Mac:   bash scripts/deploy-fly.sh
# Safe to re-run: every step checks what already exists.
set -euo pipefail

REPO_URL="https://github.com/gentle-gently-gentlish/ghostclip.git"
REGION="den"
VOLUME="ghostcut_data"

cd "$(dirname "$0")/.."
# Keep a copy of everything this script prints in deploy.log (for troubleshooting)
exec > >(tee -a deploy.log) 2>&1
echo "----- $(date) -----"
say() { printf "\n\033[1;32m==> %s\033[0m\n" "$*"; }
warn() { printf "\n\033[1;33m!!  %s\033[0m\n" "$*"; }

# ---------------------------------------------------------------- 1. GitHub
say "1/5  Saving code to GitHub ($REPO_URL)"
if [ ! -d .git ]; then
  git init -q
  git checkout -q -b main
fi
git remote get-url origin >/dev/null 2>&1 || git remote add origin "$REPO_URL"
if ! git rev-parse -q --verify HEAD >/dev/null; then
  # Build on top of the repo's existing "Initial commit" instead of overwriting it
  if git fetch -q origin main 2>/dev/null; then git reset -q --soft origin/main; fi
fi
git config user.name >/dev/null || git config user.name "Jacque"
git config user.email >/dev/null || git config user.email "calebxjacquecloud@gmail.com"
git add -A
git commit -q -m "Ghostcut app: studio, OAuth publishing, Fly deploy" 2>/dev/null || echo "   (nothing new to commit)"
if git push -u origin main; then
  echo "   Pushed."
else
  warn "GitHub push failed (usually a login issue). Deploy will continue — Fly builds from this folder.
    Fix later with:  brew install gh && gh auth login && git push -u origin main"
fi

# ---------------------------------------------------------------- 2. flyctl
say "2/5  Fly CLI"
export PATH="$HOME/.fly/bin:$PATH"
if ! command -v fly >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then brew install flyctl; else curl -L https://fly.io/install.sh | sh; fi
fi
fly auth whoami >/dev/null 2>&1 || fly auth login
echo "   Logged in as: $(fly auth whoami)"

# ---------------------------------------------------------------- 3. App
APP="$(sed -n 's/^app = "\(.*\)"/\1/p' fly.toml)"
say "3/5  Fly app: $APP"
if ! fly status -a "$APP" >/dev/null 2>&1; then
  until fly apps create "$APP"; do
    warn "The name '$APP' is taken. Pick another (letters, numbers, dashes), e.g. ghostcut-jacque"
    read -r -p "   App name: " APP
  done
  sed -i '' "s/^app = \".*\"/app = \"$APP\"/" fly.toml
fi
URL="https://$APP.fly.dev"

# ---------------------------------------------------------------- 4. Volume + secrets
say "4/5  Storage + settings"
if fly volumes list -a "$APP" 2>/dev/null | grep -q "$VOLUME"; then
  echo "   Volume $VOLUME exists."
else
  fly volumes create "$VOLUME" --region "$REGION" --size 3 -a "$APP" --yes
fi

if fly secrets list -a "$APP" 2>/dev/null | grep -q GHOSTCUT_PASSWORD; then
  echo "   Password already set (change with: fly secrets set GHOSTCUT_PASSWORD=... -a $APP)"
  fly secrets set --stage -a "$APP" GHOSTCUT_APP_URL="$URL" GHOSTCUT_PUBLIC_MEDIA_BASE="$URL" >/dev/null
else
  echo "   Choose a password for the app's login screen (username can be anything)."
  while :; do
    read -r -s -p "   Password: " PW; echo
    [ ${#PW} -ge 8 ] && break
    echo "   Use at least 8 characters."
  done
  fly secrets set --stage -a "$APP" GHOSTCUT_APP_URL="$URL" GHOSTCUT_PUBLIC_MEDIA_BASE="$URL" GHOSTCUT_PASSWORD="$PW" >/dev/null
fi

# ---------------------------------------------------------------- 5. Deploy
say "5/5  Building + deploying (first build takes ~5 min)"
fly deploy -a "$APP" --ha=false

say "Done →  $URL"
echo "   Open it, log in with your password, and start Profile → Engine → Connect."
echo "   OAuth redirect URIs to paste into Google Cloud / Meta:"
echo "     $URL/api/oauth/youtube/callback"
echo "     $URL/api/oauth/instagram/callback"
git diff --quiet fly.toml 2>/dev/null || { git commit -qam "fly.toml: app name $APP" && git push -q || true; }
open "$URL" 2>/dev/null || true
