"""生成预录人声：读 bank.json 与 say.json，用 edge-tts 生成 mp3 到 audio/。
用法：python3 gen-voice.py（改了 bank.json 或 say.json 都要重跑）。
档名 = FNV-1a(句子)，跟 app.js 的 clipKey() 一致；已存在的档不重录。
朗读内容：每张卡片的词、say.json 的提示语、每题所有「都算对」组合的完整句子。"""
import asyncio, itertools, json, os
import edge_tts

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, 'audio')
os.makedirs(AUDIO, exist_ok=True)
VOICE, RATE = 'zh-CN-XiaoxiaoNeural', '-10%'   # 一年级要慢一点

def fnv(s):
    h = 0x811c9dc5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f'{h:08x}'

def sentence(t, w, p, a):
    return f'{t}，{w}在{p}{a}。'   # 跟 app.js 的 sentence() 一致

bank = json.load(open(os.path.join(HERE, 'bank.json'), encoding='utf-8'))
say = json.load(open(os.path.join(HERE, 'say.json'), encoding='utf-8'))
texts = set(say.values())
for q in bank:
    for k in ('time', 'who', 'place', 'act'):
        texts.update(q[k][0] + q[k][1])
    for combo in itertools.product(*(q[k][0] for k in ('time', 'who', 'place', 'act'))):
        texts.add(sentence(*combo))
texts = sorted(texts)

async def one(sem, text):
    out = os.path.join(AUDIO, fnv(text) + '.mp3')
    if os.path.exists(out) and os.path.getsize(out) > 1000:
        return 'skip'
    async with sem:
        for _ in range(3):
            try:
                await edge_tts.Communicate(text, VOICE, rate=RATE).save(out)
                return 'new'
            except Exception as e:  # 网络偶尔失败，重试
                err = e
                await asyncio.sleep(1.5)
        raise err

async def main():
    sem = asyncio.Semaphore(6)
    res = await asyncio.gather(*(one(sem, t) for t in texts))
    print(f"共 {len(texts)} 句：新录 {res.count('new')}，已存在 {res.count('skip')}")

asyncio.run(main())

keys = {fnv(t): 1 for t in texts}
with open(os.path.join(AUDIO, 'manifest.js'), 'w', encoding='utf-8') as f:
    f.write('// 由 gen-voice.py 生成，不要手改\n')
    f.write('window.VOICE_CLIPS = ' + json.dumps(keys, separators=(',', ':')) + ';\n')
with open(os.path.join(AUDIO, 'lines.json'), 'w', encoding='utf-8') as f:
    json.dump({fnv(t): t for t in texts}, f, ensure_ascii=False, indent=1)

extra = sorted(set(n[:-4] for n in os.listdir(AUDIO) if n.endswith('.mp3')) - set(keys))
if extra:
    print(f'⚠️ audio/ 里有 {len(extra)} 个旧音档已不再使用：{extra[:5]}… 可移到 ~/Documents/待删除/')
