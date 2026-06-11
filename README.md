# dbarath.github.io

Personal academic website for **Daniel Barath**, served at
<https://dbarath.github.io/>. Plain static HTML/CSS/JS — no build step.

## Structure

```
index.html        Single page: About → News → Publications
css/style.css     Styling + light/dark theming (CSS variables)
js/main.js        Loads JSON, renders content, theme toggle, filters
data/papers.json  Publication list  (edit this to add papers)
data/news.json    News items        (edit this to add news)
assets/           Profile photo + favicon
.nojekyll         Serve files as-is (skip Jekyll processing)
```

## Editing content

**Add a publication** — append an object to `data/papers.json`:

```json
{
  "title": "Paper title",
  "authors": ["Daniel Barath", "Co Author"],
  "venue": "CVPR",
  "year": 2025,
  "links": { "pdf": "", "arxiv": "", "code": "", "project": "" },
  "highlight": false
}
```

- Leave any link field as `""` to hide that chip.
- `"highlight": true` adds an accent bar (use for selected/key papers).
- The author named exactly `Daniel Barath` is bolded automatically.
- Year-filter buttons are generated from the data; papers sort newest-first.

**Add news** — append to `data/news.json`:

```json
{ "date": "2025-03", "text": "Something happened.", "link": "" }
```

**Bio / name / links** — edit the About section directly in `index.html`.
Swap the profile image by replacing `assets/profile.svg` (or point the `<img>`
at a `profile.jpg`).

> ℹ️ `papers.json` was populated from `CV_Daniel_Barath_with_Publications.docx`.
> Most `links` are empty — add real PDF / arXiv / code / project URLs as you go.
> A few well-known repos (MAGSAC, GLOMAP, Graph-Cut RANSAC, Progressive-X) are
> pre-filled. The optional `"note"` field renders a small tag (e.g. `Oral`,
> `Journal`, `Highlight`).
