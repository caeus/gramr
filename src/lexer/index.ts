import { Recursive } from 'gramr-ts/recursive';
import { Result } from 'gramr-ts/result';
import { ResultOf, ResultsAsUnion, Rule } from 'gramr-ts/rule';
export type LexRule<O> = Rule<string, O>;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const split = (str: string): string[] =>
  Array.from(segmenter.segment(str), ({ segment }) => segment);

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function isSubarrayEqual<E>(a: readonly E[], b: E[], pos: number) {
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
/**
 *
 * @param str
 * @returns A rule that accepts the stream only if it follows exactly with str
 */
const exact = (...str: [string, ...string[]]): Rule<string, undefined> => {
  const expected = str.flatMap((s) => split(s));
  return Rule.of((src) => (pos) => {
    if (isSubarrayEqual(src, expected, pos)) {
      return Result.accept(undefined)(pos + expected.length);
    } else
      return Result.reject(
        `Expected ${expected.join('')} got ${src.slice(pos, pos + expected.length).join('')}`,
      )<undefined>(pos);
  });
};
/**
 *
 * @param rule
 * @returns A rule that returns the matched substring
 */
const slice = (rule: Rule<string, unknown>): Rule<string, string> =>
  rule.let(Rule.slice).let(Rule.map((ps) => ps.join('')));
/**
 *
 * @param pred
 * @returns A rule that matches as many characters, as long as they pass predicated pred
 */
const skipWhile = (pred: (el: string) => boolean): Rule<string, undefined> =>
  Rule.of((src) => (pos): Result<undefined> => {
    const loop = (pos: number): Recursive<number> => {
      if (pos < src.length && pred(src[pos]!)) {
        return Recursive.next(() => loop(pos + 1));
      } else {
        return Recursive.done(pos);
      }
    };
    return Result.accept(undefined)(Recursive.run(loop(pos)));
  });
/**
 *
 * @param str
 * @returns A rule that matches any character as long as it belongs to the graphemes in str
 */
const anyOf = (str: string): Rule<string, string> => {
  const set = new Set(split(str));
  return Rule.nextIf((el) => set.has(el));
};
/**
 *
 * @param str
 * @returns A rule that accepts any character, unless it belongs to the graphemes in str
 */
const noneOf = (str: string): Rule<string, string> => {
  const set = new Set(split(str));
  return Rule.nextIf((el) => !set.has(el));
};
/**
 * Matches the given rule, or nothing if original rule doesn't match
 * @param rule
 * @returns A rule that may or may not match the original rule
 */
const optional = <E, R>(rule: Rule<E, R>): Rule<E, R | undefined> =>
  Rule.fork(rule, Rule.accept(undefined));
/**
 * Matches the end of the stream only
 */
const end: Rule<string, undefined> = Rule.end();

const feed =
  (text: string) =>
  <O>(rule: LexRule<O>): Result<O> =>
    rule.run(split(text))(0);

/**
 * Matches exactly one whitspace character
 */
const whitespace = anyOf(` \t\n\r\v\f`);
/**
 * Utility function to create tokens that are discriminated by the field type
 * (ie. {type:'text'})
 * @param type
 * @param display
 * @returns
 */
const keyword = <Type extends string>(
  type: Type,
  display: string = type,
): Rule<string, { type: Type }> => exact(display).let(Rule.as({ type }));
const delimiters = <Suffix extends string>(
  suffix: Suffix,
  open: string,
  close: string,
): [
  Rule<string, { type: `open_${Suffix}` }>,
  Rule<string, { type: `close_${Suffix}` }>,
] => [keyword(`open_${suffix}`, open), keyword(`close_${suffix}`, close)];

const create = <H, Rules extends readonly [...Rule<string, unknown>[]]>(
  collect: [Rule<string, H>, ...Rules],
  ignore?: Rule<string, unknown>,
): Rule<string, ResultsAsUnion<[Rule<string, H>, ...Rules]>[]> => {
  const whitespace = ignore ? ignore : Rule.accept(undefined);
  const token = Rule.fork(...collect).let(Rule.nonEmpty);
  return Rule.chain<string>()
    .skip(whitespace)
    .push(token.let(Rule.collect({ sep: whitespace })))
    .skip(end)
    .done.let(Rule.first);
};

type TokenOf<R extends Rule<string, unknown[]>> = ResultOf<R>[number];

const Lexer = {
  whitespace,
  keyword,
  delimiters,
  create,
  feed,
  end,
  optional,
  slice,
  noneOf,
  anyOf,
  skipWhile,
  exact,
};
export { Lexer, ResultOf, TokenOf };
