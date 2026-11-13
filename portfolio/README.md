# Maintaining the portfolio

**Edit one file per project: `portfolio/<project-folder>/index.qmd`.** Its YAML
(the fields between `---` lines) supplies the card; its Markdown supplies the page.

## Add a project

From the repository root:

```sh
mkdir -p portfolio/my-new-project
cp portfolio/_templates/project-template.qmd portfolio/my-new-project/index.qmd
```

1. Edit that new `index.qmd`: title, status, summary, tools, packages, tags, categories, and optional year/order.
2. Write the project content below the YAML.
3. Run `./build.sh`, or commit and push the source files to `main` once GitHub is configured.

Use lowercase folder names with hyphens. Lower `order` numbers come first;
projects without an order follow alphabetically. The template is never listed.

## Change status or tools

Choose `status: queued`, `status: in-development`, or `status: available`.
Counts and colors update automatically. Tools are a YAML list:

```yaml
tools:
  - R
  - Python
  - SQL
packages:
  - scikit-learn
tags:
  - Machine Learning
categories:
  - Research
```

Tools are software/languages/databases (R, Python, SQL); packages are libraries
(scikit-learn, ggplot2); tags are domains/methods (Survey Analysis, Machine Learning).
Known tools use local icons, with text fallbacks if unavailable. Tags have consistent
muted colors. Empty Tools, Packages, and Tags sections are omitted.
R, Python, SQL, Research, and Machine Learning filters appear when represented by
tools, tags, or categories; packages do not create filters.
Tools/packages/tags/categories/year/order can be omitted.
An optional `status-note: "Available soon"` adds a short note beside the tag.

## URLs

`portfolio/my-project/index.qmd` becomes `/portfolio/my-project/` automatically.
For an externally hosted project, add `url: "https://example.com/my-project/"`.
The local Quarto page is still rendered, but the card uses your custom URL.

## Build and preview

Install Python 3 and [Quarto](https://quarto.org/docs/get-started/) once. Then:

```sh
./build.sh
```

The script installs its small Python dependency into `.venv` on the first run,
validates metadata, generates JSON, renders Quarto pages, and prepares `_site/`.
For a local preview use `./build.sh preview`, then visit
`http://localhost:8000/portfolio/`. Stop with Ctrl-C; rebuild to see source changes.
Use the server rather than double-clicking HTML (browsers block local JSON fetches).
A repository-local Quarto in `.tools/quarto*/bin/` is also supported.

**Generated: do not edit or commit** `projects.json`, project `index.html`,
`index_files/`, and `_site/`. These are ignored by Git. Only source files belong
in commits. Keep public project assets beside the QMD; those assets are deployed.
Code execution defaults to off; plain Markdown renders without R/Python packages.
Enable execution later only after adding the required runtimes/packages to CI.

## GitHub (one-time setup)

In the repository's **Settings → Pages → Build and deployment → Source**, select
**GitHub Actions**. This replaces branch publishing; the workflow deploys the full
existing site, including `CNAME`, alongside the built portfolio.

Once the workflow and sources are committed, each push to `main` runs `./build.sh`
and deploys `_site/`. Pull requests build without deploying. Check the Actions tab
for validation errors (including the filename and invalid field).

Shared styling remains in `assets/css/`. Icon mappings and the concise filter
allowlist live in `assets/js/portfolio.js`; normal project edits don't touch them.
