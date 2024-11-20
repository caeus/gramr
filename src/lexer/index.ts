import { $ } from 'gramr-ts/pipe';
import { Recursive } from 'gramr-ts/recursive';
import { RuleResult } from 'gramr-ts/result';
import { Rule } from 'gramr-ts/rule';
export type LexRule<O> = Rule<string, O>;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const split = (str: string): string[] =>
  Array.from(segmenter.segment(str), ({ segment }) => segment);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
const exact = (...str: [string, ...string[]]): Rule<string, undefined> => {
  const expected = str.flatMap((s) => split(s));
  return (src) => (pos) => {
    if (isSubarrayEqual(src, expected, pos)) {
      return RuleResult.accept(undefined)(pos + expected.length);
    } else
      return RuleResult.reject(
        `Expected ${expected.join('')} got ${src.slice(pos, pos + expected.length).join('')}`,
      )(pos);
  };
};
const slice = (rule: Rule<string, unknown>): Rule<string, string> =>
  $(rule)(Rule.slice)(Rule.map((ps) => ps.join(''))).$;

const skipWhile =
  (pred: (el: string) => boolean): Rule<string, undefined> =>
  (src) =>
  (pos): RuleResult<undefined> => {
    const loop = (pos: number): Recursive<number> => {
      if (pos < src.length && pred(src[pos])) {
        return Recursive.next(() => loop(pos + 1));
      } else {
        return Recursive.done(pos);
      }
    };
    return $(Recursive.run(loop(pos)))(RuleResult.accept(undefined)).$;
  };

const anyOf = (str: string): Rule<string, string> => {
  const set = new Set(split(str));
  return Rule.nextIf((el) => set.has(el));
};
const noneOf = (str: string): Rule<string, string> => {
  const set = new Set(split(str));
  return Rule.nextIf((el) => !set.has(el));
};

const optional = <S, R>(rule: Rule<S, R>): Rule<S, R | undefined> =>
  Rule.fork(rule, Rule.accept(undefined));

const end: Rule<string, undefined> = Rule.end;

const run =
  (text: string) =>
  <O>(rule: LexRule<O>): RuleResult<O> =>
    rule(split(text))(0);

const create = <T>(
  collect: [Rule<string, T>, ...Rule<string, T>[]],
  ignore?: Rule<string, unknown>,
): Rule<string, T[]> => {
  const whitespace = ignore ? ignore : Rule.accept(undefined);
  const token = $(Rule.fork(...collect))(Rule.nonEmpty).$;
  return $(
    Rule.chain<string>()
      .skip(whitespace)
      .push($(token)(Rule.collect({ sep: whitespace })).$).done,
  )(Rule.first).$;
};
const isWhitespace = anyOf(` \t\n\r\v\f`);

const Lexer = {
  isWhitespace,
  create,
  run,
  end,
  optional,
  slice,
  noneOf,
  anyOf,
  skipWhile,
  exact,
};
export { Lexer };
