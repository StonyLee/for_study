'use strict';
/* 찍고 듣는 공부 메모 */

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* ---------- 데이터 ---------- */
const KEY = 'zzm-data-v1';
const DEFAULTS = { apiKey: '', voice: 'coral', speed: 1, readAnswer: true, pause: 4, loop: false };
let db = load();

function load() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(KEY)); } catch { }
  d = d && d.chapters ? d : { chapters: [] };
  d.settings = { ...DEFAULTS, ...(d.settings || {}) };
  return d;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { alert('저장 공간이 부족합니다.'); } }
const S = () => db.settings;
const chapterOf = id => db.chapters.find(c => c.id === id);

/* ---------- 화면 ---------- */
let view = { name: 'home' };
let review = null; // { chapterId, drafts:[{q,a}], editId }

function go(v) { view = v; render(); window.scrollTo(0, 0); }

function render() {
  const el = $('#view');
  if (view.name === 'home') el.innerHTML = homeHtml();
  else if (view.name === 'chapter') el.innerHTML = chapterHtml();
  else if (view.name === 'review') el.innerHTML = reviewHtml();
}

function homeHtml() {
  const list = db.chapters.map(c => `
    <div class="card" data-act="openChapter" data-id="${c.id}">
      <div class="grow"><div class="name">${esc(c.name)}</div><div class="sub">문제 ${c.items.length}개</div></div>
      <span>›</span>
    </div>`).join('');
  return `<div class="bar"><button class="primary" data-act="newChapter">＋ 새 챕터</button></div>
    ${list || '<p class="empty">챕터를 만들고 교재 사진을 찍어 추가해 보세요.</p>'}`;
}

function chapterHtml() {
  const ch = chapterOf(view.id);
  if (!ch) return go({ name: 'home' });
  const playing = player.active && player.chId === ch.id;
  const rows = ch.items.map((it, i) => `
    <div class="item ${playing && player.idx === i ? 'on' : ''}">
      <div class="no">${i + 1}</div>
      <div class="txt" data-act="playFrom" data-i="${i}">
        <div class="q">${esc(it.q)}</div>
        ${it.a ? `<div class="a">정답: ${esc(it.a)}</div>` : ''}
      </div>
      <div class="side">
        <button data-act="playFrom" data-i="${i}" class="primary" aria-label="여기부터 듣기">▶</button>
        <button data-act="editItem" data-id="${it.id}" aria-label="수정">✎</button>
      </div>
    </div>`).join('');
  return `<button class="back" data-act="home">‹ 챕터 목록</button>
    <h2>${esc(ch.name)}</h2>
    <div class="bar">
      <label class="btn primary">📷 사진으로 추가<input id="photo" type="file" accept="image/*" multiple hidden></label>
      <button data-act="addManual">✍ 직접 입력</button>
    </div>
    <div class="bar">
      <button data-act="renameChapter">이름 변경</button>
      <button data-act="delChapter" class="danger">챕터 삭제</button>
    </div>
    <p class="hint">듣고 싶은 문제의 ▶ 를 누르면 그 문제부터 챕터 끝까지 이어서 읽어줍니다.</p>
    ${rows || '<p class="empty">아직 문제가 없습니다.</p>'}`;
}

function reviewHtml() {
  const d = review.drafts.map((x, i) => `
    <div class="draft">
      <label>문제 ${i + 1}</label>
      <textarea data-i="${i}" data-f="q">${esc(x.q)}</textarea>
      <label>정답 / 해설</label>
      <textarea data-i="${i}" data-f="a">${esc(x.a)}</textarea>
      <div class="bar"><button class="danger" data-act="rmDraft" data-i="${i}">이 문제 삭제</button>
      ${review.editId ? '' : `<button data-act="splitDraft" data-i="${i}">문단 단위로 나누기</button>`}</div>
    </div>`).join('');
  return `<h2>${review.editId ? '문제 수정' : '인식 결과 확인'}</h2>
    <p class="hint">잘못 인식된 글자를 고친 뒤 저장하세요.</p>
    ${d}
    <div class="bar">${review.editId ? `<button class="danger" data-act="delItem">이 문제 삭제</button>` : '<button data-act="addDraft">＋ 문제 추가</button>'}</div>
    <div class="bar"><button data-act="cancelReview">취소</button><button class="primary" data-act="saveReview">저장</button></div>`;
}

/* ---------- 이벤트 ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const d = t.dataset;
  const ch = view.name === 'chapter' ? chapterOf(view.id) : null;
  switch (d.act) {
    case 'home': go({ name: 'home' }); break;
    case 'openChapter': go({ name: 'chapter', id: d.id }); break;
    case 'newChapter': {
      const name = prompt('챕터 이름');
      if (name && name.trim()) { const c = { id: uid(), name: name.trim(), items: [] }; db.chapters.push(c); save(); go({ name: 'chapter', id: c.id }); }
      break;
    }
    case 'renameChapter': {
      const name = prompt('챕터 이름', ch.name);
      if (name && name.trim()) { ch.name = name.trim(); save(); render(); }
      break;
    }
    case 'delChapter':
      if (confirm(`'${ch.name}' 챕터와 문제 ${ch.items.length}개를 삭제할까요?`)) {
        if (player.chId === ch.id) stopPlay();
        db.chapters = db.chapters.filter(c => c !== ch); save(); go({ name: 'home' });
      }
      break;
    case 'addManual': startReview(ch.id, [{ q: '', a: '' }]); break;
    case 'editItem': {
      const it = ch.items.find(x => x.id === d.id);
      startReview(ch.id, [{ q: it.q, a: it.a }], it.id);
      break;
    }
    case 'playFrom': startPlay(ch.id, +d.i); break;
    case 'addDraft': review.drafts.push({ q: '', a: '' }); render(); break;
    case 'rmDraft': review.drafts.splice(+d.i, 1); if (!review.drafts.length && !review.editId) review.drafts.push({ q: '', a: '' }); render(); break;
    case 'splitDraft': {
      const parts = splitText(review.drafts[+d.i].q);
      review.drafts.splice(+d.i, 1, ...parts.map(q => ({ q, a: '' })));
      render(); break;
    }
    case 'delItem': {
      const c = chapterOf(review.chapterId);
      if (confirm('이 문제를 삭제할까요?')) { c.items = c.items.filter(x => x.id !== review.editId); save(); go({ name: 'chapter', id: c.id }); }
      break;
    }
    case 'cancelReview': go({ name: 'chapter', id: review.chapterId }); break;
    case 'saveReview': saveReview(); break;
    case 'settings': openSettings(); break;
    case 'toggle': togglePlay(); break;
    case 'prev': skip(-1); break;
    case 'next': skip(1); break;
    case 'stop': stopPlay(); break;
  }
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.matches('textarea[data-f]')) review.drafts[+t.dataset.i][t.dataset.f] = t.value;
});

document.addEventListener('change', async e => {
  if (e.target.id !== 'photo') return;
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length) return;
  const chId = view.id;
  const drafts = [];
  try {
    for (let i = 0; i < files.length; i++) {
      busy(`사진 인식 중… (${i + 1}/${files.length})`);
      drafts.push(...await recognize(files[i]));
    }
  } catch (err) {
    busy(null);
    alert('사진 인식 실패: ' + err.message);
    return;
  }
  busy(null);
  startReview(chId, drafts.length ? drafts : [{ q: '', a: '' }]);
});

function startReview(chapterId, drafts, editId = null) {
  review = { chapterId, drafts, editId };
  go({ name: 'review' });
}

function saveReview() {
  const ch = chapterOf(review.chapterId);
  const ok = review.drafts.map(d => ({ q: d.q.trim(), a: d.a.trim() })).filter(d => d.q);
  if (review.editId) {
    const it = ch.items.find(x => x.id === review.editId);
    if (!ok.length) return alert('문제 내용을 입력하세요.');
    Object.assign(it, ok[0]);
  } else {
    ch.items.push(...ok.map(d => ({ id: uid(), ...d })));
  }
  save();
  go({ name: 'chapter', id: ch.id });
}

function busy(text) {
  $('#busy').hidden = text == null;
  if (text) $('#busyText').textContent = text;
}

/* ---------- 설정 ---------- */
function openSettings() {
  const s = S();
  $('#setKey').value = s.apiKey;
  $('#setVoice').value = s.voice;
  $('#setAnswer').checked = s.readAnswer;
  $('#setPause').value = s.pause;
  $('#setLoop').checked = s.loop;
  $('#settingsDlg').showModal();
}
$('#settingsDlg').addEventListener('close', () => {
  if ($('#settingsDlg').returnValue !== 'ok') return;
  Object.assign(S(), {
    apiKey: $('#setKey').value.trim(),
    voice: $('#setVoice').value,
    readAnswer: $('#setAnswer').checked,
    pause: Math.max(0, Math.min(30, +$('#setPause').value || 0)),
    loop: $('#setLoop').checked,
  });
  save();
});

/* ---------- 사진 → 텍스트 ---------- */
async function toDataUrl(file, max = 1800) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

async function recognize(file) {
  const url = await toDataUrl(file);
  return S().apiKey ? ocrOpenAI(url) : ocrTesseract(url);
}

async function ocrOpenAI(dataUrl) {
  const prompt = '이 이미지는 학습 교재의 한 페이지입니다. 문제와 정답/해설을 정확하게 텍스트로 옮기고 문제별로 나누세요. ' +
    '소리 내어 읽어줄 것이므로 문제 번호는 q에서 빼고, 수식이나 기호는 말로 읽기 좋게 풀어 쓰세요(예: x² → x 제곱). 보기(①②③…)는 q 안에 포함하세요. ' +
    '정답이나 해설이 없으면 a는 빈 문자열. 오직 JSON으로만 답하세요: {"items":[{"q":"...","a":"..."}]}';
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S().apiKey },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    }),
  });
  if (!r.ok) throw new Error(await apiError(r));
  const j = await r.json();
  const data = JSON.parse(j.choices[0].message.content);
  return (data.items || []).map(x => ({ q: String(x.q || ''), a: String(x.a || '') }));
}

let tessLoading;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  return tessLoading ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = res; s.onerror = () => rej(new Error('OCR 엔진을 불러오지 못했습니다. 인터넷 연결을 확인하세요.'));
    document.head.appendChild(s);
  });
}

async function ocrTesseract(dataUrl) {
  await loadTesseract();
  const { data } = await Tesseract.recognize(dataUrl, 'kor+eng');
  return splitText(data.text).map(q => ({ q, a: '' }));
}

// 번호(1. / 2) ) 또는 빈 줄 기준으로 문제를 나눔
function splitText(text) {
  const t = text.replace(/\r/g, '').trim();
  if (!t) return [''];
  let parts = t.split(/\n\s*(?=\d{1,3}\s*[.)]\s)/);
  if (parts.length < 2) parts = t.split(/\n\s*\n/);
  parts = parts.map(p => p.replace(/^\s*\d{1,3}\s*[.)]\s*/, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

async function apiError(r) {
  let m = '';
  try { m = (await r.json()).error?.message || ''; } catch { }
  return `${r.status} ${m}`.trim();
}

/* ---------- 소리내어 읽기 ---------- */
const audio = $('#audio');
const player = { active: false, paused: false, chId: null, idx: 0, loading: false };
let runId = 0;
let pending = null; // 현재 재생 중인 구간을 중단시키는 resolve 함수

const cloud = () => !!S().apiKey;

function hash(s) {
  let a = 5381, b = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = (a * 33) ^ c; b = (b * 31 + c) | 0; }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36) + s.length;
}

const urlCache = new Map();
function ttsUrl(text) {
  const key = S().voice + '|' + text;
  if (urlCache.has(key)) return urlCache.get(key);
  const p = (async () => {
    const reqKey = location.origin + '/__tts/' + hash(key);
    let store = null;
    try { store = window.caches ? await caches.open('zzm-tts') : null; } catch { }
    if (store) {
      const hit = await store.match(reqKey);
      if (hit) return URL.createObjectURL(await hit.blob());
    }
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S().apiKey },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice: S().voice,
        input: text,
        response_format: 'mp3',
        instructions: '따뜻하고 부드러운 한국어 선생님 말투로, 또박또박하지만 기계적이지 않고 자연스럽게 읽어주세요.',
      }),
    });
    if (!r.ok) throw new Error(await apiError(r));
    const blob = await r.blob();
    if (store) { try { await store.put(reqKey, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } })); } catch { } }
    return URL.createObjectURL(blob);
  })();
  urlCache.set(key, p);
  p.catch(() => urlCache.delete(key));
  return p;
}

const silenceCache = new Map();
function silenceUrl(sec) {
  if (silenceCache.has(sec)) return silenceCache.get(sec);
  const rate = 8000, n = Math.max(1, Math.round(rate * sec));
  const buf = new DataView(new ArrayBuffer(44 + n));
  const w = (o, s) => [...s].forEach((c, i) => buf.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); buf.setUint32(4, 36 + n, true); w(8, 'WAVEfmt '); buf.setUint32(16, 16, true);
  buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, rate, true); buf.setUint32(28, rate, true);
  buf.setUint16(32, 1, true); buf.setUint16(34, 8, true); w(36, 'data'); buf.setUint32(40, n, true);
  for (let i = 0; i < n; i++) buf.setUint8(44 + i, 128);
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  silenceCache.set(sec, url);
  return url;
}

let speedable = false; // 현재 재생 구간이 읽기(true)인지 쉬는 구간(false)인지
function playUrl(url, rate, isSpeech) {
  speedable = !!isSpeech;
  return new Promise(res => {
    pending = res;
    audio.onended = () => res('end');
    audio.onerror = () => res('error');
    audio.defaultPlaybackRate = rate;
    audio.src = url;
    audio.playbackRate = rate;
    audio.play().then(() => { audio.playbackRate = rate; }).catch(() => res('error'));
  });
}

let koVoice;
function pickKoVoice() {
  if (koVoice) return koVoice;
  const vs = speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('ko'));
  return koVoice = vs.find(v => /natural|google|online/i.test(v.name)) || vs[0] || null;
}

function speak(text) {
  return new Promise(res => {
    pending = res;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ko-KR'; u.rate = S().speed;
    const v = pickKoVoice(); if (v) u.voice = v;
    u.onend = () => res('end'); u.onerror = () => res('end');
    speechSynthesis.speak(u);
  });
}

function wait(sec) {
  return new Promise(res => { pending = res; setTimeout(() => res('end'), sec * 1000); });
}

async function playSegment(seg, token) {
  if (seg.pause) {
    if (cloud()) return playUrl(silenceUrl(seg.pause), 1);
    return wait(seg.pause);
  }
  if (cloud()) {
    player.loading = true; updatePlayer();
    const url = await ttsUrl(seg.text);
    player.loading = false;
    if (token !== runId) return 'abort';
    updatePlayer();
    return playUrl(url, S().speed, true);
  }
  return speak(seg.text);
}

function segmentsOf(it, i) {
  const segs = [{ text: `${i + 1}번. ${it.q}` }];
  if (S().readAnswer && it.a) {
    if (S().pause > 0) segs.push({ pause: S().pause });
    segs.push({ text: `정답. ${it.a}` });
  }
  segs.push({ pause: 1.5 });
  return segs;
}

function prefetch(it, i) {
  if (!cloud() || !it) return;
  segmentsOf(it, i).forEach(s => s.text && ttsUrl(s.text).catch(() => { }));
}

async function startPlay(chId, start) {
  stopPlay(true);
  const token = ++runId;
  Object.assign(player, { active: true, paused: false, chId, idx: start });
  $('#player').hidden = false;
  $('#speed').value = S().speed; $('#speedOut').textContent = S().speed.toFixed(2) + '×';
  setupMediaSession();
  updatePlayer();

  try {
    let i = start;
    while (token === runId) {
      const ch = chapterOf(chId);
      if (!ch) break;
      if (i >= ch.items.length) { if (S().loop && ch.items.length) i = 0; else break; }
      if (i < 0) i = 0;
      player.idx = i; updatePlayer(); refreshHighlight();
      const it = ch.items[i];
      prefetch(it, i); prefetch(ch.items[i + 1], i + 1);
      for (const seg of segmentsOf(it, i)) {
        if (token !== runId) return;
        const r = await playSegment(seg, token);
        if (token !== runId) return;
        if (r === 'error') throw new Error('재생 실패');
      }
      i++;
    }
  } catch (err) {
    if (token === runId) alert('읽기 오류: ' + err.message);
  }
  if (token === runId) stopPlay();
}

function interrupt() {
  try { audio.pause(); } catch { }
  try { speechSynthesis.cancel(); } catch { }
  if (pending) { const r = pending; pending = null; r('abort'); }
}

function stopPlay(silent) {
  runId++;
  interrupt();
  Object.assign(player, { active: false, paused: false, loading: false });
  if (!silent) { $('#player').hidden = true; refreshHighlight(); }
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'none';
}

function skip(d) {
  if (!player.active) return;
  const ch = chapterOf(player.chId);
  const next = Math.max(0, Math.min(ch.items.length - 1, player.idx + d));
  startPlay(player.chId, next);
}

function togglePlay() {
  if (!player.active) return;
  player.paused = !player.paused;
  if (cloud()) { player.paused ? audio.pause() : audio.play().catch(() => { }); }
  else { player.paused ? speechSynthesis.pause() : speechSynthesis.resume(); }
  updatePlayer();
}

function updatePlayer() {
  if (!player.active) return;
  const ch = chapterOf(player.chId);
  const it = ch && ch.items[player.idx];
  $('#nowTitle').textContent = `${ch ? ch.name : ''} · ${player.idx + 1}번`;
  $('#nowSub').textContent = player.loading ? '음성 불러오는 중…' : (it ? it.q : '');
  $('#btnToggle').textContent = player.paused ? '▶' : '⏸';
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({ title: `${player.idx + 1}번 문제`, artist: ch ? ch.name : '', album: '찍고 듣는 공부 메모' });
    navigator.mediaSession.playbackState = player.paused ? 'paused' : 'playing';
  }
}

function refreshHighlight() {
  if (view.name !== 'chapter') return;
  document.querySelectorAll('.item').forEach((el, i) => el.classList.toggle('on', player.active && player.chId === view.id && i === player.idx));
}

let msReady = false;
function setupMediaSession() {
  if (msReady || !('mediaSession' in navigator)) return;
  msReady = true;
  const set = (a, f) => { try { navigator.mediaSession.setActionHandler(a, f); } catch { } };
  set('play', () => player.paused && togglePlay());
  set('pause', () => !player.paused && togglePlay());
  set('nexttrack', () => skip(1));
  set('previoustrack', () => skip(-1));
}

$('#speed').addEventListener('input', e => {
  const v = +e.target.value;
  S().speed = v; save();
  $('#speedOut').textContent = v.toFixed(2) + '×';
  if (speedable) audio.playbackRate = v;
});

if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => { koVoice = null; };

/* ---------- 시작 ---------- */
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
