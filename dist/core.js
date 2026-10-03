// Parse syntax without converting numeric tokens into JavaScript Numbers.
export const LIMITS = Object.freeze({chars: 1_000_000, depth: 100, nodes: 100_000, output: 8_000_000, fileBytes: 2_097_152});
export function location(source, index) {
  const before = source.slice(0, index).split(/\r\n|\r|\n/);
  return {line: before.length, column: before.at(-1).length + 1};
}
export class JsonError extends Error {
  constructor(message, source, index) {
    const pos = location(source, index);
    super(`${pos.line}행 ${pos.column}열: ${message}`);
    this.name = 'JsonError'; this.index = index; Object.assign(this, pos);
  }
}
export function parse(source) {
  if (typeof source !== 'string') throw new TypeError('문자열을 입력하세요.');
  if (source.length > LIMITS.chars) throw new Error('입력은 100만 글자 이하로 줄여주세요.');
  let i = 0, count = 0, maxDepth = 0, duplicateCount = 0;
  const duplicates = [];
  const fail = (message, at = i) => { throw new JsonError(message, source, at); };
  const ws = () => { while (i < source.length && /[\x20\t\r\n]/.test(source[i])) i++; };
  function string() {
    const start = i++;
    while (i < source.length) {
      const c = source[i++];
      if (c === '"') return {type: 'string', raw: source.slice(start, i), start};
      if (c.charCodeAt(0) < 32) fail('문자열 안의 줄바꿈·제어 문자는 이스케이프해야 합니다.', i - 1);
      if (c === '\\') {
        if (i === source.length) fail('이스케이프 문자 뒤가 비어 있습니다.');
        const e = source[i++];
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(i, i + 4))) fail('유니코드 이스케이프는 16진수 네 자리여야 합니다.');
          i += 4;
        } else if (!'"\\/bfnrt'.includes(e)) fail('허용되지 않는 이스케이프 문자입니다.', i - 1);
      }
    }
    fail('문자열을 닫는 큰따옴표가 없습니다.');
  }
  function value(depth) {
    ws();
    if (++count > LIMITS.nodes) fail('값은 최대 10만 개까지 처리합니다.');
    const start = i, c = source[i];
    if (c === '{' || c === '[') {
      if (depth >= LIMITS.depth) fail('중첩은 최대 100단계까지 처리합니다.');
      maxDepth = Math.max(maxDepth, depth + 1);
      const object = c === '{', close = object ? '}' : ']', items = [], seen = new Set();
      i++; ws();
      if (source[i] === close) { i++; return {type: object ? 'object' : 'array', items, start}; }
      while (true) {
        ws();
        if (object) {
          if (source[i] !== '"') fail('객체의 키는 큰따옴표로 감싸주세요.');
          const key = string(), name = JSON.parse(key.raw);
          ws(); if (source[i] !== ':') fail('키 다음에 콜론(:)이 필요합니다.');
          i++; const child = value(depth + 1);
          if (seen.has(name)) {
            duplicateCount++;
            if (duplicates.length < 20) duplicates.push({key: name, index: key.start});
          }
          seen.add(name); items.push({key, name, value: child});
        } else items.push(value(depth + 1));
        ws();
        if (source[i] === close) { i++; break; }
        if (source[i] !== ',') fail(`항목 사이에 쉼표(,) 또는 ${close}가 필요합니다.`);
        i++; ws();
        if (source[i] === close) fail('마지막 항목 뒤의 쉼표를 지워주세요.');
      }
      return {type: object ? 'object' : 'array', items, start};
    }
    if (c === '"') return string();
    if (c === '-' || (c >= '0' && c <= '9')) {
      // A sticky regex avoids repeatedly copying the unconsumed document.
      const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
      number.lastIndex = i;
      const match = number.exec(source);
      if (!match) fail('올바른 JSON 숫자가 아닙니다.');
      i = number.lastIndex;
      return {type: 'number', raw: match[0], start};
    }
    for (const literal of ['true', 'false', 'null']) {
      if (source.startsWith(literal, i)) { i += literal.length; return {type: literal === 'null' ? 'null' : 'boolean', raw: literal, start}; }
    }
    fail(i === source.length ? 'JSON 값이 필요합니다.' : 'JSON 값(객체·배열·문자열·숫자·true·false·null)을 입력하세요.');
  }
  const root = value(0); ws();
  if (i !== source.length) fail('값 뒤에 불필요한 문자가 있습니다.');
  return {root, duplicates, duplicateCount, count, maxDepth};
}
export function format(root, indent = '  ') {
  if (!['', '  ', '    ', '\t'].includes(indent)) throw new Error('지원하지 않는 들여쓰기입니다.');
  const chunks = []; let size = 0;
  const add = text => {
    size += text.length;
    if (size > LIMITS.output) throw new Error('정리 결과가 너무 큽니다. 한 줄 압축을 선택하거나 입력을 줄여주세요.');
    chunks.push(text);
  };
  const line = depth => { if (indent) add('\n' + indent.repeat(depth)); };
  function render(node, depth) {
    if (node.raw !== undefined) { add(node.raw); return; }
    const object = node.type === 'object';
    add(object ? '{' : '[');
    node.items.forEach((item, index) => {
      if (index) add(',');
      line(depth + 1);
      if (object) { add(item.key.raw); add(indent ? ': ' : ':'); render(item.value, depth + 1); }
      else render(item, depth + 1);
    });
    if (node.items.length) line(depth);
    add(object ? '}' : ']');
  }
  render(root, 0);
  return chunks.join('');
}
export function resolvePointer(root, pointer) {
  if (pointer === '') return root;
  if (!pointer.startsWith('/')) throw new Error('경로는 /로 시작해야 합니다. 빈 경로는 문서 전체입니다.');
  let node = root;
  for (const part of pointer.slice(1).split('/')) {
    if (/~(?:[^01]|$)/.test(part)) throw new Error('경로에서 ~는 ~0, /는 ~1로 적어주세요.');
    const name = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (node.type === 'object') {
      const matches = node.items.filter(item => item.name === name);
      if (matches.length > 1) throw new Error('이 경로의 키가 중복되어 어느 값을 선택할지 정할 수 없습니다.');
      if (!matches.length) throw new Error('이 경로에 해당하는 키가 없습니다.');
      node = matches[0].value;
    } else if (node.type === 'array') {
      if (!/^(0|[1-9]\d*)$/.test(name) || Number(name) >= node.items.length) throw new Error('배열 번호가 범위를 벗어났습니다. 첫 항목은 0입니다.');
      node = node.items[Number(name)];
    } else throw new Error('이 값 아래에는 더 이상 하위 항목이 없습니다.');
  }
  return node;
}
