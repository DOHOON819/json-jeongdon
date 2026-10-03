import test from 'node:test';
import assert from 'node:assert/strict';
import {parse, format, resolvePointer, JsonError, LIMITS} from '../dist/core.js';
test('numeric lexemes, escapes, key order and duplicate entries remain intact', () => {
  const source = String.raw`{"id":900719925474099312345,"n":-0,"huge":1e400,"fraction":1.2300,"text":"\u0041\/","id":2}`;
  const doc = parse(source);
  assert.equal(format(doc.root, ''), source);
  assert.equal(format(parse(format(doc.root, '\t')).root, ''), source);
  assert.equal(doc.duplicateCount, 1);
});
test('escaped duplicate keys, nested objects and prototype-looking keys', () => {
  const doc = parse(String.raw`{"a":1,"\u0061":2,"__proto__":{"a":3},"nested":{"a":4}}`);
  assert.equal(doc.duplicateCount, 1);
  assert.equal(doc.duplicates[0].key, 'a');
  assert.throws(() => resolvePointer(doc.root, '/a'), /중복/);
  assert.equal(format(resolvePointer(doc.root, '/__proto__/a')), '3');
  assert.equal(doc.maxDepth, 2);
});
test('safe values round trip and formatting is idempotent', () => {
  let seed = 31;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  function make(depth) {
    if (!depth) return [null, false, true, '한글 " / \n 😀', Math.floor(random() * 999)][Math.floor(random() * 5)];
    return random() > .5 ? Array.from({length: 4}, () => make(depth - 1)) : {a: make(depth - 1), 'b/c': make(depth - 1)};
  }
  for (let i = 0; i < 80; i++) {
    const expected = make(3), source = JSON.stringify(expected);
    for (const indent of ['', '  ', '    ', '\t']) {
      const output = format(parse(source).root, indent);
      assert.deepEqual(JSON.parse(output), expected);
      assert.equal(format(parse(output).root, indent), output);
    }
  }
});
test('strict syntax rejects comments, trailing commas, broken strings and numbers', () => {
  const invalid = ['', ' ', '[1,]', '{"a":1,}', '{a:1}', '{"a" 1}', '01', '-01', '+1', '.1', '1.', '1e', '1e+', '--1', 'NaN', 'Infinity', 'true false', '[1 2]', '/*a*/1', '1\u00a0', '\ufeff{}', '"a\nb"', '"\\x"', '"\\u12zz"', '"abc', '[', '{', 'nul'];
  for (const source of invalid) assert.throws(() => parse(source), JsonError, source);
  try { parse('{\r\n"x": 1,\r\n}'); assert.fail(); }
  catch (e) { assert.equal(e.line, 3); assert.equal(e.column, 1); assert.equal(e.index, 12); }
  for (const source of ['0', '-0', '1e400', 'true', 'null', '"a"', '[]', '{}', '\t[1]\r\n']) assert.doesNotThrow(() => parse(source));
});
test('JSON Pointer escaping, root, empty keys, arrays and errors', () => {
  const root = parse('{"":0,"a/b":{"~key":[123,456]},"~1":9}').root;
  assert.equal(resolvePointer(root, ''), root);
  assert.equal(format(resolvePointer(root, '/')), '0');
  assert.equal(format(resolvePointer(root, '/a~1b/~0key/1')), '456');
  assert.equal(format(resolvePointer(root, '/~01')), '9');
  for (const p of ['#', '/missing', '/~2', '/a~1b/~0key/01', '/a~1b/~0key/-', '/a~1b/~0key/2', '/a~1b/~0key/0/x']) assert.throws(() => resolvePointer(root, p));
});
test('bounded resources fail with a useful message', () => {
  assert.doesNotThrow(() => parse('['.repeat(100) + '0' + ']'.repeat(100)));
  assert.throws(() => parse('['.repeat(101) + '0' + ']'.repeat(101)), /100단계/);
  assert.throws(() => parse(' '.repeat(LIMITS.chars + 1)), /100만/);
  assert.throws(() => parse('[' + '0,'.repeat(LIMITS.nodes) + '0]'), /10만/);
});
