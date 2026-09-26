#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${1:-}" != "" && "${1:-}" != "preview" ]]; then
  echo 'Usage: ./build.sh [preview]' >&2
  exit 1
fi
quarto_bin="${QUARTO_BIN:-$(command -v quarto || true)}"
if [[ -z "$quarto_bin" ]]; then
  for candidate in "$PWD"/.tools/quarto*/bin/quarto; do
    if [[ -x "$candidate" ]]; then quarto_bin="$candidate"; break; fi
  done
fi
if [[ -z "$quarto_bin" ]]; then
  echo 'Install Quarto from https://quarto.org/docs/get-started/ then run ./build.sh again.' >&2
  exit 1
fi
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
if ! .venv/bin/python -c 'import yaml; assert yaml.__version__ == "6.0.3"' 2>/dev/null; then
  .venv/bin/python -m pip install -r portfolio/requirements.txt
fi
.venv/bin/python portfolio/build-projects.py --quarto "$quarto_bin"
if [[ "${1:-}" == "preview" ]]; then
  echo 'Open http://localhost:8000/portfolio/ (Ctrl-C stops preview). Rebuild after editing.'
  .venv/bin/python -m http.server 8000 --bind 127.0.0.1 --directory _site
fi
