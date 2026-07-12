#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

VERSION="$(grep -E 'MARKETING_VERSION:' project.yml | head -1 | sed -E 's/.*"([^"]+)".*/\1/')"
SCHEME="Aton"
CONFIGURATION="${CONFIGURATION:-Release}"
EXPORT_METHOD="${EXPORT_METHOD:-app-store-connect}"
ARCHIVE_PATH="$ROOT_DIR/build/Aton-$VERSION.xcarchive"
EXPORT_PATH="$ROOT_DIR/build/export-$VERSION"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is required. Install: brew install xcodegen" >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "xcodebuild is required. Run this script on macOS with Xcode installed." >&2
  exit 1
fi

if [[ -z "${DEVELOPMENT_TEAM:-}" ]]; then
  echo "DEVELOPMENT_TEAM is required, for example:" >&2
  echo "  DEVELOPMENT_TEAM=XXXXXXXXXX ./scripts/build-release.sh" >&2
  exit 1
fi

mkdir -p build
xcodegen generate

xcodebuild \
  -scheme "$SCHEME" \
  -configuration "$CONFIGURATION" \
  -archivePath "$ARCHIVE_PATH" \
  -destination "generic/platform=iOS" \
  DEVELOPMENT_TEAM="$DEVELOPMENT_TEAM" \
  clean archive

cat > "$ROOT_DIR/build/ExportOptions.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>method</key>
	<string>$EXPORT_METHOD</string>
	<key>signingStyle</key>
	<string>automatic</string>
	<key>teamID</key>
	<string>$DEVELOPMENT_TEAM</string>
	<key>stripSwiftSymbols</key>
	<true/>
	<key>uploadSymbols</key>
	<true/>
</dict>
</plist>
PLIST

rm -rf "$EXPORT_PATH"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$ROOT_DIR/build/ExportOptions.plist"

echo "Archive: $ARCHIVE_PATH"
echo "Export:  $EXPORT_PATH"
