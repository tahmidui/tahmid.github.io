// Content comes exclusively from projects.json, generated from project index.qmd files.
(() => {
  const STATUSES = {
    available: { label: 'Available', icon: '✓', className: 'status-available' },
    'in-development': { label: 'In Development', icon: '◷', className: 'status-development' },
    queued: { label: 'Queued', icon: 'calendar', className: 'status-queued' }
  };
  // One icon registry; unlisted tools remain readable text badges.
  const ICON_BASE = new URL('../../icons/', document.currentScript.src);
  const TECHNOLOGIES = {
    r: 'r-icon.svg', python: 'python-icon.svg', sql: 'sql-icon.svg',
    postgresql: 'postgresql-icon.svg', stata: 'stata-icon.svg',
    tableau: 'tableau-icon.svg', git: 'git-icon.svg', github: 'github-icon.svg'
  };
  // Stable semantic groups; unlisted tags use the neutral site palette.
  const TAG_GROUPS = {
    'health care analytics': 'health', 'healthcare analytics': 'health',
    'survey analysis': 'research', 'survey data': 'research',
    'quantitative research': 'research', 'social research': 'research',
    'statistical analysis': 'research', 'machine learning': 'research',
    'data visualization': 'design', 'database design': 'design', 'erd': 'design'
  };
  // A short allowlist keeps the controls useful as the tools list grows.
  const FILTERS = ['R', 'Python', 'SQL', 'Research', 'Machine Learning'];
  const grid = document.getElementById('project-grid');
  const summary = document.querySelector('.project-summary');
  const filters = document.querySelector('.project-filters');
  const result = document.getElementById('project-filter-result');
  const loadStatus = document.getElementById('project-load-status');
  if (!grid || !summary || !filters || !loadStatus) return;

  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const symbol = (icon, className = '') => {
    // Visible status text names the icon, so hide the decorative SVG from AT.
    if (icon === 'calendar') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', `calendar-icon ${className}`);
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'none');
      svg.setAttribute('stroke', 'currentColor');
      svg.setAttribute('stroke-width', '1.8');
      svg.setAttribute('stroke-linecap', 'round');
      svg.setAttribute('stroke-linejoin', 'round');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M7 3v4m10-4v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z');
      svg.append(path);
      return svg;
    }
    const element = node('span', className, icon);
    element.setAttribute('aria-hidden', 'true');
    return element;
  };
  const keywords = project => [...project.tools, ...project.tags, ...project.categories].map(value => value.toLowerCase());

  function technology(name, url) {
    const mapping = TECHNOLOGIES[name.toLowerCase()];
    if (!mapping) return node('span', 'technology-name', name);
    // A real link preserves whole-card navigation, including the icon area.
    const badge = node('a', 'technology');
    badge.href = url;
    badge.setAttribute('aria-label', name);
    badge.title = name;
    // Start with a readable fallback. Never attach a failed or pending image.
    badge.classList.add('technology-text');
    const fallback = node('span', '', name);
    badge.append(fallback);
    const image = new Image();
    image.alt = '';
    image.onload = () => {
      if (!image.naturalWidth) return;
      fallback.replaceWith(image);
      badge.classList.remove('technology-text');
    };
    image.onerror = () => { /* Keep the text badge already on screen. */ };
    image.src = new URL(mapping, ICON_BASE).href;
    const tooltip = node('span', 'technology-tooltip', name);
    tooltip.setAttribute('aria-hidden', 'true');
    badge.append(tooltip);
    return badge;
  }

  function card(project) {
    const item = node('li');
    const article = node('article', 'project-card');
    article.dataset.status = project.status;
    const titleId = `project-${project.slug}-title`;
    article.setAttribute('aria-labelledby', titleId);
    const status = STATUSES[project.status];
    const statusRow = node('div', 'project-status');
    const tag = node('span', `status-tag ${status.className}`);
    tag.append(symbol(status.icon, 'status-icon'), node('span', 'sr-only', 'Status: '), document.createTextNode(status.label));
    statusRow.append(tag);
    if (project.statusNote) statusRow.append(node('span', 'project-soon', project.statusNote));
    const title = node('h2');
    title.id = titleId;
    const link = node('a', 'project-link', project.title);
    link.href = project.url;
    title.append(link);
    article.append(statusRow, title, node('p', 'project-description', project.summary));
    if (project.tools.length || project.packages.length || project.tags.length) {
      const metadata = node('div', 'project-metadata');
      const sections = [
        ['Tools', project.tools, name => technology(name, project.url)],
        ['Packages', project.packages, name => node('span', 'package-chip', name)],
        ['Tags', project.tags, name => node('span', `tag-chip tag-${TAG_GROUPS[name.toLowerCase()] || 'neutral'}`, name)]
      ];
      sections.forEach(([label, values, makeBadge]) => {
        if (!values.length) return;
        const section = node('dl', `project-${label.toLowerCase()} metadata-section`);
        const list = node('dd', 'metadata-list');
        values.forEach(name => list.append(makeBadge(name)));
        section.append(node('dt', '', label), list);
        metadata.append(section);
      });
      article.append(metadata);
    }
    const view = node('span', 'project-view', 'View project →');
    view.setAttribute('aria-hidden', 'true');
    article.append(view);
    item.append(article);
    return item;
  }

  function render(projects) {
    const items = projects.map(project => ({ project, element: card(project) }));
    grid.replaceChildren(...items.map(item => item.element));
    summary.replaceChildren(node('span', 'summary-chip', `${projects.length} Projects`));
    Object.entries(STATUSES).forEach(([key, status]) => {
      const chip = node('span', `summary-chip ${status.className}`);
      chip.append(symbol(status.icon), document.createTextNode(`${projects.filter(project => project.status === key).length} ${status.label}`));
      summary.append(chip);
    });
    summary.hidden = false;
    const choices = ['All', ...FILTERS.filter(label => projects.some(project => keywords(project).includes(label.toLowerCase())))];
    filters.replaceChildren();
    choices.forEach(label => {
      const button = node('button', 'filter-button', label);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(label === 'All'));
      button.setAttribute('aria-controls', 'project-grid');
      button.addEventListener('click', () => {
        filters.querySelectorAll('button').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
        let visible = 0;
        items.forEach(({ project, element }) => {
          const matches = label === 'All' || keywords(project).includes(label.toLowerCase());
          element.hidden = !matches;
          if (matches) visible++;
        });
        result.textContent = `${visible} of ${projects.length} projects shown. Filter: ${label}.`;
      });
      filters.append(button);
    });
    filters.hidden = projects.length === 0;
    loadStatus.hidden = projects.length > 0;
    loadStatus.textContent = projects.length ? '' : 'Projects will be added here soon.';
  }

  async function load() {
    try {
      const response = await fetch(new URL('projects.json', document.baseURI));
      if (!response.ok) throw new Error(`Project data returned HTTP ${response.status}`);
      const projects = await response.json();
      if (!Array.isArray(projects) || projects.some(project => !Object.hasOwn(STATUSES, project.status))) {
        throw new Error('Invalid project data');
      }
      projects.forEach(project => {
        for (const field of ['tools', 'packages', 'tags', 'categories']) {
          if (project[field] === undefined) project[field] = [];
          if (!Array.isArray(project[field]) || project[field].some(value => typeof value !== 'string')) {
            throw new Error(`Invalid ${field} metadata`);
          }
        }
      });
      render(projects);
    } catch (error) {
      loadStatus.hidden = false;
      loadStatus.textContent = location.protocol === 'file:'
        ? 'To preview projects locally, run ./build.sh preview and open http://localhost:8000/portfolio/.'
        : 'Projects could not be loaded. Please reload the page to try again.';
      console.error('Portfolio:', error);
    } finally {
      grid.setAttribute('aria-busy', 'false');
    }
  }
  load();
})();
