#!/usr/bin/env python3
"""Extract ordered paths from a pinned KanjiVG revision. No third-party dependencies."""
import concurrent.futures
import json
from pathlib import Path
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
REVISION = '70a0b7ae0c18ceb5cb358274b029cce0234a43bc'


def download(character):
    code = f'{ord(character):05x}'
    url = f'https://raw.githubusercontent.com/KanjiVG/kanjivg/{REVISION}/kanji/{code}.svg'
    with urllib.request.urlopen(url, timeout=40) as response:
        root = ET.fromstring(response.read())
    paths = [p.attrib['d'] for p in root.iter('{http://www.w3.org/2000/svg}path')
             if p.attrib.get('id', '').startswith(f'kvg:{code}-s')]
    if not paths:
        raise ValueError(f'No strokes: {character}')
    return character, paths


def main():
    words = json.loads((ROOT / 'data/words.json').read_text())
    characters = sorted(set(''.join(w['word'] for w in words)))
    assert len(words) == 57 and len(characters) == 100
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        glyphs = dict(pool.map(download, characters))
    (ROOT / 'data/glyphs.json').write_text(
        json.dumps(glyphs, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Saved {len(glyphs)} characters from KanjiVG {REVISION}')


if __name__ == '__main__':
    main()
