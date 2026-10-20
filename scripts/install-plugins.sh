#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
PLUGINS_DIR="$REPO_ROOT/plugins"
TARGET_DIR="${HOME}/.gemini/config/plugins"

mkdir -p "$TARGET_DIR"

echo "==> Installing Better Antigravity plugins into: $TARGET_DIR"

for plugin_path in "$PLUGINS_DIR"/*; do
  if [ -d "$plugin_path" ]; then
    plugin_name=$(basename "$plugin_path")
    dest_path="$TARGET_DIR/$plugin_name"
    echo -n "  -> Installing [$plugin_name]... "
    mkdir -p "$dest_path"
    cp -R "$plugin_path"/* "$dest_path"/
    echo "[OK]"
  fi
done

echo
echo "All plugins have been successfully installed into Antigravity!"
