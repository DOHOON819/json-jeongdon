import {parse, format, resolvePointer, location, LIMITS, JsonError} from './core.js';
const $ = id => document.getElementById(id);
let errorIndex = null, mode = 'pretty', revision = 0;
const sample = '{"project":"작은 정리","id":9007199254740993,"items":[{"name":"메모","done":true},{"name":"검토","done":false}],"rate":1.2300}';
const size = n => n.toLocaleString('ko-KR');
function invalidate(message = '입력이 바뀌었습니다. 다시 검사해주세요.') {
  $('output').value = ''; $('output-count').textContent = '0 글자'; $('output-mode').textContent = '준비 중';
  $('copy').disabled = $('download').disabled = true;
  $('error').hidden = $('warnings').hidden = $('jump').hidden = true;
  errorIndex = null; $('result-status').textContent = message;
}
function inputChanged() {
  revision++; $('source-count').textContent = `${size($('source').value.length)} 글자`;
  invalidate();
}
function showError(error) {
  invalidate('결과를 만들지 못했습니다. 원본은 그대로 유지됩니다.');
  $('error').textContent = error.message; $('error').hidden = false;
  if (error instanceof JsonError) { errorIndex = error.index; $('jump').hidden = false; }
}
function run(nextMode) {
  mode = nextMode;
  invalidate();
  try {
    const source = $('source').value, doc = parse(source);
    const selected = mode === 'pointer' ? resolvePointer(doc.root, $('pointer').value) : doc.root;
    const indent = mode === 'minify' ? '' : $('indent').value === 'tab' ? '\t' : ' '.repeat(Number($('indent').value));
    const output = format(selected, indent);
    $('output').value = output; $('output-count').textContent = `${size(output.length)} 글자`;
    const labels = {pretty: '들여쓰기', minify: '한 줄 압축', pointer: '경로 추출'};
    $('output-mode').textContent = labels[mode]; $('copy').disabled = $('download').disabled = false;
    $('result-status').textContent = `문법 검사 완료 · 전체 ${size(doc.count)}개 값 · 중첩 ${doc.maxDepth}단계 · ${labels[mode]} 완료${mode === 'pointer' ? ' (경로: ' + ($('pointer').value || '전체 문서') + ')' : ''}`;
    if (doc.duplicateCount) {
      $('warnings').hidden = false;
      $('warnings-title').textContent = `중복 키 ${size(doc.duplicateCount)}개 발견${doc.duplicateCount > 20 ? ' · 앞의 20개 표시' : ''}`;
      $('warning-list').replaceChildren(...doc.duplicates.map(item => {
        const li = document.createElement('li'), pos = location(source, item.index);
        const key = JSON.stringify(item.key.length > 80 ? item.key.slice(0, 80) + '…' : item.key);
        li.textContent = `${pos.line}행 ${pos.column}열 · ${key}`; return li;
      }));
    }
  } catch (error) { showError(error); }
}
$('source').addEventListener('input', inputChanged);
$('pointer').addEventListener('input', () => { if (mode === 'pointer') invalidate('경로가 바뀌었습니다. 다시 추출해주세요.'); });
$('pretty').addEventListener('click', () => run('pretty'));
$('minify').addEventListener('click', () => run('minify'));
$('pointer-form').addEventListener('submit', event => { event.preventDefault(); run('pointer'); });
$('indent').addEventListener('change', () => { if ($('output').value) run(mode); });
$('sample').addEventListener('click', () => { $('source').value = sample; inputChanged(); run('pretty'); });
$('clear').addEventListener('click', () => { $('source').value = ''; $('pointer').value = ''; inputChanged(); $('result-status').textContent = 'JSON을 입력하거나 예제로 시작하세요.'; $('source').focus(); });
$('source').addEventListener('keydown', event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run('pretty'); } });
$('jump').addEventListener('click', () => { if (errorIndex !== null) { $('source').focus(); $('source').setSelectionRange(errorIndex, errorIndex + 1); } });
$('open-file').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  const file = $('file').files[0]; $('file').value = '';
  if (!file) return;
  const ticket = ++revision;
  try {
    if (file.size > LIMITS.fileBytes) throw new Error('2 MiB 이하의 UTF-8 파일을 선택하세요.');
    const bytes = await file.arrayBuffer();
    if (ticket !== revision) return;
    let text;
    try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch { throw new Error('UTF-8로 읽을 수 없는 파일입니다. UTF-8 형식으로 저장한 뒤 다시 열어주세요.'); }
    if (text.length > LIMITS.chars) throw new Error('파일 내용은 100만 글자 이하로 줄여주세요.');
    $('source').value = text; inputChanged(); run('pretty');
  } catch (error) { if (ticket === revision) showError(error); }
});
$('copy').addEventListener('click', async () => {
  const value = $('output').value;
  if (!value) return;
  try { await navigator.clipboard.writeText(value); $('result-status').textContent = '정리 결과를 클립보드에 복사했습니다.'; }
  catch { $('output').focus(); $('output').select(); $('result-status').textContent = '자동 복사가 허용되지 않아 결과를 선택했습니다. Ctrl / ⌘ + C로 복사하세요.'; }
});
$('download').addEventListener('click', () => {
  const value = $('output').value; if (!value) return;
  const url = URL.createObjectURL(new Blob([value + '\n'], {type: 'application/json;charset=utf-8'}));
  const a = document.createElement('a'); a.href = url; a.download = mode === 'pointer' ? 'extracted.json' : 'formatted.json';
  a.click(); setTimeout(() => URL.revokeObjectURL(url), 10_000);
  $('result-status').textContent = 'JSON 파일 다운로드를 시작했습니다.';
});
