"""Verify or regenerate the file list of a RELEASE_MANIFEST.json.

The manifest lists every git-tracked file in its own folder (except itself)
with byte count and SHA-256. Release metadata (version, status, dates) is
edited by hand; this tool only maintains "files".

    python3 tools/release_manifest.py RELEASE_MANIFEST.json            # verify, exit 1 if stale
    python3 tools/release_manifest.py RELEASE_MANIFEST.json --update   # rewrite "files"
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def tracked(folder, manifest):
    out = subprocess.run(['git', 'ls-files', '-z', '--', '.'], cwd=folder, check=True, capture_output=True).stdout
    paths = [p for p in out.decode('utf-8').split('\0') if p]
    return sorted((p for p in paths if (folder / p).resolve() != manifest), key=str.lower)


def entry(folder, path):
    data = (folder / path).read_bytes()
    return {'path': path, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main(argv):
    if len(argv) not in (2, 3) or (len(argv) == 3 and argv[2] != '--update'):
        sys.exit(__doc__)
    manifest = Path(argv[1]).resolve()
    folder = manifest.parent
    document = json.loads(manifest.read_text(encoding='utf-8'))
    expected = [entry(folder, p) for p in tracked(folder, manifest)]
    if len(argv) == 3:
        document['files'] = expected
        manifest.write_bytes((json.dumps(document, indent=2, ensure_ascii=False) + '\n').encode('utf-8'))
        print(f'updated {manifest.name}: {len(expected)} files')
        return
    listed = {f['path']: f for f in document.get('files', [])}
    problems = [f'not listed: {e["path"]}' for e in expected if e['path'] not in listed]
    problems += [f'listed but not tracked: {p}' for p in sorted(set(listed) - {e['path'] for e in expected})]
    problems += [f'changed: {e["path"]}' for e in expected if e['path'] in listed and listed[e['path']] != e]
    if problems:
        print('\n'.join(problems), file=sys.stderr)
        sys.exit(f'{manifest.name} is stale; run: python3 tools/release_manifest.py {argv[1]} --update')
    print(f'PASS {manifest.name} matches {len(expected)} tracked files')


if __name__ == '__main__':
    main(sys.argv)
