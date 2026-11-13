#!/usr/bin/env python3
"""Validate index.qmd metadata, generate projects.json, render, and stage the site."""
from pathlib import Path
import argparse
import json
import math
import re
import shutil
import subprocess
import sys
from urllib.parse import urlsplit

import yaml

ROOT = Path(__file__).resolve().parent.parent
PORTFOLIO = ROOT / 'portfolio'
STATUSES = ('available', 'in-development', 'queued')


class UniqueLoader(yaml.SafeLoader):
    """Reject duplicate keys instead of silently using the last value."""


def unique_mapping(loader, node, deep=False):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if not isinstance(key, str) or key in mapping:
            raise ValueError(f'duplicate or non-text YAML key: {key!r}')
        mapping[key] = loader.construct_object(value_node, deep=deep)
    return mapping


UniqueLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def read_project(path):
    text = path.read_text(encoding='utf-8-sig')
    match = re.match(r'\A---\s*\n(.*?)\n---\s*(?:\n|$)', text, re.S)
    if not match:
        raise ValueError('start the file with YAML metadata between --- lines')
    meta = yaml.load(match[1], Loader=UniqueLoader)
    if not isinstance(meta, dict):
        raise ValueError('YAML metadata must be a mapping of field names to values')
    project = {}
    for field in ('title', 'status', 'summary'):
        value = meta.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f'{field}: a non-empty text value is required')
        project[field] = value.strip()
    if project['status'] not in STATUSES:
        raise ValueError(f"status: {project['status']!r} is invalid; use {', '.join(STATUSES)}")
    for field in ('tools', 'packages', 'tags', 'categories'):
        values = meta.get(field, [])
        if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
            raise ValueError(f'{field}: use a YAML list of non-empty names')
        project[field] = list(dict.fromkeys(v.strip() for v in values))
    for field in ('year', 'order'):
        if field in meta:
            value = meta[field]
            if type(value) is not int:
                raise ValueError(f'{field}: use a whole number')
            project[field] = value
    if 'status-note' in meta:
        if not isinstance(meta['status-note'], str):
            raise ValueError('status-note: use text')
        project['statusNote'] = meta['status-note'].strip()
    slug = path.parent.name
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug):
        raise ValueError('folder name must use lowercase letters, numbers, and single hyphens')
    project['slug'] = slug
    url = meta.get('url', f'/portfolio/{slug}/')
    if not isinstance(url, str) or not url or re.search(r'[\s\\\x00-\x1f]', url):
        raise ValueError('url: use a site-relative /path/ or an https:// URL')
    parsed = urlsplit(url)
    if not ((url.startswith('/') and not url.startswith('//')) or (parsed.scheme in ('https', 'http') and parsed.netloc)):
        raise ValueError('url: use a site-relative /path/ or an https:// URL')
    project['url'] = url
    return project


def collect_projects(directory=PORTFOLIO):
    projects, errors = [], []
    for path in sorted(directory.glob('*/index.qmd')):
        if path.parent.name.startswith(('_', '.')):
            continue
        try:
            projects.append(read_project(path))
        except (ValueError, yaml.YAMLError) as error:
            errors.append(f'{path}: {error}')
    if errors:
        raise ValueError('\n'.join(errors))
    return sorted(projects, key=lambda p: (p.get('order', math.inf), p['title'].casefold(), p['slug']))


def stage_site(projects):
    """Copy versionable site files plus generated output, never local tool installs."""
    output = ROOT / '_site'
    if output.exists():
        shutil.rmtree(output)
    output.mkdir()
    files = subprocess.check_output(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT).decode().split('\0')
    for name in set(files):
        path = Path(name)
        if not name or any(part.startswith('.') for part in path.parts):
            continue
        if path.parts[0] in ('_site', '.tools', '.venv') or path.suffix in ('.qmd', '.py', '.yml', '.yaml', '.sh'):
            continue
        if path.parts[0] == 'portfolio' and (len(path.parts) == 2 and path.name != 'index.html' or '_templates' in path.parts):
            continue
        source = ROOT / path
        if source.is_file():
            destination = output / path
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    # Include Quarto's generated HTML/dependencies and project assets (figures/data).
    for project in projects:
        source = PORTFOLIO / project['slug']
        shutil.copytree(source, output / 'portfolio' / project['slug'], dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('*.qmd', '.quarto', '__pycache__', '.DS_Store'))
    libs = PORTFOLIO / 'site_libs'
    if libs.exists():
        shutil.copytree(libs, output / 'portfolio' / 'site_libs', dirs_exist_ok=True)
    shutil.copy2(PORTFOLIO / 'projects.json', output / 'portfolio' / 'projects.json')
    (output / '.nojekyll').touch()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--metadata-only', action='store_true', help='validate and regenerate only projects.json')
    parser.add_argument('--quarto', default='quarto', help='Quarto executable')
    args = parser.parse_args()
    try:
        projects = collect_projects()
        # Validate everything before replacing the previous generated JSON.
        (PORTFOLIO / 'projects.json').write_text(json.dumps(projects, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(f'Generated portfolio/projects.json: {len(projects)} projects.', flush=True)
        if not args.metadata_only:
            if projects:
                subprocess.run([args.quarto, 'render', str(PORTFOLIO)], cwd=ROOT, check=True)
            stage_site(projects)
            print('Build complete. Deployment files: _site/; preview: ./build.sh preview')
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Build failed: {error}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
