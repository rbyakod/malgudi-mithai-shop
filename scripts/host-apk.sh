#!/usr/bin/env bash
# Host the current Android debug APK at the public download URL:
#   https://mishran.pranavb.com/download/mishran-latest.apk
#
# The file deliberately lives OUTSIDE the app repo (/var/www/mishran-download,
# served by the nginx `location /download/` block in the mishran vhost) —
# anything dropped into /opt/mithai-shop/public would dirty the deploy
# checkout and hard-fail deploy-vps.sh's `git pull`.
#
# Usage:
#   scripts/host-apk.sh            # host the already-built APK
#   scripts/host-apk.sh --build    # rebuild first (live API base URL baked in)
set -euo pipefail
cd "$(dirname "$0")/.."

VPS=root@2.24.221.70
REMOTE_DIR=/var/www/mishran-download
URL=https://mishran.pranavb.com/download/mishran-latest.apk
APK=apps/android/app/build/outputs/apk/debug/app-debug.apk

if [[ "${1:-}" == "--build" ]]; then
  (cd apps/android &&
    ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}" \
    JAVA_HOME="${JAVA_HOME:-$(/usr/libexec/java_home -v 21)}" \
    ./gradlew :app:assembleDebug -PapiBaseUrl=https://mishran.pranavb.com/api/mobile/v1/)
fi

if [[ ! -f "$APK" ]]; then
  echo "APK not found: $APK  (run: scripts/host-apk.sh --build)" >&2
  exit 1
fi

ssh "$VPS" "mkdir -p $REMOTE_DIR"
scp "$APK" "$VPS:$REMOTE_DIR/mishran-latest.apk"
echo "--- verifying ---"
curl -fsSI "$URL" | sed -n '1,5p'
