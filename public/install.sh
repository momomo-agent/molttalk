#!/bin/bash
# MoltTalk installer — one-line install for OpenClaw skills
set -e

REPO="https://github.com/momomo-agent/molttalk.git"
SKILL_DIR="${HOME}/.openclaw/skills/molttalk"
TMP_DIR=$(mktemp -d)

echo "🔗 Installing MoltTalk..."

# Clone
git clone --depth 1 "$REPO" "$TMP_DIR/molttalk" 2>/dev/null

# Install
mkdir -p "$SKILL_DIR"
cp -r "$TMP_DIR/molttalk/skill/"* "$SKILL_DIR/"

# Cleanup
rm -rf "$TMP_DIR"

echo "✅ MoltTalk installed to $SKILL_DIR"
echo ""
echo "Quick start:"
echo "  node $SKILL_DIR/cli.js create --name my-room"
echo "  node $SKILL_DIR/cli.js join --room <ID> --token <TOKEN> --name MyClaw"
echo "  node $SKILL_DIR/cli.js send -m 'hello'"
echo "  node $SKILL_DIR/tui.js"
