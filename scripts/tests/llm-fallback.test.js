// callLLM and LLM_probe from the REAL Code.gs, with the three AI providers
// faked: Gemini first, then Mistral, then Ollama Cloud as the last resort.
// Ollama's request shape follows docs.ollama.com/cloud: POST
// https://ollama.com/api/chat, Bearer key, {model, messages, stream:false},
// answer in message.content.
//   node scripts/tests/llm-fallback.test.js
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync('Code.gs', 'utf8');

function load(props, replies) {
  const calls = [], sleeps = [], logs = [];
  const res = (code, body) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
  const ctx = {
    console, Logger: { log: (m) => logs.push(String(m)) },
    Utilities: { sleep: (ms) => sleeps.push(ms) },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    UrlFetchApp: { fetch: (url, opt) => {
      const who = /generativelanguage/.test(url) ? 'gemini' : /mistral\.ai/.test(url) ? 'mistral' : /ollama\.com/.test(url) ? 'ollama' : 'other';
      calls.push({ who, url, opt, body: JSON.parse(opt.payload) });
      const r = replies[who] || [500, {}];
      return res(r[0], r[1]);
    } },
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'Code.gs' });
  return { ctx, calls, sleeps, logs };
}

const GEM_OK  = [200, { candidates: [{ content: { parts: [{ text: 'from gemini' }] }, finishReason: 'STOP' }] }];
const GEM_503 = [503, { error: { message: 'model busy' } }];
const MIS_429 = [429, { message: 'Rate limit exceeded' }];
const OLL_OK  = [200, { model: 'gemma4:31b', message: { role: 'assistant', content: 'from ollama' }, done: true }];
const OLL_429 = [429, { error: 'usage limit reached' }];
const KEYS = { GEMINI_KEY: 'k-gem', MISTRAL_KEY: 'k-mis', OLLAMA_KEY: 'k-oll' };

let fails = 0;
const ok = (label, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '   ' + (extra || ''))); if (!cond) fails++; };
const who = (calls) => calls.map(c => c.who).join(',');

// 1. Gemini answers: nobody else is asked.
let t = load(KEYS, { gemini: GEM_OK, mistral: MIS_429, ollama: OLL_OK });
ok('Gemini answers first and alone', t.ctx.callLLM('hello') === 'from gemini' && who(t.calls) === 'gemini', who(t.calls));

// 2. Gemini busy, Mistral limited: Ollama answers, in the documented shape.
t = load(KEYS, { gemini: GEM_503, mistral: MIS_429, ollama: OLL_OK });
let a = t.ctx.callLLM('Officer said: report submit ki');
const oc = t.calls.find(c => c.who === 'ollama') || { opt: { headers: {} }, body: {} };
ok('falls through to Ollama and returns its answer', a === 'from ollama', a);
ok('order is Gemini, Mistral, then Ollama', /^gemini(,gemini)?,mistral,ollama$/.test(who(t.calls)), who(t.calls));
ok('Ollama: POST https://ollama.com/api/chat', oc.url === 'https://ollama.com/api/chat' && oc.opt.method === 'post');
ok('Ollama: Bearer key header', oc.opt.headers.Authorization === 'Bearer k-oll');
ok('Ollama: default model gemma4:31b, stream false', oc.body.model === 'gemma4:31b' && oc.body.stream === false, JSON.stringify(oc.body));
ok('Ollama: the prompt goes as the user message', oc.body.messages.length === 1 && oc.body.messages[0].role === 'user' && oc.body.messages[0].content === 'Officer said: report submit ki');

// 3. No Ollama key: never called, same as before this change.
const noOll = Object.assign({}, KEYS); delete noOll.OLLAMA_KEY;
t = load(noOll, { gemini: GEM_503, mistral: MIS_429, ollama: OLL_OK });
a = t.ctx.callLLM('x');
ok('without OLLAMA_KEY, Ollama is never called', a === '' && t.calls.every(c => c.who !== 'ollama'), who(t.calls));
ok('two rounds with one 2.5 s wait, as before', JSON.stringify(t.sleeps) === '[2500]', JSON.stringify(t.sleeps));

// 4. A different free model from the Script Property, no deploy needed.
t = load(Object.assign({ OLLAMA_MODEL: ' gpt-oss:120b ' }, KEYS), { gemini: GEM_503, mistral: MIS_429, ollama: OLL_OK });
t.ctx.callLLM('x');
ok('OLLAMA_MODEL overrides the model (trimmed)', (t.calls.find(c => c.who === 'ollama') || { body: {} }).body.model === 'gpt-oss:120b');

// 5. Everything down: empty answer after two rounds, Ollama tried twice.
t = load(KEYS, { gemini: GEM_503, mistral: MIS_429, ollama: OLL_429 });
a = t.ctx.callLLM('x');
ok('all three down: empty answer, Ollama asked once per round', a === '' && t.calls.filter(c => c.who === 'ollama').length === 2, who(t.calls));

// 6. LLM_probe reports Ollama, and never prints a key.
t = load(KEYS, { gemini: GEM_OK, mistral: MIS_429, ollama: OLL_OK });
const p = t.ctx.LLM_probe();
const printed = t.logs.join('\n');
ok('probe: Ollama key present, model, HTTP 200, text', p.ollama_key === 'present, length 5' && p.ollama_model === 'gemma4:31b' &&
   p.ollama_httpCode === 200 && p.ollama_extractedText === 'from ollama', JSON.stringify(p));
ok('probe: no key value in the log', !/k-gem|k-mis|k-oll/.test(printed));
t = load(noOll, { gemini: GEM_OK });
ok('probe without OLLAMA_KEY says MISSING and calls nothing', t.ctx.LLM_probe().ollama_key === 'MISSING' && t.calls.every(c => c.who !== 'ollama'));

console.log('\n' + (fails ? fails + ' FAILED' : 'all checks pass'));
process.exit(fails ? 1 : 0);
