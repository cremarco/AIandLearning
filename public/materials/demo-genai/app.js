import { distribution, ranked, sample, entropy } from './math.js';

const $ = id => document.getElementById(id);
const percent = number => new Intl.NumberFormat('en-GB', { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(number);
const modelId = 'Qwen2.5-0.5B-Instruct';
const state = { model: null, tokenizer: null, ids: [], logits: null, probabilities: null, prefix: '', generated: [], busy: false, stop: false, saved: [], run: null, device: '', inputVersion: 0 };
const controls = ['analyze', 'one', 'generate', 'save'];
const tokensText = id => state.tokenizer.decode([id], { skip_special_tokens: false });
const visibleToken = value => value.replaceAll(' ', '·').replaceAll('\n', '↵').replaceAll('\t', '⇥') || '∅';
const plain = (tag, value, className) => { const node = document.createElement(tag); node.textContent = value; if (className) node.className = className; return node; };

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}
function setBusy(busy) {
  state.busy = busy;
  document.body.classList.toggle('busy', busy);
  $('load').disabled = busy || !!state.model;
  $('prompt').disabled = busy;
  $('temperature').disabled = busy;
  controls.forEach(id => $(id).disabled = busy || !state.model || (id !== 'analyze' && !state.logits));
  $('stop').disabled = !busy || !state.model;
  $('reset').disabled = busy;
  document.querySelectorAll('[data-example]').forEach(button => button.disabled = busy);
}

async function loadModel() {
  if (state.busy || state.model) return;
  setBusy(true);
  $('load-progress').hidden = false;
  status('Loading the libraries and local model…');
  const started = performance.now();
  try {
    const { AutoTokenizer, AutoModelForCausalLM, env } = await import('./vendor/transformers.min.js');
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.localModelPath = new URL('./models/', location.href).href;
    env.backends.onnx.wasm.wasmPaths = new URL('./vendor/', location.href).href;
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    const preference = new URLSearchParams(location.search).get('device');
    let gpu = false;
    if (preference !== 'wasm' && navigator.gpu) {
      try { gpu = !!(await navigator.gpu.requestAdapter()); } catch { /* WASM is the explicit fallback. */ }
    }
    state.device = gpu ? 'webgpu' : 'wasm';
    const progress_callback = event => {
      if (event.status === 'progress' && event.file?.endsWith('.onnx')) {
        $('load-progress').value = event.progress || 0;
        status(`Reading model: ${Math.round(event.progress || 0)}% · ${state.device === 'webgpu' ? 'WebGPU' : 'CPU / WASM'}`);
      } else if (event.status === 'done' && event.file?.endsWith('.onnx')) status('Preparing the inference engine…');
    };
    state.tokenizer = await AutoTokenizer.from_pretrained(modelId, { local_files_only: true });
    const options = { dtype: 'q4', device: state.device, local_files_only: true, progress_callback };
    try { state.model = await AutoModelForCausalLM.from_pretrained(modelId, options); }
    catch (error) {
      if (state.device !== 'webgpu') throw error;
      state.device = 'wasm';
      status('WebGPU is unavailable for this model: starting CPU / WASM…');
      state.model = await AutoModelForCausalLM.from_pretrained(modelId, { ...options, device: 'wasm' });
    }
    state.loadSeconds = (performance.now() - started) / 1000;
    $('load').textContent = 'Model ready';
    $('load-progress').hidden = true;
    status(`Model ready · ${state.device === 'webgpu' ? 'WebGPU' : 'CPU / WASM'} · load ${state.loadSeconds.toFixed(1)} s. Enter some text and analyze it.`);
  } catch (error) {
    console.error(error);
    status(`Loading failed: ${error.message}. Check the model files and try again. See the guide.`, true);
    $('load').textContent = 'Retry loading';
    $('load-progress').hidden = true;
  } finally { setBusy(false); }
}

function showTokens(ids) {
  $('token-count').textContent = `(${ids.length})`;
  $('tokens').replaceChildren(...ids.map(id => {
    const node = plain('span', visibleToken(tokensText(id)), 'token');
    node.append(plain('small', `ID ${id}`));
    return node;
  }));
}

function updateDistribution() {
  if (!state.logits) return;
  const temperature = Number($('temperature').value);
  state.probabilities = distribution(state.logits, temperature);
  const top = ranked(state.probabilities);
  const total = top.reduce((sum, entry) => sum + entry.probability, 0);
  $('probabilities').replaceChildren(...top.map(entry => {
    const li = document.createElement('li');
    li.append(plain('span', visibleToken(tokensText(entry.id)), 'token-label'), plain('span', percent(entry.probability), 'probability'));
    const bar = document.createElement('div'); bar.className = 'probability-bar'; bar.setAttribute('aria-hidden', 'true');
    const fill = document.createElement('span'); fill.style.width = `${entry.probability * 100}%`; bar.append(fill); li.append(bar);
    return li;
  }));
  $('remaining').textContent = percent(Math.max(0, 1 - total));
  $('position').textContent = `Position ${state.ids.length + 1}`;
  $('distribution-context').textContent = `After the context «${state.tokenizer.decode(state.ids, { skip_special_tokens: true })}»`;
  $('entropy').textContent = `Normalized over ${state.probabilities.length.toLocaleString('en-GB')} token · entropy ${entropy(state.probabilities).toFixed(2)} bit. Rounded values.`;
  state.run = { model: 'onnx-community/Qwen2.5-0.5B-Instruct', dtype: 'q4', device: state.device, input: state.prefix, context: state.tokenizer.decode(state.ids, { skip_special_tokens: true }), tokenIds: [...state.ids], temperature, top: top.map(entry => ({...entry, token: tokensText(entry.id)})), remaining: Math.max(0, 1-total), entropyBits: entropy(state.probabilities), output: state.generated.length ? state.tokenizer.decode(state.generated, { skip_special_tokens: true }) : '', time: new Date().toISOString(), inferSeconds: state.inferSeconds };
  Object.assign(window.__genai, { state, distribution, ranked, entropy });
}

async function infer() {
  const { Tensor } = await import('./vendor/transformers.min.js');
  const n = state.ids.length;
  const started = performance.now();
  const input_ids = new Tensor('int64', BigInt64Array.from(state.ids, BigInt), [1, n]);
  const attention_mask = new Tensor('int64', BigInt64Array.from({ length: n }, () => 1n), [1, n]);
  const output = await state.model({ input_ids, attention_mask });
  const logits = output.logits;
  const vocabulary = logits.dims.at(-1);
  state.logits = new Float64Array(logits.data.slice(logits.data.length - vocabulary));
  state.inferSeconds = (performance.now() - started) / 1000;
  // This educational implementation does not retain KV caches between steps.
  // Dispose all result tensors to avoid accumulating memory during the workshop.
  const disposed = new Set();
  for (const tensor of Object.values(output)) {
    if (tensor?.dispose && !disposed.has(tensor)) { tensor.dispose(); disposed.add(tensor); }
  }
  input_ids.dispose?.(); attention_mask.dispose?.();
  updateDistribution();
}

function showCompletion() {
  $('completion').replaceChildren(document.createTextNode(state.prefix));
  if (state.generated.length) $('completion').append(plain('mark', state.tokenizer.decode(state.generated, { skip_special_tokens: true })));
}

async function analyze() {
  if (!state.model || state.busy) return;
  const text = $('prompt').value.trim();
  if (!text) { status('Enter some starting text before analyzing.', true); $('prompt').focus(); return; }
  state.prefix = text;
  state.generated = [];
  state.ids = state.tokenizer.encode(text, { add_special_tokens: false });
  if (state.ids.length > 96) { status(`Input has ${state.ids.length} tokens: shorten it to 96 for this demo.`, true); return; }
  if (!state.ids.length) { status('The text contains no usable tokens.', true); return; }
  state.logits = null; state.probabilities = null; state.run = null;
  setBusy(true);
  showTokens(state.ids);
  showCompletion();
  status('Real inference: computing next-token logits…');
  try {
    await infer();
    status(`Analysis completed in ${state.inferSeconds.toFixed(2)} s · change temperature to recompute probabilities from the same logits.`);
  } catch (error) { console.error(error); status(`Inference failed: ${error.message}. Shorten the text or reload the model.`, true); }
  finally { setBusy(false); }
}

async function generate(count) {
  if (!state.model || state.busy || !state.probabilities) return;
  const maximum = Math.min(24 - state.generated.length, Math.max(1, Math.min(24, count)));
  if (maximum <= 0) { status('Reached the 24 new-token limit. Analyze again to restart.'); return; }
  state.stop = false; setBusy(true);
  try {
    for (let step = 0; step < maximum; step++) {
      if (state.stop) break;
      const id = sample(state.probabilities);
      if ([151643,151645].includes(id)) { status('The model emitted an end-of-sequence token.'); break; }
      state.ids.push(id); state.generated.push(id);
      showCompletion();
      status(`Real generation: ${state.generated.length} new tokens. You can stop after the current token finishes.`);
      await infer();
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    status(`${state.stop ? 'Generation stopped' : 'Generation completed'} · ${state.generated.length} new tokens. Probabilities now describe the next token after the completed text.`);
  } catch (error) { console.error(error); status(`Generation failed: ${error.message}. The text already generated remains visible.`, true); }
  finally { setBusy(false); }
}

function renderSaved() {
  if (!state.saved.length) { $('comparison-results').replaceChildren(plain('p', 'No saved results.')); return; }
  const grid = document.createElement('div'); grid.className = 'comparison-grid';
  state.saved.forEach((run, i) => {
    const item = document.createElement('article'); item.className = 'comparison-item';
    item.append(plain('h3', `Run ${i === 0 ? 'A' : 'B'} · T = ${run.temperature.toFixed(1)}`), plain('p', `Input: ${run.input}`), plain('p', `${run.input}${run.output}`, 'saved-output'));
    item.append(plain('p', `Top token in the saved distribution: ${visibleToken(run.top[0].token)} · ${percent(run.top[0].probability)}`), plain('small', `${run.tokenIds.length} tokens in context · entropy ${run.entropyBits.toFixed(2)} bit`));
    grid.append(item);
  });
  $('comparison-results').replaceChildren(grid);
}

function invalidate() {
  state.logits = null; state.probabilities = null; state.ids = []; state.generated = []; state.run = null;
  ['one', 'generate', 'save'].forEach(id => $(id).disabled = true);
  $('position').textContent = 'Input changed';
  $('probabilities').replaceChildren(plain('li', 'Analyze the new text to update probabilities.', 'empty'));
  $('remaining').textContent = '—';
  $('distribution-context').textContent = 'Probabilities will be computed from the new context.';
  $('tokens').replaceChildren(plain('p','Analyze the new text to see its tokens.'));
  $('token-count').textContent = '—';
  $('completion').textContent = 'The text will appear here.';
  $('entropy').textContent = 'Probabilities computed over the full vocabulary, before rounding.';
}

$('load').addEventListener('click', loadModel);
$('analyze').addEventListener('click', analyze);
$('one').addEventListener('click', () => generate(1));
$('generate').addEventListener('click', () => generate(Number($('max-tokens').value)));
$('stop').addEventListener('click', () => { state.stop = true; status('Stop requested: waiting for the current token…'); });
$('prompt').addEventListener('input', invalidate);
$('temperature').addEventListener('input', () => { $('temperature-value').textContent = Number($('temperature').value).toFixed(2); updateDistribution(); });
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => { $('prompt').value = button.dataset.example; invalidate(); }));
$('save').addEventListener('click', () => { if (!state.run) return; if (state.saved.length === 2) state.saved.shift(); state.saved.push(structuredClone(state.run)); renderSaved(); $('download').disabled = false; status(`Run ${state.saved.length === 1 ? 'A' : 'B'} saved. Change one condition to compare.`); });
$('download').addEventListener('click', () => { const blob = new Blob([JSON.stringify({ provenance:'Real inference executed in this browser', exportedAt:new Date().toISOString(), runs: state.saved },null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob);a.download='genai-comparison.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); });
$('reset').addEventListener('click', () => { invalidate(); state.saved=[]; renderSaved(); $('download').disabled=true; status(state.model?'Results reset. The model stays loaded.':'Results reset. Load the model to begin.'); });
window.__genai = { state, loadModel, analyze, generate, distribution, ranked, entropy };
if (new URLSearchParams(location.search).has('autoload')) loadModel();
