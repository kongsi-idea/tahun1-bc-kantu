/* 看图小侦探 —— 题库在 bank.json，朗读词在 say.json；改了两者都要重跑 gen-voice.py */
(() => {
  'use strict';

  const SLOTS = [
    { k: 'time', name: '时间' },
    { k: 'who', name: '人物' },
    { k: 'place', name: '地点' },
    { k: 'act', name: '做什么' },
  ];
  const NAME = Object.fromEntries(SLOTS.map(s => [s.k, s.name]));
  const ROUND_SIZE = 6;

  const $ = s => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const shuffle = a => {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [b[i], b[j]] = [b[j], b[i]];
    }
    return b;
  };
  const sentence = (t, w, p, a) => `${t}，${w}在${p}${a}。`;   // 跟 gen-voice.py 一致

  let BANK = [], SAY = {};
  const S = {
    level: 1,
    mode: 'random',        // random：随机一轮；pick：自己选题
    queue: [], idx: 0,
    results: {},           // id → 星数（本次开启期间）
    roundStars: [],
    q: null, cards: [], slots: {}, locked: {}, errors: 0, busy: false,
  };

  /* ---------------- 声音 ---------------- */
  function clipKey(text) {
    let h = 0x811c9dc5;
    for (const b of new TextEncoder().encode(text)) {
      h ^= b;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  }
  let current = null, playToken = 0;
  function stopVoice() {
    playToken++;
    if (current) { current.pause(); current = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }
  function fallbackVoice() {
    const vs = speechSynthesis.getVoices().filter(v => /^zh/i.test(v.lang) &&
      !/Eddy|Grandpa|Grandma|Flo|Reed|Rocko|Sandy|Shelley/i.test(v.name));
    return vs.find(v => /Xiaoxiao|Tingting|Meijia|Huihui|Yaoyao/i.test(v.name)) || vs[0] || null;
  }
  function sayOne(text, token) {
    return new Promise(resolve => {
      if (token !== playToken) return resolve();
      const key = clipKey(text);
      if (window.VOICE_CLIPS && window.VOICE_CLIPS[key]) {
        const a = new Audio(`audio/${key}.mp3`);
        current = a;
        a.onended = a.onerror = () => resolve();
        a.play().catch(() => resolve());
      } else if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN'; u.rate = .85;
        const v = fallbackVoice(); if (v) u.voice = v;
        u.onend = u.onerror = () => resolve();
        speechSynthesis.speak(u);
      } else resolve();
    });
  }
  async function say(...texts) {
    stopVoice();
    const token = playToken;
    for (const t of texts) {
      if (token !== playToken) return;
      await sayOne(t, token);
    }
  }

  // 音效用 WebAudio 合成，不占档案
  let actx = null;
  function tone(freq, dur, type = 'sine', vol = .12, when = 0) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = actx.currentTime + when;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + .01);
      g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g).connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + .02);
    } catch (_) { /* 没有声音也能玩 */ }
  }
  const sfx = {
    pick: () => tone(620, .08, 'triangle', .08),
    drop: () => { tone(300, .1, 'triangle', .14); tone(180, .12, 'sine', .1); },
    bad: () => { tone(220, .18, 'square', .05); tone(185, .22, 'square', .05, .12); },
    good: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, .22, 'triangle', .1, i * .09)),
    stamp: () => { tone(90, .25, 'sine', .3); tone(140, .08, 'square', .06); },
  };

  /* ---------------- 画面切换 ---------------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    if (id !== 'game') { stopVoice(); $('#solved').hidden = true; }
    if (id === 'picker') renderPicker();
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-go]');
    if (go) show(go.dataset.go);
  });

  document.querySelectorAll('.level-card').forEach(b => b.addEventListener('click', () => {
    S.level = Number(b.dataset.level);
    document.querySelectorAll('.level-card').forEach(x => {
      x.classList.toggle('selected', x === b);
      x.setAttribute('aria-checked', x === b ? 'true' : 'false');
    });
    sfx.pick();
  }));

  function startRandom() {
    S.mode = 'random';
    S.queue = shuffle(BANK).slice(0, ROUND_SIZE);
    S.idx = 0; S.roundStars = [];
    show('game');
    loadCase(true);
  }
  $('#btn-random').addEventListener('click', startRandom);
  $('#btn-again').addEventListener('click', startRandom);
  $('#btn-pick').addEventListener('click', () => show('picker'));

  function renderPicker() {
    const g = $('#pick-grid');
    g.textContent = '';
    BANK.forEach((q, i) => {
      const b = el('button', 'pick');
      b.style.setProperty('--r', `${((i * 37) % 7) - 3}deg`);
      const img = el('img'); img.src = `scenes/${q.id}.jpg`; img.alt = `案件 ${q.id}`; img.loading = 'lazy';
      const stars = S.results[q.id] || 0;
      b.append(img, el('span', '', `案件 ${q.id}`), el('i', 'pick-stars', '★'.repeat(stars)));
      b.addEventListener('click', () => {
        S.mode = 'pick'; S.queue = [q]; S.idx = 0;
        show('game'); loadCase(true);
      });
      g.append(b);
    });
  }

  /* ---------------- 一个案件 ---------------- */
  function loadCase(first) {
    const q = S.queue[S.idx];
    S.q = q; S.slots = {}; S.locked = {}; S.errors = 0; S.busy = false;
    $('#solved').hidden = true;
    $('#stamp').classList.remove('on');
    $('.notebook').classList.remove('is-solved');
    $('#game').classList.toggle('lv1', S.level === 1);
    $('#game').classList.toggle('lv2', S.level === 2);
    $('#case-label').textContent = `案件 ${q.id}`;
    $('#level-tag').textContent = S.level === 1 ? '第一关 · 颜色线索' : '第二关 · 真正的侦探';
    $('#evidence-tag').innerHTML = '';
    $('#evidence-tag').append(el('span', '', `证物 #${q.id}`), el('span', '', '🔍'));
    $('#scene').src = `scenes/${q.id}.jpg`;
    const nxt = S.queue[S.idx + 1] || BANK[(BANK.indexOf(q) + 1) % BANK.length];
    if (nxt) new Image().src = `scenes/${nxt.id}.jpg`;

    renderProgress();
    setHint('');

    // 句子：时间，人物在地点做什么。
    const sen = $('#sentence');
    sen.textContent = '';
    const mk = k => {
      const w = el('div', 'slot-wrap'); w.dataset.k = k;
      const slot = el('div', 'slot'); slot.dataset.k = k;
      slot.setAttribute('aria-label', `${NAME[k]}格子`);
      const top = el('span', 'slot-top');
      top.append(el('span', 'slot-label', NAME[k]), el('span', 'verdict'));
      w.append(top, slot);
      return w;
    };
    sen.append(mk('time'), el('span', 'punct', '，'), mk('who'), el('span', 'punct', '在'),
      mk('place'));
    const tail = el('span', 'tail');   // 句号跟着最后一格，不单独掉到下一行
    tail.append(mk('act'), el('span', 'punct', '。'));
    sen.append(tail);

    // 线索卡
    S.cards = [];
    SLOTS.forEach(({ k }) => {
      const [ok, no] = q[k];
      ok.concat(no).forEach(text => S.cards.push({ text, k, ok: ok.includes(text) }));
    });
    S.cards = shuffle(S.cards).map((c, i) => ({ ...c, id: `c${i}` }));
    const pool = $('#pool');
    pool.textContent = '';
    S.cards.forEach((c, i) => {
      const n = el('button', 'card' + (S.level === 1 ? ` k-${c.k}` : ''), c.text);
      n.type = 'button';
      n.dataset.id = c.id; n.dataset.order = i;
      pool.append(n);
    });
    updateCheck();
    if (first) say(SAY.intro);
  }

  function renderProgress() {
    const p = $('#progress');
    p.textContent = '';
    if (S.mode !== 'random') return;
    S.queue.forEach((_, i) => p.append(el('i', i < S.idx ? 'done' : i === S.idx ? 'now' : '')));
  }

  function setHint(text, calm) {
    const h = $('#hint');
    h.textContent = text;
    h.classList.toggle('calm', !!calm);
  }

  const cardById = id => S.cards.find(c => c.id === id);
  const cardEl = id => document.querySelector(`.card[data-id="${id}"]`);
  const slotEl = k => document.querySelector(`.slot[data-k="${k}"]`);

  function returnToPool(id) {
    const n = cardEl(id);
    const pool = $('#pool');
    const order = Number(n.dataset.order);
    const after = [...pool.children].find(x => Number(x.dataset.order) > order);
    pool.insertBefore(n, after || null);
    n.classList.remove('fly-back'); void n.offsetWidth; n.classList.add('fly-back');
    for (const k in S.slots) if (S.slots[k] === id) delete S.slots[k];
  }

  function placeCard(id, k) {
    if (S.locked[k]) return false;
    const prev = S.slots[k];
    if (prev === id) return true;
    for (const kk in S.slots) if (S.slots[kk] === id) delete S.slots[kk];
    if (prev) returnToPool(prev);
    S.slots[k] = id;
    slotEl(k).append(cardEl(id));
    slotEl(k).parentElement.classList.remove('bad');
    sfx.drop();
    updateCheck();
    return true;
  }

  function updateCheck() {
    const full = SLOTS.every(({ k }) => S.slots[k]);
    const b = $('#btn-check');
    b.disabled = !full || S.busy;
    b.classList.toggle('ready', full && !S.busy);
  }

  /* ---------------- 拖放（Pointer Events：鼠标与触控屏都用这一套） ---------------- */
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const n = e.target.closest('.card');
    if (!n || n.classList.contains('drag') || S.busy) return;
    const fromSlot = n.closest('.slot');
    if (fromSlot && S.locked[fromSlot.dataset.k]) { sayCard(n); return; }
    e.preventDefault();
    drag = { n, id: n.dataset.id, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, over: null, pid: e.pointerId };
  });
  window.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.pid) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.moved = true;
      const r = drag.n.getBoundingClientRect();
      const g = drag.n.cloneNode(true);
      g.classList.add('drag');
      g.style.width = r.width + 'px'; g.style.height = r.height + 'px';
      g.style.fontSize = getComputedStyle(drag.n).fontSize;
      document.body.append(g);
      drag.ghost = g; drag.ox = drag.x0 - r.left; drag.oy = drag.y0 - r.top;
      drag.n.classList.add('ghost-src');
      sfx.pick();
    }
    drag.ghost.style.left = (e.clientX - drag.ox) + 'px';
    drag.ghost.style.top = (e.clientY - drag.oy) + 'px';
    const hit = document.elementFromPoint(e.clientX, e.clientY);
    const slot = hit && hit.closest('.slot');
    const over = slot && !S.locked[slot.dataset.k] ? slot : null;
    if (over !== drag.over) {
      if (drag.over) drag.over.classList.remove('over');
      if (over) over.classList.add('over');
      drag.over = over;
    }
  });
  function endDrag(e, cancel) {
    if (!drag || e.pointerId !== drag.pid) return;
    const d = drag; drag = null;
    if (!d.moved) { if (!cancel) sayCard(d.n); return; }
    d.ghost.remove();
    d.n.classList.remove('ghost-src');
    if (d.over) d.over.classList.remove('over');
    if (!cancel && d.over) {
      placeCard(d.id, d.over.dataset.k);
      say(cardById(d.id).text);
    } else if (d.n.closest('.slot')) {
      returnToPool(d.id);
      updateCheck();
    }
  }
  window.addEventListener('pointerup', e => endDrag(e, false));
  window.addEventListener('pointercancel', e => endDrag(e, true));

  function sayCard(n) {
    n.classList.remove('speaking'); void n.offsetWidth; n.classList.add('speaking');
    say(n.textContent);
  }

  /* ---------------- 检查 ---------------- */
  $('#btn-check').addEventListener('click', () => {
    if (S.busy || !SLOTS.every(({ k }) => S.slots[k])) return;
    const bad = [];
    SLOTS.forEach(({ k }) => {
      if (S.locked[k]) return;
      const c = cardById(S.slots[k]);
      const wrap = slotEl(k).parentElement;
      if (c.k !== k) bad.push({ k, why: 'type' });
      else if (!c.ok) bad.push({ k, why: k });
      else {
        S.locked[k] = true;
        wrap.classList.add('good');
        cardEl(c.id).classList.add('locked');
      }
    });

    if (!bad.length) return solve();

    S.errors++;
    S.busy = true;
    updateCheck();
    sfx.bad();
    bad.forEach(({ k, why }) => {
      const wrap = slotEl(k).parentElement;
      wrap.querySelector('.verdict').textContent = why === 'type' ? '放错格子' : `${NAME[k]}不对`;
      wrap.classList.remove('bad'); void wrap.offsetWidth; wrap.classList.add('bad');
    });
    const typeErr = bad.some(b => b.why === 'type');
    const line = typeErr ? SAY.wrong_type : SAY['hint_' + bad[0].k];
    setHint('🔍 ' + line);
    say(line);
    setTimeout(() => {
      bad.forEach(({ k }) => { if (S.slots[k]) returnToPool(S.slots[k]); });
      S.busy = false;
      updateCheck();
    }, 1100);
  });

  function solve() {
    S.busy = true;
    updateCheck();
    const stars = S.errors === 0 ? 3 : S.errors === 1 ? 2 : 1;
    S.results[S.q.id] = Math.max(S.results[S.q.id] || 0, stars);
    if (S.mode === 'random') S.roundStars.push(stars);
    setHint('');
    sfx.stamp();
    $('#stamp').classList.add('on');
    $('.notebook').classList.add('is-solved');
    sparks($('#stamp'));
    setTimeout(sfx.good, 250);

    const words = SLOTS.map(({ k }) => cardById(S.slots[k]).text);
    const text = sentence(...words);
    const out = $('#solved-sentence');
    out.textContent = '';
    const b = (k, i) => { const x = el('b', `k-${k}`, words[i]); return x; };
    out.append(b('time', 0), '，', b('who', 1), '在', b('place', 2), b('act', 3), '。');
    const st = $('#stars');
    st.textContent = '';
    for (let i = 0; i < 3; i++) st.append(el('span', 's' + (i < stars ? ' on' : ''), '★'));
    const last = S.mode === 'random' && S.idx === S.queue.length - 1;
    $('#btn-next').textContent = last ? '看成绩 →' : '下一个案件 →';
    setTimeout(() => {
      $('#solved').hidden = false;
      $('#btn-next').focus({ preventScroll: true });
    }, 650);
    $('#btn-replay-say').onclick = () => say(text);
    say(SAY.solved, text);
  }

  $('#btn-next').addEventListener('click', () => {
    stopVoice();
    if (S.mode === 'pick') {
      const i = BANK.indexOf(S.q);
      S.queue = [BANK[(i + 1) % BANK.length]]; S.idx = 0;
      return loadCase(false);
    }
    if (S.idx < S.queue.length - 1) { S.idx++; return loadCase(false); }
    const total = S.roundStars.reduce((a, b) => a + b, 0);
    $('#done-stars').textContent = `★ ${total} / ${S.queue.length * 3}`;
    $('#done-text').textContent = `你破了 ${S.queue.length} 个案件！`;
    show('done');
    say(SAY.round_done);
  });

  function sparks(anchor) {
    const r = anchor.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const colors = ['#F4A62A', '#E45F7B', '#22A398', '#7A68E0', '#F7DE9C'];
    for (let i = 0; i < 26; i++) {
      const s = el('i', 'spark');
      s.style.background = colors[i % colors.length];
      s.style.left = cx + 'px'; s.style.top = cy + 'px';
      document.body.append(s);
      const a = Math.random() * Math.PI * 2, d = 90 + Math.random() * 160;
      s.animate([
        { transform: 'translate(-50%,-50%) rotate(0)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d + 60}px) rotate(${Math.random() * 540}deg)`, opacity: 0 },
      ], { duration: 800 + Math.random() * 500, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => s.remove();
    }
  }

  /* ---------------- 启动 ---------------- */
  Promise.all([
    fetch('bank.json').then(r => r.json()),
    fetch('say.json').then(r => r.json()),
  ]).then(([bank, sayj]) => {
    BANK = bank; SAY = sayj;
    if ('speechSynthesis' in window) speechSynthesis.getVoices();
  });

  // 给自动测试用
  window.__kantu = {
    state: S,
    bank: () => BANK,
    place: (text, k) => {
      const c = S.cards.find(x => x.text === text);
      return c ? placeCard(c.id, k) : false;
    },
    clipKey,
  };
})();
