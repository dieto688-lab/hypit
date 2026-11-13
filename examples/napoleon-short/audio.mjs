// mix voice-over + music into the rendered video
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const FF = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const clips = JSON.parse(process.argv[2]);
const video = process.argv[3];
const out = process.argv[4];

const probe = (f) => {
  const r = execFileSync(FF, ['-hide_banner', '-i', f], { stdio: ['ignore', 'pipe', 'pipe'] });
};
const durOf = (f) => {
  const p = spawn(FF, ['-hide_banner', '-i', f]);
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  return new Promise((res) => p.on('close', () => {
    const m = err.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    res(m ? +m[1] * 3600 + +m[2] * 60 + parseFloat(m[3]) : 0);
  }));
};

const total = await durOf(video);
const args = ['-y', '-hide_banner', '-loglevel', 'error'];
const filters = [];

// two-layer procedural bed: a low pulse and a soft metronome tick
args.push('-f', 'lavfi', '-i',
  `aevalsrc=0.10*sin(2*PI*55*t)+0.05*sin(2*PI*110*t)*gt(sin(2*PI*0.5*t)\\,0):s=48000:d=${total}`);
args.push('-f', 'lavfi', '-i',
  `aevalsrc=0.06*sin(2*PI*220*t)*pow(max(0\\,sin(2*PI*2*t))\\,8):s=48000:d=${total}`);
filters.push('[0:a][1:a]amix=inputs=2:weights=1 0.6,lowpass=f=900[musraw]');

// the bed is loud only while nobody is speaking
const speak = clips
  .filter((c) => c.file)
  .map((c) => `between(t,${c.start.toFixed(2)},${(c.start + c.dur + 0.5).toFixed(2)})`)
  .join('+');
const isVoice = speak || '0';
filters.push(`[musraw]volume='if(${isVoice},0.10,0.85)'[mus]`);

let idx = 2;
const labels = [];
for (const c of clips) {
  if (!c.file) continue;
  args.push('-i', c.file);
  const d = Math.round(c.start * 1000);
  filters.push(`[${idx}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${d}|${d},volume=1.0[v${idx}]`);
  labels.push(`[v${idx}]`);
  idx++;
}
filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0[vo]`);
filters.push(`[vo]apad[vop]`);
// keep the music low under the voice, bring it up in the gaps
filters.push(`[vop]asplit=2[vo1][vo2]`);
filters.push(`[mus][vo1]sidechaincompress=threshold=0.02:ratio=20:attack=15:release=320:makeup=1[duck]`);
filters.push(`[duck][vo2]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);
args.push('-i', video, '-filter_complex', filters.join(';'),
  '-map', `${idx}:v`, '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', out);
execFileSync(FF, args, { stdio: 'inherit' });
console.log('mixed ->', out);
