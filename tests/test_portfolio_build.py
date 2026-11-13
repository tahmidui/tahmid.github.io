"""Run with .venv/bin/python -m unittest discover -s tests."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('portfolio_build', Path(__file__).resolve().parents[1] / 'portfolio/build-projects.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class MetadataTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def project(self, slug='sample-project', fields='', title='Example'):
        folder = self.root / slug
        folder.mkdir(exist_ok=True)
        file = folder / 'index.qmd'
        file.write_text(f'---\ntitle: "{title}"\nstatus: queued\nsummary: "Example summary"\n{fields}---\n\n## Overview\n')
        return file

    def test_missing_optional_fields_and_inferred_url(self):
        result = build.read_project(self.project())
        self.assertEqual(result['tools'], [])
        self.assertEqual(result['categories'], [])
        self.assertEqual(result['packages'], [])
        self.assertEqual(result['tags'], [])
        self.assertEqual(result['url'], '/portfolio/sample-project/')
        self.assertNotIn('order', result)

    def test_explicit_url_and_tools(self):
        result = build.read_project(self.project(fields='url: https://example.com/demo/\ntools: [R, Python, R]\n'))
        self.assertEqual(result['url'], 'https://example.com/demo/')
        self.assertEqual(result['tools'], ['R', 'Python'])

    def test_packages_and_tags(self):
        result = build.read_project(self.project(fields='packages: [scikit-learn]\ntags: [Machine Learning, Survey Analysis]\n'))
        self.assertEqual(result['packages'], ['scikit-learn'])
        self.assertEqual(result['tags'], ['Machine Learning', 'Survey Analysis'])

    def test_status_validation(self):
        file = self.project()
        file.write_text(file.read_text().replace('queued', 'developing'))
        with self.assertRaisesRegex(ValueError, 'available, in-development, queued'):
            build.collect_projects(self.root)

    def test_bad_fields_and_urls(self):
        for fields in ['order: true\n', 'year: today\n', 'tools: Python\n', 'categories: [1]\n', 'packages: pandas\n', 'tags: [1]\n', 'url: javascript:alert(1)\n', 'url: //example.com\n', 'title: Duplicate\n']:
            with self.subTest(fields=fields), self.assertRaises(ValueError):
                build.read_project(self.project(fields=fields))

    def test_required_fields(self):
        for field in ['title', 'status', 'summary']:
            file = self.project()
            file.write_text('\n'.join(line for line in file.read_text().splitlines() if not line.startswith(field + ':')))
            with self.subTest(field=field), self.assertRaisesRegex(ValueError, field):
                build.read_project(file)

    def test_order_and_template_exclusion(self):
        self.project('z-last', title='Zebra')
        self.project('a-fallback', title='Alpha')
        self.project('ordered', fields='order: 1\n')
        self.project('_templates')
        self.assertEqual([p['slug'] for p in build.collect_projects(self.root)], ['ordered', 'a-fallback', 'z-last'])

    def test_empty_collection(self):
        self.assertEqual(build.collect_projects(self.root), [])


if __name__ == '__main__':
    unittest.main()
