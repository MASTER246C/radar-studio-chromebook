"""Check relative links (and #anchors into Markdown files) in every tracked *.md file.

Absolute URLs are not fetched. Usage, from the repository root:
    python3 tools/check_links.py
"""
import re
import subprocess
import sys
import unicodedata
from pathlib import Path
from urllib.parse import unquote

FENCE = re.compile(r'```.*?```', re.S)
CODE = re.compile(r'`[^`\n]*`')
LINK = re.compile(r'\[(?:[^\[\]]|\[[^\]]*\])*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)')
REFERENCE = re.compile(r'^\s{0,3}\[[^\]]+\]:\s*<?(\S+?)>?(?:\s+.*)?$', re.M)
HREF = re.compile(r'(?:href|src)="([^"]+)"')
HEADING = re.compile(r'^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$', re.M)


def slug(heading):
    """GitHub-style heading anchor."""
    text = re.sub(r'<[^>]+>', '', heading)
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text).replace('`', '').replace('*', '').strip().lower()
    kept = ''.join(c for c in text if c in ' -_' or unicodedata.category(c)[0] in 'LN' or unicodedata.category(c) == 'Mn')
    return kept.replace(' ', '-')


def anchors(path, cache={}):
    if path not in cache:
        text = FENCE.sub('', path.read_text(encoding='utf-8', errors='replace'))
        found, seen = set(), {}
        for match in HEADING.finditer(text):
            base = slug(match.group(1))
            count = seen.get(base, 0)
            seen[base] = count + 1
            found.add(base if count == 0 else f'{base}-{count}')
        found.update(re.findall(r'(?:id|name)="([^"]+)"', text))
        cache[path] = found
    return cache[path]


def main():
    root = Path.cwd().resolve()
    files = subprocess.run(['git', 'ls-files', '-z', '*.md'], check=True, capture_output=True).stdout.decode().split('\0')
    problems, checked = [], 0
    for name in filter(None, files):
        source = root / name
        text = CODE.sub('', FENCE.sub('', source.read_text(encoding='utf-8', errors='replace')))
        for target in LINK.findall(text) + REFERENCE.findall(text) + HREF.findall(text):
            if re.match(r'^[a-z][a-z0-9+.-]*:', target, re.I):
                continue  # absolute URL or mailto:
            checked += 1
            path, _, fragment = target.partition('#')
            resolved = source if not path else (source.parent / unquote(path)).resolve()
            if root not in resolved.parents and resolved != root:
                problems.append(f'{name}: {target} points outside the repository')
            elif not resolved.exists():
                problems.append(f'{name}: {target} does not exist')
            elif fragment and resolved.suffix.lower() == '.md' and unquote(fragment).lower() not in anchors(resolved):
                problems.append(f'{name}: {target} has no matching heading')
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(f'{len(problems)} broken link(s) of {checked} relative links checked')
    print(f'PASS {checked} relative links in Markdown files')


if __name__ == '__main__':
    main()
