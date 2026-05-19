# Publish Guide

The pages in this directory are GitHub-Wiki-ready markdown files.

## Option A: Publish with script

From repository root:

```bash
./scripts/publish-wiki.sh
```

What the script does:

1. Clones `https://github.com/Coding-Krakken/BackyardBBQ.wiki.git`
2. Replaces markdown files with content from this `wiki/` directory
3. Commits and pushes updates to the wiki repository

## Option B: Manual publish

1. Clone the wiki git repository.
2. Copy markdown files from this directory.
3. Commit and push to the wiki repo.

## Notes

- If clone fails with "repository not found", enable wiki in repository settings and retry.
- Keep `Home.md` as the primary landing page.
- Keep `_Sidebar.md` for left-nav structure.
