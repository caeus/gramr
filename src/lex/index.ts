import * as core from '@/core';
import { $, Recursive, Rule } from '@/core';

export type LexRule<O> = Rule<string, O>;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const split = (str: string) =>
  Array.from(segmenter.segment(str), ({ segment }) => segment);

function isSubarrayEqual<E>(a: E[], b: E[], pos: number) {
  // Ensure the subarray is within bounds
  if (pos < 0 || pos + b.length > a.length) {
    return false; // Out of bounds
  }

  // Compare elements in A[P] to A[P + B.length - 1] with B
  for (let i = 0; i < b.length; i++) {
    if (a[pos + i] !== b[i]) {
      return false;
    }
  }

  return true; // All elements match
}
export const exact = (...str: string[]): Rule<string, undefined> => {
  const expected = str.flatMap((s) => split(s));

  return Rule((src) => (pos) => {
    if (isSubarrayEqual(src, expected, pos)) {
      return core.RuleResult.accept(undefined)(pos + expected.length);
    } else
      return core.RuleResult.reject(
        `Expected ${expected.join('')} got ${src.slice(pos, pos + expected.length).join('')}`,
      )(pos);
  });
};

export const skipWhile = (
  pred: (el: string) => boolean,
): Rule<string, undefined> =>
  Rule((src) => (pos) => {
    const loop = (pos: number): Recursive<number> => {
      if (pos < src.length && pred(src[pos])) {
        return {
          done: false,
          continue: () => loop(pos + 1),
        };
      } else {
        return {
          done: true,
          result: pos,
        };
      }
    };
    return $(Recursive.run(loop(pos)))(core.RuleResult.accept(undefined)).$;
  });

export const anyOf = (str: string): Rule<string, string> => {
  const set = new Set(split(str));
  return core.nextIf((el) => set.has(el));
};
export const noneOf = (str: string): Rule<string, string> => {
  const set = new Set(split(str));
  return core.nextIf((el) => !set.has(el));
};

export const slice = <R>(rule: Rule<string, R>): Rule<string, string[]> =>
  Rule((src) => (pos) => {
    const result = rule(src)(pos);
    switch (result.accepted) {
      case false:
        return result;
      case true:
        return $(result)(core.RuleResult.map((_) => src.slice(pos, result.pos)))
          .$;
    }
  });

export const optional = <S, R>(rule: Rule<S, R>): Rule<S, R | undefined> =>
  core.fork(rule, core.accept(undefined));

export namespace LexCursor {}
export const end: Rule<string, undefined> = core.end;

export const run =
  (text: string) =>
  <O>(rule: LexRule<O>): core.RuleResult<O> =>
    rule(split(text))(0);

export const createLexer = <T>(
  collect: [Rule<string, T>, ...Rule<string, T>[]],
  ignore?: core.Skipped<string>,
): Rule<string, T[]> => {
  const whitespace = ignore?ignore:core.skip(core.accept(undefined))
   
  const token = $(core.fork(...collect))(core.moveOrFail).$;
  return $(
    core.chain(
      whitespace,
      $(token)(core.collect({ sep: whitespace.rule })).$,
      whitespace,
    ),
  )(core.map(([ts]) => ts)).$;
};
