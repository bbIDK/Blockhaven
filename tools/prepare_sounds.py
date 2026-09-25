#!/usr/bin/env python3
"""Builds assets/sounds/*.mp3 from public-domain (CC0) recordings.

Sources are Kenney's CC0 sound packs (kenney.nl) and CC0 sounds from freesound.org. Each file is
downloaded, its licence is checked (Freesound pages must say "Creative Commons 0"), mixed to mono,
trimmed, loudness-matched and encoded as a small MP3. assets/sounds/CREDITS.md lists every source.

Needs Python 3 with numpy and imageio-ffmpeg (pip install numpy imageio-ffmpeg). Afterwards run
`node tools/pack-sounds.mjs` to regenerate src/sounddata.js.

    python3 tools/prepare_sounds.py [--cache DIR]
"""
import argparse, html, io, json, os, re, subprocess, sys, urllib.parse, urllib.request, zipfile

import numpy as np
import imageio_ffmpeg

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'sounds')
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100

KENNEY = {
    'impact': 'https://kenney.nl/assets/impact-sounds',
    'rpg': 'https://kenney.nl/assets/rpg-audio',
    'ui': 'https://kenney.nl/assets/ui-audio',
}


def K(pack, name):
    return ('kenney', pack, name)


def F(user, sid, start=0.0):
    # (`start`: seconds to skip, where a recording has other sounds before the one wanted)
    return ('freesound', user, sid, start)


def kr(pack, stem, n, start=0):
    return [K(pack, f'{stem}_{i:03d}.ogg') for i in range(start, start + n)]


# name -> (sources, max seconds, loudness target in dBFS short-term RMS[, options])
# Options: loop=True keeps the whole clip (no trimming or fades) for seamless looping.
CATALOG = {
    # Blocks. "dig" is used for breaking and placing, "step" for footsteps and (lower) for mining hits.
    'stone.dig': (kr('impact', 'impactMining', 5), 0.5, -13),
    'stone.step': (kr('impact', 'footstep_concrete', 5), 0.25, -15),
    'wood.dig': ([F('DeltaCode', 667655), F('DeltaCode', 667654), F('thomasjaunism', 218460), F('NoisyRedFox', 742356)], 0.4, -13),
    'wood.step': (kr('impact', 'footstep_wood', 5), 0.25, -15),
    'grass.dig': ([F('OwlStorm', i) for i in (151230, 151229, 151228, 151235)], 0.45, -14),
    'grass.step': ([F('GiocoSound', i) for i in (421131, 421130, 421129, 421128, 421135)], 0.3, -16),
    'gravel.dig': ([F('Ali_6868', i) for i in (384876, 384877, 384879, 384873, 384872)], 0.42, -13),
    'sand.dig': ([F('BranndyBottle', i) for i in (464699, 464695)], 0.45, -14),
    'snow.dig': (kr('impact', 'footstep_snow', 5), 0.4, -14),
    'cloth.dig': ([K('rpg', f'cloth{i}.ogg') for i in range(1, 5)], 0.45, -15),
    'cloth.step': (kr('impact', 'footstep_carpet', 5), 0.2, -16),
    'glass.break': ([F('Bricklover', i) for i in (560766, 560767, 560768)], 0.7, -12),
    'metal.dig': (kr('impact', 'impactMetal_light', 5), 0.35, -15),
    'metal.step': ([F('GiocoSound', i) for i in (421134, 421133, 421132)], 0.3, -16),
    # Things you use.
    'door.open': ([K('rpg', f'doorOpen_{i}.ogg') for i in (1, 2)], 0.9, -14),
    'door.close': ([K('rpg', f'doorClose_{i}.ogg') for i in range(1, 5)], 0.7, -13),
    'chest.open': ([K('rpg', f'creak{i}.ogg') for i in range(1, 4)], 0.8, -15),
    'ui.click': ([K('ui', 'click1.ogg')], 0.12, -12),
    # Combat and the player.
    'hit.punch': (kr('impact', 'impactPunch_medium', 5), 0.35, -13),
    # Weapon hits: a full-strength hit, a weak swipe (before the weapon has wound up) and a crit.
    'attack.strong': (kr('impact', 'impactPunch_heavy', 5), 0.4, -12),
    'attack.weak': ([F('Jofae', 389590), F('SypherZent', 420668), F('gristi', 562191), F('Nightflame', 422513)], 0.4, -16),
    'attack.crit': ([F('velcronator', 733887)] + kr('impact', 'impactPlate_light', 3), 0.45, -14),
    'armor.leather': ([F('qubodup', 743265), F('qubodup', 743266)], 0.4, -15),
    'armor.metal': ([K('rpg', 'metalLatch.ogg'), K('rpg', 'beltHandle1.ogg'), K('rpg', 'beltHandle2.ogg'), K('rpg', 'metalClick.ogg')], 0.5, -15),
    'hit.fall': (kr('impact', 'impactSoft_heavy', 5), 0.45, -12),
    'hit.fallsmall': (kr('impact', 'impactSoft_medium', 5), 0.25, -13),
    'player.hurt': ([F('MrFossy', i) for i in (547203, 547202, 547201, 547209)], 0.5, -12),
    'player.eat': ([F('qubodup', 816237), F('qubodup', 816236), F('AntumDeluge', 584290), F('wadaltmon', 275015)], 0.4, -14),
    'player.burp': ([F('Sadiquecat', 814323)], 0.8, -15),
    'item.pop': ([F('quatricise', 789793)], 0.2, -14),
    'item.break': ([F('alegemaate', 364699)], 0.25, -12),
    # World.
    'fire.ignite': ([F('SamsterBirdies', 398977)], 0.7, -14),
    'fire.fizz': ([F('wubitog', 234782)], 1.2, -16),
    'tnt.fuse': ([F('j1987', 140715)], 2.2, -15),
    'tnt.explode': ([F('bevibeldesign', 366091), F('V-ktor', 482993)], 3.2, -9),
    'water.splash': ([F('qubodup', 737233), F('qubodup', 737234), F('rombart', 186748)], 0.8, -13),
    # Jumping or falling into water: a big splash (the one above is for buckets, items and the like).
    'water.enter': ([F('qubodup', 442773), F('SpliceSound', 260131, start=1.42), F('speedygonzo', 235725, start=5.75)], 1.5, -11),
    'water.swim': ([F('qubodup', 737232), F('qubodup', 737235)], 0.6, -16),
    'lava.pop': ([F('florianreichelt', 683100)], 1.2, -16),
    'weather.rain': ([F('dmk67', 392980)], 9.6, -18, {'loop': True}),
    'furnace.crackle': ([F('soundofsong', 650574)], 5.0, -17, {'loop': True}),
    # Animals and monsters.
    'pig.say': ([F('qubodup', i) for i in (442906, 442905, 442907)] + [F('JarredGibb', i) for i in (233169, 233170, 233172)], 1.1, -14),
    'pig.hurt': ([F('qubodup', 442904), F('JarredGibb', 233153)], 0.7, -13),
    'pig.death': ([F('JarredGibb', 233149)], 1.2, -13),
    'cow.say': ([F('JarredGibb', i) for i in (233128, 233129, 233127, 233130)], 2.2, -14),
    'cow.hurt': ([F('JarredGibb', i) for i in (233141, 233146)], 0.8, -13),
    'chicken.say': ([F('JarredGibb', i) for i in (233092, 233095, 233097)] + [F('MBPL', 668804)], 1.0, -15),
    'sheep.say': ([F('michaelperfect', i) for i in (710296, 710298, 710299, 710300)], 1.4, -14),
    'zombie.say': ([F('OwNathan', i) for i in (754438, 754439, 754440, 754441)] + [F('tonsil5', 555416)], 2.0, -14),
    'zombie.hurt': ([F('tonsil5', i) for i in (555421, 555422, 555425, 555426)], 0.8, -13),
    'zombie.death': ([F('tonsil5', i) for i in (555412, 555411)], 1.0, -13),
}


def fetch(url, dest):
    if os.path.exists(dest):
        return dest
    req = urllib.request.Request(url, headers={'User-Agent': 'blockhaven-sound-prep'})
    with urllib.request.urlopen(req, timeout=60) as r, open(dest + '.part', 'wb') as f:
        f.write(r.read())
    os.replace(dest + '.part', dest)
    return dest


def kenney_file(cache, pack, name):
    folder = os.path.join(cache, 'kenney-' + pack)
    if not os.path.isdir(folder):
        page = urllib.request.urlopen(urllib.request.Request(KENNEY[pack], headers={'User-Agent': 'x'}), timeout=60).read().decode()
        url = re.search(r'https://kenney\.nl/media/pages/assets/[^"]*\.zip', page)[0]
        data = urllib.request.urlopen(url, timeout=120).read()
        zipfile.ZipFile(io.BytesIO(data)).extractall(folder)
    for base, _, files in os.walk(folder):
        if name in files:
            return os.path.join(base, name), f'Kenney, {KENNEY[pack]}', 'CC0 1.0'
    raise FileNotFoundError(f'{pack}/{name}')


def freesound_file(cache, user, sid):
    meta_path = os.path.join(cache, f'fs-{sid}.json')
    if os.path.exists(meta_path):
        meta = json.load(open(meta_path))
    else:
        url = f'https://freesound.org/people/{urllib.parse.quote(user)}/sounds/{sid}/'
        page = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'x'}), timeout=60).read().decode()
        # The first licence named on the page is this sound's (later ones belong to related sounds).
        lic = re.search(r'(Creative Commons 0|Attribution NonCommercial[^<"]*|Attribution[^<"]*)', page)
        title = html.unescape(re.search(r'data-title="([^"]*)"', page)[1])
        mp3 = re.search(r'data-mp3="([^"]*)"', page)[1].replace('-lq.mp3', '-hq.mp3')
        meta = {'url': url, 'title': title, 'licence': lic[1] if lic else '?', 'mp3': mp3}
        json.dump(meta, open(meta_path, 'w'))
    if meta['licence'] != 'Creative Commons 0':
        raise SystemExit(f'Freesound {sid} is not CC0: {meta["licence"]}')
    path = fetch(meta['mp3'], os.path.join(cache, f'fs-{sid}.mp3'))
    return path, f'"{meta["title"]}" by {user}, {meta["url"]}', 'CC0 1.0'


def decode(path):
    raw = subprocess.run([FFMPEG, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def shape(x, max_s, target_db):
    peak = np.abs(x).max()
    if peak <= 0:
        raise ValueError('silent file')
    # Start just before the first real sound; end where it stays quiet, or at the length cap.
    loud = np.nonzero(np.abs(x) > peak * 0.04)[0]
    start = max(0, loud[0] - int(0.006 * SR))
    quiet = np.nonzero(np.abs(x) > peak * 0.012)[0]
    end = min(len(x), quiet[-1] + int(0.03 * SR), start + int(max_s * SR))
    y = x[start:end].astype(np.float64)
    fade_in = min(len(y), int(0.002 * SR))
    y[:fade_in] *= np.linspace(0, 1, fade_in)
    fade_out = min(len(y), max(int(0.025 * SR), int(len(y) * 0.12)))
    y[-fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
    # Loudness: loudest 50 ms window to the target, then keep the peak under -1 dBFS.
    win = int(0.05 * SR)
    energy = np.convolve(y * y, np.ones(win) / win, mode='valid') if len(y) > win else np.array([np.mean(y * y)])
    rms = np.sqrt(energy.max())
    y *= 10 ** (target_db / 20) / max(rms, 1e-9)
    y *= min(1.0, 10 ** (-1 / 20) / np.abs(y).max())
    return y.astype(np.float32)


def shape_loop(x, max_s, target_db):
    y = x[:int(max_s * SR)].astype(np.float64)
    y *= 10 ** (target_db / 20) / max(np.sqrt(np.mean(y * y)), 1e-9)
    y *= min(1.0, 10 ** (-1 / 20) / np.abs(y).max())
    return y.astype(np.float32)


def encode(y, dest):
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', '64k', '-ac', '1', dest], input=y.tobytes(), check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(ROOT, '.sound-cache'))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.mp3'):
            os.remove(os.path.join(OUT, f))
    credits = []
    total = 0
    for name, entry in CATALOG.items():
        sources, max_s, target = entry[:3]
        opts = entry[3] if len(entry) > 3 else {}
        for i, src in enumerate(sources, 1):
            if src[0] == 'kenney':
                path, who, lic = kenney_file(args.cache, src[1], src[2])
                who = f'{src[2]} from {who}'
            else:
                path, who, lic = freesound_file(args.cache, src[1], src[2])
            dest = os.path.join(OUT, f'{name}{i}.mp3')
            x = decode(path)
            if src[0] == 'freesound' and src[3]:
                x = x[int(src[3] * SR):]
            y = shape_loop(x, max_s, target) if opts.get('loop') else shape(x, max_s, target)
            encode(y, dest)
            total += os.path.getsize(dest)
            credits.append(f'| `{name}{i}` | {who} | {lic} |')
        print(f'{name}: {len(sources)}')
    with open(os.path.join(OUT, 'CREDITS.md'), 'w') as f:
        f.write('# Sound credits\n\nEvery sound here is public domain ([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)). '
                'They were trimmed, mixed to mono and loudness-matched by `tools/prepare_sounds.py`. '
                'Thanks to Kenney and the Freesound contributors listed below.\n\n'
                '| File | Source | Licence |\n| --- | --- | --- |\n' + '\n'.join(credits) + '\n')
    print(f'{len(credits)} files, {total / 1024:.0f} KB')


if __name__ == '__main__':
    sys.exit(main())
