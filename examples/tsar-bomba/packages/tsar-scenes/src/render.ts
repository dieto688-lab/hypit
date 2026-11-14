import { sealVisualTrack } from "@hypit/composition";
import type { VisualElement } from "@hypit/composition";
import { htmlVisual } from "@hypit/html-program";
import type { FontStackRef } from "@hypit/media";
import type { Timeline } from "@hypit/timeline";
import type { SpatialFrame } from "@hypit/spatial";
import { assertTemporalWindowFor } from "@hypit/temporal";
import type { TemporalWindow } from "@hypit/temporal";

export type SceneData = { id: string; kind: string; caption: string; window: TemporalWindow };
export type ScenesOptions = { id: string; captionSize: number };

export const SCENE_KINDS = ["hook", "zar", "pressure", "blast", "rebound", "bravo", "finale"] as const;

type Phrase = { start: number; end: number };

function splitCaption(caption: string): string[] {
  const phrases = caption.split("||").map((part) => part.trim()).filter((part) => part.length > 0);
  if (phrases.length === 0) throw new Error("Scene caption must contain at least one phrase.");
  return phrases;
}

function phraseSpans(phrases: readonly string[], length: number): Phrase[] {
  const weights = phrases.map((phrase) => Math.max(1, phrase.length));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = 0;
  return phrases.map((_, index) => {
    const start = Math.round((cursor / total) * length);
    cursor += weights[index]!;
    const end = index === phrases.length - 1 ? length : Math.round((cursor / total) * length);
    return { start, end: Math.max(end, start + 1) };
  });
}

const CAPTION_TAIL = `
  let active=-1;
  data.phrases.forEach((p,i)=>{ if(frame>=p.start && frame<p.end) active=i; });
  caps.forEach((c,i)=>{ c.style.display = i===active ? 'block' : 'none'; });
`;

type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue };

type SceneBuild = {
  html: string;
  css: string;
  data: Record<string, JsonValue>;
  setup: string;
  texts: { id: string; text: string; size: number; color: string }[];
};

function captionDivs(sceneId: string, phrases: readonly string[]): string {
  return phrases.map((_, index) => `<div class="cap">{{${sceneId}-cap-${index}}}</div>`).join("");
}

function captionTexts(sceneId: string, phrases: readonly string[], size: number): SceneBuild["texts"] {
  return phrases.map((phrase, index) => ({ id: `${sceneId}-cap-${index}`, text: phrase, size, color: "#ffffff" }));
}

const SHELL_CSS = `
  :scope{overflow:hidden}
  .scene{position:absolute;inset:0}
  .bg{position:absolute;inset:0}
  .fx{position:absolute;inset:0;width:100%;height:100%}
  .art{position:absolute;inset:0}
  .caps{position:absolute;left:6%;right:6%;bottom:6.5%;text-align:center}
  .cap{display:none;text-shadow:0 3px 0 #000000,0 0 22px #000000cc}
`;

function buildHook(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div><canvas class="fx" width="${w}" height="${h}"></canvas>
    <div class="art">
      <div class="beam"></div>
      <div class="torp"><div class="nose"></div><div class="fins"></div></div>
      <svg class="rail" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        <line x1="980" y1="120" x2="980" y2="1800" stroke="#ffffff55" stroke-width="4"/>
        <line x1="940" y1="120" x2="1020" y2="120" stroke="#ffffff88" stroke-width="5"/>
        <line x1="940" y1="960" x2="1020" y2="960" stroke="#ffffff55" stroke-width="4"/>
        <line x1="940" y1="1800" x2="1020" y2="1800" stroke="#ffffff88" stroke-width="5"/>
      </svg>
      <div class="dtop">{{${sceneId}-dtop}}</div><div class="dmid">{{${sceneId}-dmid}}</div><div class="dbot">{{${sceneId}-dbot}}</div>
      <svg class="city" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        <rect x="0" y="1180" width="1080" height="740" fill="#0b1e3a"/>
        <g fill="#132c52">
          <rect x="40" y="900" width="150" height="1020"/><rect x="230" y="1020" width="130" height="900"/>
          <rect x="400" y="860" width="170" height="1060"/><rect x="610" y="980" width="140" height="940"/>
          <rect x="790" y="920" width="160" height="1000"/><rect x="980" y="1050" width="100" height="870"/>
        </g>
        <g fill="#ffd54a">
          <rect x="70" y="950" width="26" height="26"/><rect x="120" y="1010" width="26" height="26"/><rect x="70" y="1080" width="26" height="26"/>
          <rect x="260" y="1070" width="26" height="26"/><rect x="310" y="1140" width="26" height="26"/><rect x="440" y="920" width="26" height="26"/>
          <rect x="500" y="990" width="26" height="26"/><rect x="440" y="1060" width="26" height="26"/><rect x="640" y="1030" width="26" height="26"/>
          <rect x="820" y="980" width="26" height="26"/><rect x="880" y="1050" width="26" height="26"/><rect x="820" y="1120" width="26" height="26"/>
        </g>
        <path class="wave" d="M-200 1250 Q 150 950 420 1180 T 900 1120 L 1280 1250 L 1280 1920 L -200 1920 Z" fill="#1e6fd9" opacity="0.92"/>
        <path class="wave2" d="M-200 1320 Q 200 1060 480 1260 T 980 1200 L 1280 1320 L 1280 1920 L -200 1920 Z" fill="#3f9be8" opacity="0.75"/>
      </svg>
      <div class="qmark">{{${sceneId}-q}}</div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:linear-gradient(180deg,#7fc4e8 0%,#1a5f9e 18%,#0a2f5c 45%,#04142e 100%)}
    .beam{position:absolute;left:38%;top:0;width:24%;height:100%;background:linear-gradient(180deg,#ffffff33,transparent 70%)}
    .torp{position:absolute;left:44%;top:4%;width:12%;height:16%;background:#e63946;border-radius:60px 60px 24px 24px;box-shadow:0 0 40px #e6394688}
    .torp .nose{position:absolute;left:20%;top:-14%;width:60%;height:22%;background:#ff5a5f;border-radius:50% 50% 0 0}
    .torp .fins{position:absolute;left:-18%;bottom:-6%;width:136%;height:20%;background:#b91c2e;clip-path:polygon(0 100%,18% 0,82% 0,100% 100%)}
    .rail{position:absolute;inset:0;width:100%;height:100%}
    .dtop,.dmid,.dbot{position:absolute;right:4%;color:#cfe8ff;text-align:right}
    .dtop{top:4%}.dmid{top:47%}.dbot{top:78%}
    .city{position:absolute;inset:0;width:100%;height:100%;opacity:0}
    .qmark{position:absolute;left:0;top:22%;width:100%;text-align:center;color:#ffd54a;display:none;text-shadow:0 8px 0 #00000088}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const torp=root.querySelector('.torp'), beam=root.querySelector('.beam'),
      city=root.querySelector('.city'), q=root.querySelector('.qmark'),
      wave=root.querySelector('.wave'), wave2=root.querySelector('.wave2');
    const fx=root.querySelector('.fx').getContext('2d');
    const bubbles=data.bubbles;
    return frame=>{
      const p=frame/data.length;
      const phaseB=p>=0.55;
      torp.style.display=phaseB?'none':'block';
      beam.style.display=phaseB?'none':'block';
      city.style.opacity=phaseB?'1':'0';
      q.style.display=phaseB?'block':'none';
      if(!phaseB){
        const t=p/0.55;
        torp.style.top=(4+t*72)+'%';
        beam.style.opacity=String(1-t*0.5);
      } else {
        const t=(p-0.55)/0.45;
        const hit=t<0.25? t/0.25 : 1;
        const shake=t>0.25&&t<0.5? Math.sin(frame*1.4)*14*(1-(t-0.25)/0.25) : 0;
        wave.setAttribute('transform','translate('+(shake-260*(1-hit))+' 0)');
        wave2.setAttribute('transform','translate('+(shake*0.6-200*(1-hit))+' 0)');
        q.style.transform='scale('+(0.6+0.4*Math.min(1,Math.max(0,(t-0.3)/0.3)))+')';
      }
      fx.clearRect(0,0,data.w,data.h);
      fx.fillStyle='#ffffffaa';
      bubbles.forEach(b=>{
        const y=((b.y - frame*b.speed/data.length)%1+1)%1;
        fx.beginPath(); fx.arc(b.x*data.w, y*data.h, b.r, 0, 6.2832); fx.fill();
      });
      ${CAPTION_TAIL}
    };`;
  const bubbles = Array.from({ length: 26 }, (_, i) => ({
    x: ((i * 0.618) % 1) * 0.9 + 0.05,
    y: ((i * 0.754) % 1),
    speed: 0.25 + ((i * 0.37) % 1) * 0.5,
    r: 3 + ((i * 0.53) % 1) * 7,
  }));
  return {
    html, css,
    data: { length: 1, phrases: [], bubbles, w, h },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-dtop`, text: "0 m", size: 40, color: "#cfe8ff" },
      { id: `${sceneId}-dmid`, text: "5.500 m", size: 40, color: "#cfe8ff" },
      { id: `${sceneId}-dbot`, text: "11.000 m", size: 44, color: "#ffffff" },
      { id: `${sceneId}-q`, text: "?", size: 420, color: "#ffd54a" },
    ],
  };
}

function buildZar(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div><canvas class="fx" width="${w}" height="${h}"></canvas>
    <div class="art">
      <div class="torp"><div class="nose"></div><div class="fins"></div></div>
      <div class="card">
        <div class="ct">{{${sceneId}-title}}</div>
        <div class="cm">{{${sceneId}-mega}}</div>
        <div class="cr">{{${sceneId}-ratio}}</div>
      </div>
      <div class="dotslabel">{{${sceneId}-dots}}</div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:#05070d}
    .torp{position:absolute;left:22%;top:16%;width:56%;height:11%;background:#e63946;border-radius:120px;box-shadow:0 0 60px #e6394666}
    .torp .nose{position:absolute;right:-6%;top:8%;width:16%;height:84%;background:#ff5a5f;border-radius:0 120px 120px 0}
    .torp .fins{position:absolute;left:-4%;top:0;width:10%;height:100%;background:#b91c2e;clip-path:polygon(0 0,100% 22%,100% 78%,0 100%)}
    .card{position:absolute;left:12%;top:34%;width:76%;background:#ffffff10;border:3px solid #ffffff33;border-radius:28px;padding:5% 6%}
    .ct{color:#ffd54a;text-align:center}
    .cm{color:#ffffff;text-align:center;margin-top:2%}
    .cr{color:#7fc4e8;text-align:center;margin-top:2%}
    .dotslabel{position:absolute;left:0;top:62%;width:100%;text-align:center;color:#7fc4e8}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const torp=root.querySelector('.torp'), card=root.querySelector('.card'), dl=root.querySelector('.dotslabel');
    const fx=root.querySelector('.fx').getContext('2d');
    return frame=>{
      const p=frame/data.length;
      torp.style.transform='rotate('+(Math.sin(frame*0.02)*7)+'deg) scale('+(1+Math.sin(frame*0.05)*0.02)+')';
      const phaseB=p>=0.5;
      card.style.opacity=phaseB? String(Math.max(0,1-(p-0.5)/0.12)) : '1';
      dl.style.opacity=phaseB? '1':'0';
      fx.clearRect(0,0,data.w,data.h);
      if(phaseB){
        const t=(p-0.5)/0.5;
        const shown=Math.floor(t*data.dots.length);
        fx.fillStyle='#3f9be8';
        for(let i=0;i<shown;i++){ const d=data.dots[i]; fx.beginPath(); fx.arc(d.x*data.w, d.y*data.h, 5, 0, 6.2832); fx.fill(); }
      }
      ${CAPTION_TAIL}
    };`;
  const dots = Array.from({ length: 300 }, (_, i) => ({
    x: 0.08 + ((i % 25) / 25) * 0.84,
    y: 0.66 + Math.floor(i / 25) * 0.015,
  }));
  return {
    html, css,
    data: { length: 1, phrases: [], dots, w, h },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-title`, text: "BOMBA DEL ZAR", size: 56, color: "#ffd54a" },
      { id: `${sceneId}-mega`, text: "50 MEGATONES", size: 84, color: "#ffffff" },
      { id: `${sceneId}-ratio`, text: "3.000× HIROSHIMA", size: 52, color: "#7fc4e8" },
      { id: `${sceneId}-dots`, text: "3.000 HIROSHIMAS", size: 48, color: "#7fc4e8" },
    ],
  };
}

function buildPressure(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div>
    <div class="art">
      <svg class="trench" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        <polygon points="0,0 420,0 540,1920 0,1920" fill="#0d2038"/>
        <polygon points="1080,0 660,0 540,1920 1080,1920" fill="#0d2038"/>
        <g class="arrows" stroke="#ffffff" stroke-width="10" fill="none">
          <line x1="120" y1="300" x2="430" y2="560"/><line x1="960" y1="300" x2="650" y2="560"/>
          <line x1="60" y1="900" x2="430" y2="900"/><line x1="1020" y1="900" x2="650" y2="900"/>
          <line x1="120" y1="1500" x2="430" y2="1240"/><line x1="960" y1="1500" x2="650" y2="1240"/>
        </g>
      </svg>
      <div class="torp"><div class="nose"></div></div>
      <div class="x1000">{{${sceneId}-x}}</div>
      <div class="carwrap">
        <div class="finger"></div>
        <div class="car"><div class="carbody"></div><div class="wheel w1"></div><div class="wheel w2"></div><div class="window"></div></div>
        <div class="carlabel">{{${sceneId}-car}}</div>
      </div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:linear-gradient(180deg,#0a2f5c,#04142e)}
    .trench{position:absolute;inset:0;width:100%;height:100%}
    .torp{position:absolute;left:42%;top:38%;width:16%;height:20%;background:#e63946;border-radius:80px 80px 30px 30px;box-shadow:0 0 50px #e6394688}
    .torp .nose{position:absolute;left:22%;top:-10%;width:56%;height:18%;background:#ff5a5f;border-radius:50% 50% 0 0}
    .x1000{position:absolute;left:0;top:8%;width:100%;text-align:center;color:#ffffff}
    .carwrap{position:absolute;inset:0;display:none;background:linear-gradient(180deg,#3a0d12,#1a0508)}
    .finger{position:absolute;left:30%;top:52%;width:40%;height:22%;background:#e8b08a;border-radius:120px 120px 40px 40px}
    .car{position:absolute;left:18%;top:22%;width:64%;height:20%}
    .carbody{position:absolute;left:0;top:30%;width:100%;height:55%;background:#e63946;border-radius:40px 60px 20px 20px}
    .window{position:absolute;left:30%;top:8%;width:40%;height:32%;background:#bfe3ff;border-radius:30px 30px 10px 10px}
    .wheel{position:absolute;top:72%;width:14%;height:30%;background:#111;border-radius:50%}
    .w1{left:12%}.w2{right:12%}
    .carlabel{position:absolute;left:8%;top:80%;width:84%;text-align:center;color:#ffd54a}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const arrows=root.querySelector('.arrows'), car=root.querySelector('.carwrap'),
      trench=root.querySelector('.trench'), torp=root.querySelector('.torp'), x=root.querySelector('.x1000');
    return frame=>{
      const p=frame/data.length;
      const phaseB=p>=0.6;
      car.style.display=phaseB?'block':'none';
      trench.style.display=phaseB?'none':'block';
      torp.style.display=phaseB?'none':'block';
      x.style.display=phaseB?'none':'block';
      if(!phaseB){
        const pulse=1+Math.sin(frame*0.12)*0.05;
        arrows.setAttribute('transform','scale('+pulse+' 1)');
        arrows.style.opacity=String(0.7+Math.sin(frame*0.12)*0.3);
      }
      ${CAPTION_TAIL}
    };`;
  return {
    html, css,
    data: { length: 1, phrases: [] },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-x`, text: "×1.000 PRESIÓN", size: 64, color: "#ffffff" },
      { id: `${sceneId}-car`, text: "COMO UN AUTO SOBRE TU UÑA", size: 52, color: "#ffd54a" },
    ],
  };
}

function buildBlast(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div><canvas class="fx" width="${w}" height="${h}"></canvas>
    <div class="art">
      <div class="fire"></div>
      <div class="core"></div>
      <svg class="timer" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="84" fill="none" stroke="#ffffff33" stroke-width="10"/>
        <circle class="ring" cx="100" cy="100" r="84" fill="none" stroke="#ffd54a" stroke-width="10" stroke-dasharray="528" stroke-dashoffset="528" transform="rotate(-90 100 100)"/>
      </svg>
      <div class="tlabel">{{${sceneId}-timer}}</div>
      <div class="blabel">{{${sceneId}-bubble}}</div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:radial-gradient(circle at 50% 45%,#123a66 0%,#04142e 70%)}
    .fire{position:absolute;left:15%;top:18%;width:70%;height:42%;border-radius:50%;
      background:radial-gradient(circle,#ffffff 0%,#ffd54a 28%,#ff8c1a 55%,#e63946 80%,transparent 100%);
      box-shadow:0 0 120px #ff8c1a}
    .core{position:absolute;left:47%;top:34%;width:6%;height:5%;border-radius:50%;background:#ffffff;box-shadow:0 0 60px #ffd54a}
    .timer{position:absolute;left:38%;top:64%;width:24%;height:14%}
    .tlabel{position:absolute;left:0;top:66%;width:100%;text-align:center;color:#ffd54a}
    .blabel{position:absolute;left:0;top:80%;width:100%;text-align:center;color:#7fc4e8}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const fire=root.querySelector('.fire'), core=root.querySelector('.core'),
      ring=root.querySelector('.ring'), timer=root.querySelector('.timer'),
      tl=root.querySelector('.tlabel'), bl=root.querySelector('.blabel');
    const fx=root.querySelector('.fx').getContext('2d');
    return frame=>{
      const p=frame/data.length;
      if(p<0.3){
        const t=p/0.3;
        fire.style.transform='scale('+(0.15+0.85*t)+')';
        fire.style.opacity='1';
        core.style.transform='scale('+(0.5+t)+')';
        timer.style.opacity='0'; tl.style.opacity='0';
      } else {
        const t=(p-0.3)/0.7;
        const crush=Math.min(1,t/0.12);
        const s=1-crush*0.97;
        fire.style.transform='scale('+s+')';
        fire.style.opacity=String(1-crush*0.85);
        const pulse=1+Math.sin(frame*0.3)*0.15;
        core.style.transform='scale('+(0.4*pulse)+')';
        timer.style.opacity='1'; tl.style.opacity='1';
        ring.setAttribute('stroke-dashoffset', String(528*(1-Math.min(1,t*1.4))));
      }
      bl.style.opacity=p>=0.3?'1':'0';
      fx.clearRect(0,0,data.w,data.h);
      fx.fillStyle='#ffffff88';
      data.bubbles.forEach(b=>{
        const y=((b.y - frame*b.speed/data.length)%1+1)%1;
        fx.beginPath(); fx.arc(b.x*data.w, y*data.h, b.r, 0, 6.2832); fx.fill();
      });
      ${CAPTION_TAIL}
    };`;
  const bubbles = Array.from({ length: 30 }, (_, i) => ({
    x: ((i * 0.618) % 1) * 0.9 + 0.05,
    y: ((i * 0.754) % 1),
    speed: 0.3 + ((i * 0.37) % 1) * 0.6,
    r: 3 + ((i * 0.53) % 1) * 8,
  }));
  return {
    html, css,
    data: { length: 1, phrases: [], bubbles, w, h },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-timer`, text: "2 s", size: 56, color: "#ffd54a" },
      { id: `${sceneId}-bubble`, text: "BURBUJA DE 1 KM", size: 48, color: "#7fc4e8" },
    ],
  };
}

function buildRebound(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div><canvas class="fx" width="${w}" height="${h}"></canvas>
    <div class="art">
      <div class="bubble"></div>
      <svg class="glass" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        <polygon points="0,1500 200,1400 420,1520 640,1420 860,1540 1080,1440 1080,1920 0,1920" fill="#7b4fd0" opacity="0.85"/>
        <polygon points="0,1620 260,1540 520,1640 780,1560 1080,1660 1080,1920 0,1920" fill="#e86a2a" opacity="0.8"/>
      </svg>
      <svg class="globe" viewBox="0 0 400 400">
        <circle cx="200" cy="200" r="170" fill="#1e6fd9"/>
        <ellipse cx="200" cy="200" rx="170" ry="60" fill="none" stroke="#7fc4e8" stroke-width="4"/>
        <ellipse cx="200" cy="200" rx="60" ry="170" fill="none" stroke="#7fc4e8" stroke-width="4"/>
        <circle class="ring1" cx="200" cy="200" r="180" fill="none" stroke="#7ddb6a" stroke-width="6"/>
        <circle class="ring2" cx="200" cy="200" r="180" fill="none" stroke="#7ddb6a" stroke-width="6"/>
      </svg>
      <svg class="sea" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        <rect x="0" y="0" width="1080" height="900" fill="#081a33"/>
        <g fill="#ffffff"><circle cx="120" cy="120" r="4"/><circle cx="300" cy="200" r="3"/><circle cx="520" cy="90" r="4"/><circle cx="760" cy="160" r="3"/><circle cx="940" cy="110" r="4"/><circle cx="200" cy="320" r="3"/><circle cx="880" cy="300" r="3"/></g>
        <rect x="0" y="900" width="1080" height="1020" fill="#0a2f5c"/>
        <path class="hump" d="M340 900 Q 540 780 740 900 L 740 960 L 340 960 Z" fill="#1e6fd9"/>
        <g class="boat"><rect x="470" y="830" width="140" height="26" rx="8" fill="#e8e8e8"/><rect x="510" y="790" width="60" height="44" fill="#c9d6e3"/></g>
        <ellipse class="vapor" cx="540" cy="760" rx="90" ry="46" fill="#ffffff" opacity="0.7"/>
      </svg>
      <div class="crossed"><span class="cw">{{${sceneId}-w1}}</span><span class="cw">{{${sceneId}-w2}}</span><span class="cw">{{${sceneId}-w3}}</span></div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:linear-gradient(180deg,#0a2f5c,#04142e)}
    .bubble{position:absolute;left:32%;top:60%;width:36%;height:22%;border-radius:50%;
      background:radial-gradient(circle at 35% 30%,#ffffff55,#7fc4e833 60%,transparent);
      border:4px solid #7fc4e8aa}
    .glass{position:absolute;inset:0;width:100%;height:100%;display:none}
    .globe{position:absolute;left:30%;top:18%;width:40%;height:22%;display:none}
    .sea{position:absolute;inset:0;width:100%;height:100%;display:none}
    .crossed{position:absolute;left:0;top:8%;width:100%;text-align:center;display:none}
    .cw{display:inline-block;margin:0 3%;color:#ffffff;text-decoration:line-through #e63946;text-decoration-thickness:8px}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const bubble=root.querySelector('.bubble'), glass=root.querySelector('.glass'),
      globe=root.querySelector('.globe'), sea=root.querySelector('.sea'),
      crossed=root.querySelector('.crossed'), hump=root.querySelector('.hump'),
      vapor=root.querySelector('.vapor'), boat=root.querySelector('.boat'),
      ring1=root.querySelector('.ring1'), ring2=root.querySelector('.ring2');
    const fx=root.querySelector('.fx').getContext('2d');
    return frame=>{
      const p=frame/data.length;
      const phaseA=p<0.35, phaseB=p>=0.35&&p<0.6, phaseC=p>=0.6;
      bubble.style.display=phaseA?'block':'none';
      glass.style.display=phaseB?'block':'none';
      globe.style.display=phaseB?'block':'none';
      sea.style.display=phaseC?'block':'none';
      crossed.style.display=phaseC?'block':'none';
      if(phaseA){
        const t=p/0.35;
        const osc=1+Math.sin(frame*0.25)*0.18;
        bubble.style.top=(60-t*38)+'%';
        bubble.style.transform='scale('+osc+')';
      }
      if(phaseB){
        const t=(p-0.35)/0.25;
        const r1=180+((frame*2)%140), r2=180+(((frame+40)*2)%140);
        ring1.setAttribute('r', String(Math.min(340,r1)));
        ring2.setAttribute('r', String(Math.min(340,r2)));
        ring1.style.opacity=String(1-(r1-180)/140);
        ring2.style.opacity=String(1-(r2-180)/140);
        globe.style.transform='rotate('+(frame*0.4)+'deg)';
      }
      if(phaseC){
        const t=(p-0.6)/0.4;
        hump.setAttribute('transform','scale(1 '+(0.4+0.6*Math.min(1,t*2))+')');
        vapor.setAttribute('opacity', String(Math.max(0,0.7-t*0.5)));
        vapor.setAttribute('transform','translate(0 '+(-t*120)+') scale('+(1+t*1.2)+' '+(1+t*0.6)+')');
        boat.setAttribute('transform','translate(0 '+(Math.sin(frame*0.08)*6)+')');
      }
      fx.clearRect(0,0,data.w,data.h);
      if(phaseB){
        const t=(p-0.35)/0.25;
        fx.strokeStyle='#e63946'; fx.lineWidth=6; fx.beginPath();
        for(let x=0;x<=data.w;x+=8){
          const spike=Math.exp(-Math.pow((x/data.w-0.55)/0.06,2))*220*Math.min(1,t*2);
          const y=data.h*0.86 - spike + Math.sin(x*0.05+frame*0.2)*4;
          if(x===0) fx.moveTo(x,y); else fx.lineTo(x,y);
        }
        fx.stroke();
      }
      ${CAPTION_TAIL}
    };`;
  return {
    html, css,
    data: { length: 1, phrases: [], w, h },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-w1`, text: "hongo", size: 56, color: "#ffffff" },
      { id: `${sceneId}-w2`, text: "estruendo", size: 56, color: "#ffffff" },
      { id: `${sceneId}-w3`, text: "tsunami", size: 56, color: "#ffffff" },
    ],
  };
}

function buildBravo(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div><canvas class="fx" width="${w}" height="${h}"></canvas>
    <div class="art">
      <div class="pair">
        <div class="big"><div class="nose"></div></div>
        <div class="small"><div class="nose"></div></div>
        <div class="x3">{{${sceneId}-x3}}</div>
      </div>
      <svg class="island" viewBox="0 0 1080 1920" preserveAspectRatio="none">
        <ellipse cx="540" cy="1500" rx="380" ry="90" fill="#e8d5a8"/>
        <g stroke="#2e7d32" stroke-width="12" fill="none"><path d="M420 1500 Q 400 1380 360 1330"/><path d="M660 1500 Q 680 1380 720 1330"/></g>
        <g fill="#43a047"><ellipse cx="350" cy="1320" rx="70" ry="18"/><ellipse cx="730" cy="1320" rx="70" ry="18"/></g>
        <g class="mushroom">
          <ellipse cx="540" cy="1250" rx="120" ry="60" fill="#ff8c1a"/>
          <ellipse cx="540" cy="1150" rx="180" ry="80" fill="#e86a2a"/>
          <ellipse cx="540" cy="1030" rx="240" ry="90" fill="#c9d6e3"/>
          <ellipse cx="540" cy="900" rx="200" ry="80" fill="#9fb2c8"/>
          <rect x="500" y="1250" width="80" height="250" fill="#e86a2a"/>
        </g>
        <line x1="980" y1="1500" x2="980" y2="400" stroke="#ffffff55" stroke-width="4"/>
      </svg>
      <div class="hlabel">{{${sceneId}-h}}</div>
      <div class="map">
        <div class="dot d1"></div><div class="dot d2"></div>
        <div class="cloud"></div>
        <svg class="path" viewBox="0 0 1080 600" preserveAspectRatio="none"><path d="M200 300 Q 540 120 880 300" fill="none" stroke="#ffffff88" stroke-width="5" stroke-dasharray="18 14"/></svg>
        <div class="m1">{{${sceneId}-m1}}</div><div class="m2">{{${sceneId}-m2}}</div>
      </div>
      <div class="people">
        <div class="person p1"><div class="head"></div></div><div class="person p2"><div class="head"></div></div><div class="person p3"><div class="head"></div></div><div class="person p4"><div class="head"></div></div>
        <div class="fboat"><div class="fb-body"></div></div>
      </div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:linear-gradient(180deg,#0a2f5c,#04142e)}
    .pair{position:absolute;inset:0}
    .big{position:absolute;left:14%;top:20%;width:34%;height:10%;background:#e63946;border-radius:100px}
    .small{position:absolute;left:60%;top:34%;width:16%;height:5%;background:#3f9be8;border-radius:100px}
    .big .nose,.small .nose{position:absolute;right:-5%;top:10%;width:14%;height:80%;background:#ffffff88;border-radius:0 100px 100px 0}
    .x3{position:absolute;left:0;top:48%;width:100%;text-align:center;color:#ffd54a}
    .island{position:absolute;inset:0;width:100%;height:100%;display:none}
    .hlabel{position:absolute;right:3%;top:18%;color:#ffffff;display:none}
    .map{position:absolute;left:6%;top:14%;width:88%;height:34%;background:#0d3a66;border-radius:24px;display:none}
    .dot{position:absolute;width:34px;height:34px;border-radius:50%;background:#e8d5a8}
    .d1{left:12%;top:44%}.d2{right:12%;top:44%}
    .cloud{position:absolute;left:20%;top:38%;width:22%;height:16%;background:#9fb2c8;border-radius:50%;opacity:0.9}
    .path{position:absolute;inset:0;width:100%;height:100%}
    .m1{position:absolute;left:0;top:6%;width:100%;text-align:center;color:#ffffff}
    .m2{position:absolute;left:0;top:78%;width:100%;text-align:center;color:#ffd54a}
    .people{position:absolute;inset:0;display:none}
    .person{position:absolute;top:52%;width:12%;height:16%;background:#e8b08a;border-radius:60px 60px 20px 20px}
    .person .head{position:absolute;left:22%;top:-38%;width:56%;height:42%;background:#e8b08a;border-radius:50%}
    .p1{left:10%}.p2{left:30%}.p3{left:50%}.p4{left:70%}
    .fboat{position:absolute;left:24%;top:74%;width:52%;height:10%;background:#c9d6e3;border-radius:20px}
    .fb-body{position:absolute;left:20%;top:-40%;width:60%;height:50%;background:#8fa8c0;border-radius:16px}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const pair=root.querySelector('.pair'), island=root.querySelector('.island'),
      hl=root.querySelector('.hlabel'), map=root.querySelector('.map'),
      people=root.querySelector('.people'), cloud=root.querySelector('.cloud'),
      mush=root.querySelector('.mushroom');
    const fx=root.querySelector('.fx').getContext('2d');
    return frame=>{
      const p=frame/data.length;
      const phaseA=p<0.3, phaseB=p>=0.3&&p<0.65, phaseC=p>=0.65;
      pair.style.display=phaseA?'block':'none';
      island.style.display=phaseB?'block':'none';
      hl.style.display=phaseB?'block':'none';
      map.style.display=phaseC?'block':'none';
      people.style.display=phaseC?'block':'none';
      if(phaseB){
        const t=(p-0.3)/0.35;
        const s=0.2+0.8*Math.min(1,t*1.5);
        mush.setAttribute('transform','translate(540 1500) scale(1 '+s+') translate(-540 -1500)');
      }
      if(phaseC){
        const t=(p-0.65)/0.35;
        cloud.style.left=(20+t*55)+'%';
        cloud.style.opacity=String(0.4+0.6*t);
      }
      fx.clearRect(0,0,data.w,data.h);
      if(phaseB||phaseC){
        fx.fillStyle='#ffd54a';
        data.ash.forEach(a=>{
          const y=((a.y + frame*a.speed/data.length)%1+1)%1;
          fx.beginPath(); fx.arc(a.x*data.w, y*data.h, a.r, 0, 6.2832); fx.fill();
        });
      }
      ${CAPTION_TAIL}
    };`;
  const ash = Array.from({ length: 40 }, (_, i) => ({
    x: ((i * 0.618) % 1),
    y: ((i * 0.754) % 1),
    speed: 0.2 + ((i * 0.37) % 1) * 0.4,
    r: 3 + ((i * 0.53) % 1) * 5,
  }));
  return {
    html, css,
    data: { length: 1, phrases: [], ash, w, h },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-x3`, text: "×3 MÁS CHICA", size: 60, color: "#ffd54a" },
      { id: `${sceneId}-h`, text: "35 km", size: 52, color: "#ffffff" },
      { id: `${sceneId}-m1`, text: "5 HORAS", size: 52, color: "#ffffff" },
      { id: `${sceneId}-m2`, text: "177 KM", size: 60, color: "#ffd54a" },
    ],
  };
}

function buildFinale(sceneId: string, phrases: readonly string[], size: number, w: number, h: number): SceneBuild {
  const html = `<div class="scene"><div class="bg"></div>
    <div class="art">
      <div class="chart">
        <div class="bar b1"></div><div class="bar b2"></div>
        <div class="bl1">{{${sceneId}-b1}}</div><div class="bl2">{{${sceneId}-b2}}</div>
      </div>
      <svg class="earth" viewBox="0 0 500 500">
        <circle cx="250" cy="250" r="220" fill="#1e6fd9"/>
        <g class="land" fill="#43a047">
          <ellipse cx="180" cy="180" rx="90" ry="60"/><ellipse cx="320" cy="300" rx="100" ry="70"/><ellipse cx="260" cy="120" rx="60" ry="40"/>
        </g>
        <ellipse cx="250" cy="250" rx="220" ry="80" fill="none" stroke="#7fc4e8" stroke-width="5"/>
      </svg>
      <div class="shield">{{${sceneId}-shield}}</div>
    </div>
    <div class="caps">${captionDivs(sceneId, phrases)}</div></div>`;
  const css = SHELL_CSS + `
    .bg{background:radial-gradient(circle at 50% 30%,#123a66 0%,#050b18 75%)}
    .chart{position:absolute;left:10%;top:16%;width:80%;height:52%}
    .bar{position:absolute;bottom:18%;width:30%;transform-origin:bottom}
    .b1{left:8%;height:26%;background:#3f9be8;border-radius:16px 16px 0 0}
    .b2{right:8%;height:88%;background:#e63946;border-radius:16px 16px 0 0}
    .bl1{position:absolute;left:0;bottom:2%;width:44%;text-align:center;color:#7fc4e8}
    .bl2{position:absolute;right:0;bottom:2%;width:44%;text-align:center;color:#ff8a94}
    .earth{position:absolute;left:25%;top:14%;width:50%;height:28%;display:none}
    .shield{position:absolute;left:8%;top:52%;width:84%;text-align:center;color:#ffffff;display:none}
  `;
  const setup = `
    const caps=[...root.querySelectorAll('.cap')];
    const chart=root.querySelector('.chart'), b1=root.querySelector('.b1'), b2=root.querySelector('.b2'),
      earth=root.querySelector('.earth'), shield=root.querySelector('.shield'), land=root.querySelector('.land');
    return frame=>{
      const p=frame/data.length;
      const phaseB=p>=0.5;
      chart.style.display=phaseB?'none':'block';
      earth.style.display=phaseB?'block':'none';
      shield.style.display=phaseB?'block':'none';
      if(!phaseB){
        const t=p/0.5;
        b1.style.transform='scaleY('+(0.2+0.8*Math.min(1,t*1.6))+')';
        b2.style.transform='scaleY('+(0.2+0.8*Math.min(1,t*1.6))+')';
      } else {
        land.setAttribute('transform','rotate('+(frame*0.5)+' 250 250)');
      }
      ${CAPTION_TAIL}
    };`;
  return {
    html, css,
    data: { length: 1, phrases: [] },
    setup,
    texts: [
      ...captionTexts(sceneId, phrases, size),
      { id: `${sceneId}-b1`, text: "GIGANTE EN EL FONDO", size: 40, color: "#7fc4e8" },
      { id: `${sceneId}-b2`, text: "CHICA EN LA ISLA", size: 40, color: "#ff8a94" },
      { id: `${sceneId}-shield`, text: "EL AGUA ES EL MEJOR ESCUDO DEL PLANETA", size: 60, color: "#ffffff" },
    ],
  };
}

const BUILDERS: Record<string, (sceneId: string, phrases: readonly string[], size: number, w: number, h: number) => SceneBuild> = {
  hook: buildHook,
  zar: buildZar,
  pressure: buildPressure,
  blast: buildBlast,
  rebound: buildRebound,
  bravo: buildBravo,
  finale: buildFinale,
};

/** Seven authored scenes; timing arrives as absolute windows, captions as phrases. */
export function renderScenes(timeline: Timeline, within: SpatialFrame, window: TemporalWindow,
  font: FontStackRef, scenes: readonly SceneData[], options: ScenesOptions) {
  assertTemporalWindowFor(window, { subjectId: options.id, timeline: timeline });
  if (!Number.isSafeInteger(options.captionSize) || options.captionSize < 20 || options.captionSize > 120) {
    throw new Error("caption-size must be an integer between 20 and 120.");
  }
  if (scenes.length === 0) throw new Error("Scenes requires at least one Scene.");
  const fps = timeline.frameRate.numerator / timeline.frameRate.denominator;
  let order = 0;
  const text = (id: string, value: string, size: number, color: string): VisualElement => ({
    id, kind: "text", parent: "scene", order: ++order, text: value, fonts: font.faces,
    style: [{ name: "font-size", value: `${size}px` }, { name: "line-height", value: 1.25 }, { name: "color", value: color }],
  });
  const presents = scenes.map((scene, index) => {
    assertTemporalWindowFor(scene.window, { subjectId: scene.id, timeline: timeline });
    if (scene.window.span.startFrame < window.span.startFrame || scene.window.span.endFrameExclusive > window.span.endFrameExclusive) {
      throw new Error(`Scene ${scene.id} must appear inside the Scenes window.`);
    }
    const builder = BUILDERS[scene.kind];
    if (builder === undefined) throw new Error(`Unknown scene kind ${scene.kind}.`);
    const phrases = splitCaption(scene.caption);
    const length = scene.window.span.endFrameExclusive - scene.window.span.startFrame;
    const build = builder(scene.id, phrases, options.captionSize, within.widthPx, within.heightPx);
    build.data.length = length;
    build.data.fps = fps;
    build.data.phrases = phraseSpans(phrases, length);
    const program = htmlVisual({ html: build.html, css: build.css, data: build.data, setup: build.setup });
    return {
      id: scene.id,
      order: index,
      z: 0,
      span: scene.window.span,
      elements: [
        {
          id: "scene",
          kind: "program" as const,
          order: 0,
          program,
          style: [
            { name: "position", value: "absolute" },
            { name: "left", value: `${within.xPx}px` },
            { name: "top", value: `${within.yPx}px` },
            { name: "width", value: `${within.widthPx}px` },
            { name: "height", value: `${within.heightPx}px` },
          ],
        },
        ...build.texts.map((entry) => text(entry.id, entry.text, entry.size, entry.color)),
      ],
    };
  });
  return sealVisualTrack({
    id: options.id,
    timelineId: timeline.id,
    visualIr: "hypit.visual-ir@1",
    presents,
  });
}
