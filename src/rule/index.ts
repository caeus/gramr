import { Context } from 'gramr-ts/context';
import { $ } from 'gramr-ts/pipe';
import { Recursive } from 'gramr-ts/recursive';
import { RuleResult } from 'gramr-ts/result';

type Rule<out R, in E = unknown> = (
  src: readonly E[],
) => (pos: number) => RuleResult<R>;
/**
 * The unfinished function wraps an existing rule and ensures that it only operates on valid cursor positions within the input source.
 * If the cursor is out of range, the wrapped rule immediately fails with a rejection message.
 * This prevents invalid accesses during parsing and helps maintain robust error handling.
 * @param rule
 * @returns
 */
const unfinished =
  <R, E>(rule: Rule<R, E>) =>
  (src: readonly E[]) =>
  (pos: number): RuleResult<R> =>
    pos >= 0 && pos < src.length
      ? rule(src)(pos)
      : RuleResult.reject(
          `Cursor out of range (input size: ${src.length}, position: ${pos})`,
        )(pos);

/**
 * The flatMap function is a combinator that allows chaining of parsing rules.
 * It transforms the result of one rule (rule0) and feeds it into a function (next) that produces another rule.
 * This is particularly useful for sequential parsing where the result of one rule determines the next rule to be applied.
 * @param next A function that takes the result of the first rule (rule0) and returns the next rule to be applied.
 * This enables dynamic rule composition based on the intermediate result.
 * @param rule0 The initial rule to be evaluated. Its result is passed into the next function if it successfully matches.
 * @returns A new rule that represents the composition of rule0 and the dynamically generated rule from next.
 */
const flatMap =
  <R0, R1, E>(next: (value: R0) => Rule<R1, E>) =>
  (rule0: Rule<R0, E>): Rule<R1, E> =>
  (src) =>
  (pos) => {
    const result0 = rule0(src)(pos);
    switch (result0.accepted) {
      case false:
        return result0;
      case true:
        return next(result0.result)(src)(result0.pos);
    }
  };

function bestOf<T0, T1>(
  result0: RuleResult<T0>,
  result1: RuleResult<T1>,
): RuleResult<T0 | T1> {
  switch (result0.accepted) {
    case true:
      switch (result1.accepted) {
        case true:
          return result0.pos >= result1.pos ? result0 : result1;
        default:
          return result0;
      }
    default:
      switch (result1.accepted) {
        case true:
          return result1;
        case false:
          return {
            accepted: false,
            errors: [...result0.errors, ...result1.errors],
          };
      }
  }
}

type ElemOf<R extends Rule<unknown, never>> =
  R extends Rule<unknown, infer E> ? E : never;
type ResultOf<P extends Rule<unknown, never>> =
  P extends Rule<infer R, never> ? R : never;
type ResultsOf<R extends readonly Rule<unknown, never>[]> = R extends [
  Rule<infer H, never>,
  infer RT extends readonly Rule<unknown, never>[],
]
  ? readonly [H, ...ResultsOf<RT>]
  : R extends readonly Rule<infer RR, never>[]
    ? readonly RR[]
    : R extends []
      ? []
      : never;
type AsUnion<Os extends readonly unknown[]> = Os extends [
  infer H,
  ...infer T extends readonly unknown[],
]
  ? H | AsUnion<T>
  : Os extends readonly (infer T)[]
    ? T
    : Os extends []
      ? never
      : unknown;
type ResultsAsUnion<R extends readonly Rule<unknown, never>[]> = AsUnion<
  ResultsOf<R>
>;
/**
 * The fork function combines multiple parsing rules into a single rule.
 * It evaluates all the provided rules at the same input position, and it selects the greediest result
 * based on most consumed input.
 * This allows for flexible parsing when multiple potential interpretations of the input are possible.
 * @param head First rule to be combined
 * @param tail Other rules to be combined
 * @returns
 */

const fork = <
  H extends Rule<unknown, never>,
  T extends readonly [...Rule<unknown, ElemOf<H>>[]],
>(
  head: H,
  ...tail: T
): Rule<ResultsAsUnion<[H, ...T]>, ElemOf<H>> => {
  return (src: readonly ElemOf<H>[]) =>
    (pos): RuleResult<ResultsAsUnion<[H, ...T]>> => {
      const rules: Rule<unknown, ElemOf<H>>[] = [
        head as unknown as Rule<unknown, ElemOf<H>>,
        ...tail,
      ];
      const results = rules.map((rule) => rule(src)(pos));
      const bestresult0 = results.reduce((greediest, current) =>
        bestOf(greediest, current),
      );
      return bestresult0 as RuleResult<ResultsAsUnion<[H, ...T]>>;
    };
};
const version: 4 = 4 as const;

/**
 * The lazy function creates a Rule that defers the evaluation of a given rule until it is needed.
 * It wraps a rule-generating function (rule) in a way that the rule is constructed and memoized only on the first invocation.
 * This is useful in scenarios where rules are defined recursively or depend on other rules that may not yet be fully constructed.
 * @param expr
 * @returns A rule that is lazily evaluated
 */
const lazy = <E, Out>(rule: () => Rule<Out, E>): Rule<Out, E> => {
  let memo: Rule<Out, E> | null = null;
  return (src) =>
    (pos): RuleResult<Out> => {
      if (memo == null) {
        memo = rule();
      }
      return memo(src)(pos);
    };
};
/**
 * The path function is a parser combinator that wraps a given rule and associates it with a specific id.
 * This can be useful for debugging or logging,
 * as it allows the parser to track which part of the parsing process is currently being executed.
 * The function associates the rule with a path in the context,
 * enabling features such as error reporting and context-aware debugging.
 * The id serves as a label for this particular parsing step,
 * which can help identify where in the parsing process the rule is being applied.
 * @param id
 * @returns A marked rule that always includes the path segment id
 */
const path =
  (id: string) =>
  <S, O>(rule: Rule<O, S>): Rule<O, S> =>
  (src) =>
  (pos) =>
    Context.inPath(id, () => rule(src)(pos));
/**
 *
 * @param value
 * @returns A rule that instantly accepts, without consuming input, and produces the given value
 */
const accept =
  <T>(value: T) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <E>(src: readonly E[]) =>
  (pos: number): RuleResult<T> => ({
    accepted: true,
    result: value,
    pos: pos,
  });
/**
 * The log function is a parser combinator that wraps a given rule and adds logging behavior.
 * It logs messages about entering the rule, whether the rule matched or rejected,
 * and where it occurred within the input.
 * This is primarily useful for debugging parsers,
 * as it provides visibility into the flow of parsing and helps identify where and why parsing decisions are being made.
 * @param rule
 * @returns A rule that prints in console when a rule is being attempted, and whether it matched or not
 */
const log =
  <E, R>(rule: Rule<R, E>): Rule<R, E> =>
  (src) =>
  (pos) => {
    console.group();
    console.log('Will attempt', 'Pos:', pos, 'Path:', Context.getPath());
    try {
      const result = rule(src)(pos);
      switch (result.accepted) {
        case true:
          console.log(
            'Matched',
            'Path:',
            Context.getPath(),
            'Pos:',
            result.pos,
          );
          break;
        case false:
          console.warn('Rejected', 'Pos:', pos, 'Path:', Context.getPath());
          break;
      }
      return result;
    } catch (e: unknown) {
      console.error('Failed', 'Pos:', pos, 'Path:', Context.getPath());
      throw e;
    } finally {
      console.groupEnd();
    }
  };
/**
 *
 * @param msg
 * @returns A rule that instantly fails with the given msg
 */
const reject =
  (msg: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <E, T>(_src: E[]) =>
  (pos: number): RuleResult<T> => ({
    accepted: false,
    errors: [
      {
        path: Context.getPath(),
        msg,
        pos,
      },
    ],
  });
/**
 * Takes a rule that returns a non empty tuple, and returns a rule that returns said tuple's first value
 * @param rule A rule that returns a non empty tuple
 * @returns
 */
const first = <F, E>(rule: Rule<readonly [F, ...unknown[]], E>): Rule<F, E> =>
  $(rule)(map(([f]) => f)).$;
/**
 * The end function is a parser combinator that checks if the current position corresponds to the end of the input.
 * It verifies that there are no more elements left to parse by comparing the current position (pos) with the length of the input array (src).
 * If the current position is at the end of the input, it successfully completes the parse and returns a RuleResult with undefined.
 * If there are still elements left to parse, it rejects the rule and provides an error message.
 * @param src
 * @returns
 */
const end =
  <E>(src: readonly E[]) =>
  (pos: number): RuleResult<undefined> =>
    pos == src.length
      ? {
          accepted: true,
          result: undefined,
          pos,
        }
      : RuleResult.reject(`Expected EOI, got ${src[pos]} instead`)(pos);
/**
 * The map function transforms the output of an existing parser.
 * It takes a rule, applies it to input, and then modifies the parsed result using the provided transformation function (fn).
 * @param fn
 * @returns A new rule of type Rule<O, E>, which produces the transformed output
 */
const map =
  <I, O>(fn: (i: I) => O) =>
  <E>(rule: Rule<I, E>): Rule<O, E> =>
  (src) =>
  (pos) =>
    $(rule(src)(pos))(RuleResult.map(fn)).$;

/**
 * The as function transforms the output of a rule into a fixed value, ignoring the actual result of the rule.
 * It applies the map combinator to return a constant value (T) ignoring the original's parser result
 * @param value
 * @returns
 */
const as =
  <T>(value: T) =>
  <E, R>(rule: Rule<R, E>): Rule<T, E> =>
    map(() => value)(rule);
/**
 *
 * @param pred The nextIf function applies a condition (pred) to the current element in the input and advances if the condition is met.
 * If the condition fails, it rejects the parse.
 * @returns
 */
const nextIf = <E>(pred: (el: E) => boolean): Rule<E, E> =>
  unfinished((src) => (pos) => {
    const el = src[pos]!;
    if (pred(el)) {
      return RuleResult.accept(el)(pos + 1);
    } else return RuleResult.reject('Condition unmet')(pos);
  });

export type StepResult<R> =
  | {
      readonly accepted: true;
      readonly value: R;
    }
  | {
      readonly accepted: false;
      readonly msg: string;
    };
/**
 * The nextAs function applies a predicate function (fn) to the current element in the input and returns a StepResult.
 * If the StepResult is successful (accepted: true), it advances the position and returns the value
 *  If it fails (accepted: false), it rejects with the provided msg.
 * @param fn
 * @returns
 */
const nextAs = <E, R>(fn: (el: E) => StepResult<R>): Rule<R, E> =>
  unfinished((src) => (pos) => {
    const result = fn(src[pos]!);
    if (result.accepted) {
      return RuleResult.accept(result.value)(pos + 1);
    } else return RuleResult.reject(result.msg)(pos);
  });
/**
 * RepOptions is a configuration type used to control the behavior of repetition-based parser combinators.
 * It provides options for limiting the number of repetitions, enforcing separators between repetitions, and managing repetition boundaries.
 */
type RepOptions<S> = {
  /**
   * The minimum number of repetitions that must occur for the rule to succeed.
   * If the parser encounters fewer repetitions than specified, it will fail.
   */
  min?: number;
  /**
   * The maximum number of repetitions allowed for the rule.
   * If the parser encounters more repetitions than specified, it will stop matching and return the result.
   */
  max?: number;
  /**
   * A rule that matches the separator between repetitions.
   * This is useful for handling cases where repetitions are separated by a specific token or pattern
   * (like commas between list items).
   */
  sep?: Rule<unknown, S>;
};
/**
 * The repeat function is a parser combinator that allows for repeating a rule a specific number of times,
 * optionally consuming a separator between repetitions.
 * It takes in options that control the minimum and maximum number of repetitions,
 * as well as the separator between elements.
 * The rule's result is accumulated via a fold function,
 * and an initial value is provided through init
 * @param options
 * @returns
 */
const repeat =
  <S>(options?: RepOptions<S>) =>
  <E>(rule: Rule<E, S>) =>
  <R>(init: () => R, fold: (el: E, result: R) => R): Rule<R, S> => {
    const max = options?.max;
    const min = options?.min ?? 0;
    const sep = options?.sep ?? accept(undefined);
    if (min < 0) {
      throw `Min must be 0 or positive`;
    }
    if (typeof max == 'number' && max < min) {
      throw 'Max must be greater or equal to Min';
    }
    const loop = (
      src: readonly S[],
      pos: number,
      count: number,
      use: Rule<E, S>,
      next: Rule<E, S>,
      result: R,
    ): Recursive<RuleResult<R>> => {
      if (count < min) {
        const result0 = use(src)(pos);
        switch (result0.accepted) {
          case true:
            return Recursive.next(() =>
              loop(
                src,
                result0.pos,
                count + 1,
                next,
                next,
                fold(result0.result, result),
              ),
            );

          case false:
            return {
              done: true,
              result: result0,
            };
        }
      } else if (count == max) {
        return {
          done: true,
          result: {
            accepted: true,
            result,
            pos,
          },
        };
      } else {
        const result0 = use(src)(pos);
        switch (result0.accepted) {
          case true:
            return Recursive.next(() =>
              loop(
                src,
                result0.pos,
                count + 1,
                next,
                next,
                fold(result0.result, result),
              ),
            );
          case false:
            return Recursive.done({
              accepted: true,
              result,
              pos: pos,
            });
        }
      }
    };
    return (src) => (pos) =>
      Recursive.run(
        loop(
          src,
          pos,
          0,
          //use first
          rule,
          // then use this
          $(chain<S>().skip(sep).push(rule).done)(map(([v]) => v)).$,
          init(),
        ),
      );
  };
/**
 * The loop function creates a parser combinator that repeatedly applies a given rule but discards all its results.
 * It is useful for cases where the rule needs to match a repeated pattern, but the output of the matches is not needed.
 * @param options
 * @returns
 */
const loop =
  <S>(options?: RepOptions<S>) =>
  (rule: Rule<unknown, S>): Rule<undefined, S> =>
    repeat(options)(rule)(
      () => undefined,
      () => undefined,
    );
/**
 * The collect function creates a parser combinator that repeatedly applies a given rule and collects the results into an array.
 * It is a high-level utility for scenarios where you need to match a repeating pattern and aggregate all matched values.
 * @param options
 * @returns
 */
const collect =
  <E>(options?: RepOptions<E>) =>
  <I>(rule: Rule<I, E>): Rule<I[], E> =>
    repeat(options)(rule)<I[]>(
      () => [],
      (el, r) => (r.push(el), r),
    );
/**
 * The nonEmpty function wraps an existing rule to enforce that it must consume input when it succeeds.
 * If the wrapped rule accepts the input but fails to advance the parsing position, nonEmpty rejects the result with an appropriate error message.
 * This helps ensure that rules behave as intended, especially in contexts where progress through the input is mandatory.
 * @param rule
 * @returns
 */
const nonEmpty =
  <E, T>(rule: Rule<T, E>): Rule<T, E> =>
  (src) =>
  (pos) => {
    const result = rule(src)(pos);
    if (result.accepted && result.pos <= pos) {
      return RuleResult.reject(
        `The rule succeeded but failed to consume any input`,
      )(pos);
    } else return result;
  };
/**
 * The slice function takes a parsing rule and transforms it into a rule that returns the slice of the input string array corresponding to the region consumed by the original rule.
 * If the rule fails, the failure is propagated without modification.
 * This is useful when you need to capture the matched substring(s) rather than the provided result.
 * @param rule
 * @returns
 */
const slice =
  <R>(rule: Rule<R, string>): Rule<string[], string> =>
  (src) =>
  (pos): RuleResult<string[]> => {
    const result = rule(src)(pos);
    switch (result.accepted) {
      case false:
        return result;
      case true:
        return $(result)(RuleResult.map(() => src.slice(pos, result.pos))).$;
    }
  };
/**
 * The Chain type represents a composable chain of parser rules,
 * allowing for step-by-step construction of parsing logic with flexibility for handling results.
 */
type Chain<T extends readonly unknown[], E> = {
  /**
   * Adds a new parsing rule to the chain.
   * The result of the rule (R) is appended to the tuple T, maintaining a record of all accumulated results.
   * @param rule
   */
  push<R>(rule: Rule<R, E>): Chain<readonly [...T, R], E>;

  /**
   * Adds a parsing rule to the chain but ignores its result. The tuple T remains unchanged.
   * @param rule
   */
  skip<R>(rule: Rule<R, E>): Chain<T, E>;
  /**
   * A final parser that combines all the rules in the chain and produces a result of type T.
   */
  done: Rule<T, E>;
};
/**
 *
 */
function chain<E>(): Chain<readonly [], E>;
/**
 *
 * @param done
 */
function chain<E, T extends readonly unknown[]>(done: Rule<T, E>): Chain<T, E>;
/**
 *
 * @param done
 * @returns returns a Chain
 */
function chain<E>(
  done: Rule<readonly unknown[], E> = accept([]),
): Chain<readonly unknown[], E> {
  return {
    push: <R>(rule: Rule<R, E>): Chain<readonly [...unknown[], R], E> =>
      chain(
        $(done)(
          flatMap((init) => $(rule)(map((last) => [...init, last] as const)).$),
        ).$,
      ),
    skip: <R>(rule: Rule<R, E>): Chain<readonly unknown[], E> =>
      chain($(done)(flatMap((init) => $(rule)(as(init)).$)).$),
    done,
  };
}

const optional = <R, E>(rule: Rule<R, E>): Rule<R | undefined, E> =>
  fork(rule, accept(undefined)<E>);

const Rule = {
  optional,
  first,
  chain,
  collect,
  loop,
  nonEmpty,
  repeat,
  fork,
  path,
  as,
  nextAs,
  nextIf,
  lazy,
  reject,
  accept,
  end,
  map,
  unfinished,
  slice,
  log,
  version,
};
export { Chain, ElemOf, ResultOf, ResultsAsUnion, Rule };
