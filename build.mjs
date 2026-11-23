// Builds posts/*.md into dist/. Each post starts with a front-matter block:
// ---
// title: ...
// date: YYYY-MM-DD
// description: one sentence for the index and link previews
// ---
import {readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, copyFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join, extname} from 'node:path';
import {marked} from 'marked';

const SITE = {
  title: 'Mohit Agarwal',
  tagline: 'Notes on building agents and the harnesses around them.',
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function readPost(file) {
  const raw = readFileSync(join('posts', file), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta = Object.fromEntries(
    m[1].split('\n').map((l) => l.match(/^(\w+):\s*(.*)$/)).filter(Boolean).map(([, k, v]) => [k, v.trim()]),
  );
  for (const k of ['title', 'date', 'description']) if (!meta[k]) throw new Error(`${file}: no ${k}`);
  return {...meta, slug: file.replace(/\.md$/, ''), html: marked.parse(raw.slice(m[0].length))};
}

const fmtDate = (d) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'});

// Relative paths (`root`) so the site works from any folder, not only the domain root.
const page = ({title, description, body, root}) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<header class="site"><a href="${root}">${esc(SITE.title)}</a></header>
<main>
${body}
</main>
</body>
</html>
`;

function build() {
  rmSync('dist', {recursive: true, force: true});
  mkdirSync('dist/posts', {recursive: true});
  copyFileSync('style.css', 'dist/style.css');

  const posts = readdirSync('posts').filter((f) => f.endsWith('.md')).map(readPost)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const p of posts) {
    mkdirSync(`dist/posts/${p.slug}`, {recursive: true});
    writeFileSync(`dist/posts/${p.slug}/index.html`, page({
      title: p.title,
      description: p.description,
      root: '../../',
      body: `<article>
<h1>${esc(p.title)}</h1>
<p class="date">${fmtDate(p.date)}</p>
${p.html}
</article>`,
    }));
  }

  const list = posts.map((p) => `<li>
<a href="posts/${p.slug}/">${esc(p.title)}</a>
<p>${esc(p.description)}</p>
<span class="date">${fmtDate(p.date)}</span>
</li>`).join('\n');
  writeFileSync('dist/index.html', page({
    title: SITE.title,
    description: SITE.tagline,
    root: '',
    body: `<p class="tagline">${esc(SITE.tagline)}</p>
<ul class="posts">
${list}
</ul>`,
  }));
  console.log(`built ${posts.length} post(s) into dist/`);
}

function serve(port = 4321) {
  const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'};
  createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.includes('..')) return res.writeHead(400).end();
    if (path.endsWith('/')) path += 'index.html';
    try {
      const body = readFileSync(join('dist', path));
      res.writeHead(200, {'content-type': types[extname(path)] ?? 'application/octet-stream'}).end(body);
    } catch {
      res.writeHead(404).end('not found');
    }
  }).listen(port, () => console.log(`preview on http://localhost:${port}`));
}

if (process.argv.includes('--serve')) serve();
else build();
