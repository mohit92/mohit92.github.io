# mohit92.github.io

A small static blog. Posts are Markdown files in `posts/`; `build.mjs` turns them into HTML in `dist/`, and a GitHub Action publishes `dist/` to GitHub Pages on every push to `main`.

## Writing a post

1. Add `posts/<slug>.md` starting with:
   ```
   ---
   title: The post's title
   date: 2026-11-23
   description: One sentence for the index and link previews.
   ---
   ```
2. Preview: `npm run preview`, then open http://localhost:4321.
3. Push to `main` to publish.

First time: `npm install`.
