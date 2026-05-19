#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WIKI_SRC_DIR="$REPO_ROOT/wiki"
TMP_DIR="${TMPDIR:-/tmp}/backyardbbq-wiki-publish"
WIKI_REMOTE="https://github.com/Coding-Krakken/BackyardBBQ.wiki.git"
DEFAULT_AUTHOR_NAME="BackyardBBQ Wiki Bot"
DEFAULT_AUTHOR_EMAIL="coding-krakken@users.noreply.github.com"

if [[ ! -d "$WIKI_SRC_DIR" ]]; then
  echo "Missing wiki source directory: $WIKI_SRC_DIR"
  exit 1
fi

rm -rf "$TMP_DIR"

echo "Cloning wiki repository..."
if ! git clone "$WIKI_REMOTE" "$TMP_DIR"; then
  echo "Could not clone wiki remote: $WIKI_REMOTE"
  echo "Ensure the repository wiki is enabled and your account has write access."
  exit 2
fi

echo "Copying wiki pages..."
find "$TMP_DIR" -maxdepth 1 -type f -name '*.md' -delete
cp "$WIKI_SRC_DIR"/*.md "$TMP_DIR"/

echo "Committing wiki updates..."
cd "$TMP_DIR"

# Configure identity locally for this temporary wiki clone.
if [[ -z "$(git config --get user.name || true)" ]]; then
  git config user.name "${WIKI_GIT_NAME:-$DEFAULT_AUTHOR_NAME}"
fi
if [[ -z "$(git config --get user.email || true)" ]]; then
  git config user.email "${WIKI_GIT_EMAIL:-$DEFAULT_AUTHOR_EMAIL}"
fi

git add .

if git diff --cached --quiet; then
  echo "No wiki changes to publish."
  exit 0
fi

git commit -m "docs(wiki): update BackyardBBQ wiki pages"
git push origin master

echo "Wiki publish complete."
