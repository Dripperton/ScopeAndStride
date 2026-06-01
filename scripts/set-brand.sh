#!/bin/bash
# Usage: npm run brand <slug>
# Example: npm run brand hidden-hill-farm
#
# Copies the brand config for <slug> into constants/brand-config.ts,
# which is what the app actually imports at build time.

set -e

SLUG=${1:-scope-and-stride}
SRC="brands/${SLUG}.ts"
DEST="constants/brand-config.ts"

if [ ! -f "$SRC" ]; then
  echo "❌  No brand file found at $SRC"
  echo "    Available brands:"
  ls brands/*.ts | sed 's/brands\//    /' | sed 's/\.ts//'
  exit 1
fi

# Copy the brand file and inject the header comment
cat > "$DEST" << EOF
// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE BRAND CONFIG — generated from brands/${SLUG}.ts
// Do not edit directly. Run: npm run brand ${SLUG}
// ─────────────────────────────────────────────────────────────────────────────

EOF

# Append the brand content (skip the comment lines at the top)
tail -n +4 "$SRC" >> "$DEST"

echo "✅  Brand set to: $SLUG"
