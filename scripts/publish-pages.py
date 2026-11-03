"""Build only the public frontend and publish it to the gh-pages branch."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'local-data/pages-site'


def run(args, **options):
    return subprocess.run(args, cwd=ROOT, check=True, **options)


def git(*args, input=None):
    return run(['git', *args], input=input, capture_output=True).stdout.decode().strip()


def tree(directory):
    entries = []
    for path in sorted(directory.iterdir()):
        if path.is_dir():
            mode, kind, sha = '040000', 'tree', tree(path)
        else:
            mode, kind = '100644', 'blob'
            sha = git('hash-object', '-w', '--stdin', input=path.read_bytes())
        entries.append(f'{mode} {kind} {sha}\t{path.name}\0')
    return git('mktree', '-z', input=''.join(entries).encode())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--api-origin', required=True)
    args = parser.parse_args()
    origin = urlsplit(args.api_origin)
    if origin.scheme != 'https' or not origin.hostname or origin.username or origin.password or origin.query or origin.fragment or origin.path not in ('', '/'):
        raise SystemExit('A plain HTTPS API origin is required')
    remote = git('remote', 'get-url', 'origin')
    match = re.fullmatch(r'https://github\.com/([\w.-]+)/([\w.-]+?)(?:\.git)?', remote)
    if not match:
        raise SystemExit('Expected the configured GitHub HTTPS origin')
    owner, name = match.groups()
    repo = f'{owner}/{name}'
    visibility = json.loads(run(['gh', 'repo', 'view', repo, '--json', 'visibility'], capture_output=True).stdout)['visibility']
    if visibility != 'PUBLIC':
        raise SystemExit('Make the repository public explicitly before publishing Pages')
    run(['npm.cmd' if os.name == 'nt' else 'npm', 'run', 'build', '--', '--base', f'/{name}/', '--outDir', str(OUT)],
        env={**os.environ, 'VITE_API_BASE': args.api_origin.rstrip('/')})
    (OUT / '.nojekyll').touch()
    secrets = [v.encode() for k, v in dotenv_values(ROOT / '.env').items()
               if v and len(v) >= 12 and any(part in k.upper() for part in ('KEY', 'TOKEN', 'SECRET', 'PASSWORD'))]
    for file in OUT.rglob('*'):
        if file.is_file() and any(value in file.read_bytes() for value in secrets):
            raise SystemExit('A server secret was found in the frontend output; publication stopped')
    existing = git('ls-remote', 'origin', 'refs/heads/gh-pages')
    parent = None
    if existing:
        git('fetch', 'origin', 'gh-pages')
        parent = git('rev-parse', 'FETCH_HEAD')
    public_tree = tree(OUT)
    if parent and public_tree == git('rev-parse', f'{parent}^{{tree}}'):
        commit = parent
    else:
        commit = git('commit-tree', public_tree, *(['-p', parent] if parent else []), '-m', f'Deploy frontend from {git("rev-parse", "--short", "HEAD")}')
        run(['git', 'push', 'origin', f'{commit}:refs/heads/gh-pages'])
    endpoint = f'repos/{repo}/pages'
    current = subprocess.run(['gh', 'api', endpoint], cwd=ROOT, capture_output=True)
    if current.returncode and '(HTTP 404)' not in current.stderr.decode():
        raise SystemExit('Could not inspect GitHub Pages settings')
    config = dict(source=dict(branch='gh-pages', path='/'), build_type='legacy')
    run(['gh', 'api', endpoint, '--method', 'PUT' if current.returncode == 0 else 'POST', '--input', '-'],
        input=json.dumps(config).encode(), capture_output=True)
    if current.returncode:
        run(['gh', 'api', endpoint + '/builds', '--method', 'POST'], capture_output=True)
    print(json.dumps(dict(url=f'https://{owner.lower()}.github.io/{name}/', commit=commit, apiOrigin=args.api_origin)))


if __name__ == '__main__':
    main()
