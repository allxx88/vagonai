#!/usr/bin/env python3
"""Publish the current ngrok webhook to GitHub without a local checkout."""
import argparse
import base64
import json
import os
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit
from urllib.request import Request, urlopen


def webhook_url(value):
    url = urlsplit(value)
    if (url.scheme != 'https' or not url.hostname or url.username or url.password
            or url.query or url.fragment or url.path not in ('', '/', '/webhook/chat_vagon')):
        raise ValueError('Expected HTTPS tunnel base URL or /webhook/chat_vagon URL')
    return f'https://{url.netloc}/webhook/chat_vagon'


def api(method, url, token, body=None):
    request = Request(url, method=method, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': 'vagonai-webhook-updater',
    }, data=json.dumps(body).encode() if body is not None else None)
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='Current HTTPS ngrok base URL; otherwise read local ngrok API')
    parser.add_argument('--repo', default='allxx88/vagonai')
    parser.add_argument('--branch', default='main')
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    if not re.fullmatch(r'[\w.-]+/[\w.-]+', args.repo):
        parser.error('Invalid owner/repository')
    if args.url:
        target = webhook_url(args.url)
    else:
        with urlopen('http://127.0.0.1:4040/api/tunnels', timeout=10) as response:
            tunnels = json.load(response)['tunnels']
        candidates = [t['public_url'] for t in tunnels
                      if t.get('public_url', '').startswith('https://')
                      and re.search(r'(?:localhost|127\.0\.0\.1):5678/?$',
                                    t.get('config', {}).get('addr', ''))]
        if len(candidates) != 1:
            raise ValueError('Expected exactly one HTTPS tunnel to n8n port 5678; use --url')
        target = webhook_url(candidates[0])
    if args.dry_run:
        print(json.dumps({'webhook_url': target}, ensure_ascii=False, indent=2))
        return
    token = os.environ.get('WEBHOOK_GITHUB_TOKEN')
    if not token:
        raise ValueError('Set WEBHOOK_GITHUB_TOKEN on the server')
    endpoint = f'https://api.github.com/repos/{args.repo}/contents/static/api/endpoint.json'
    content = json.dumps({'webhook_url': target}, indent=2) + '\n'
    for attempt in range(3):
        try:
            current = api('GET', endpoint + '?ref=' + quote(args.branch, safe=''), token)
            existing = base64.b64decode(current['content']).decode()
            if json.loads(existing).get('webhook_url') == target:
                print('Webhook already current; no commit needed.')
                return
            result = api('PUT', endpoint, token, {
                'message': 'Update chat webhook after ngrok restart',
                'branch': args.branch,
                'sha': current['sha'],
                'content': base64.b64encode(content.encode()).decode(),
            })
            print('Webhook updated. Pages deployment will run for commit ' + result['commit']['sha'])
            return
        except HTTPError as error:
            if error.code not in (409, 422, 500, 502, 503, 504) or attempt == 2:
                raise ValueError(f'GitHub HTTP {error.code}; check token permissions, branch and file availability') from None
        except (URLError, TimeoutError):
            if attempt == 2:
                raise ValueError('GitHub request failed after three attempts') from None
        time.sleep(2 * (attempt + 1))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, URLError, TimeoutError) as error:
        print(f'Webhook update failed: {error}', file=sys.stderr)
        sys.exit(1)
