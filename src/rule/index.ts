import { Cont } from 'gramr-ts/cont';
import { Context } from 'gramr-ts/context';
import { Recursive } from 'gramr-ts/recursive';
import { Result } from 'gramr-ts/result';

type Rule<in E, out R> = {
  readonly run: (src: readonly E[]) => (pos: number) => Result<R>;
  let<T>(cont: (value: Rule<E, R>) => T): T;
};

/**
 * The unfinished function wraps an existing rule and ensures that it only operates on valid cursor positions within the input source.
 * If the cursor is out of range, the wrapped rule immediately fails with a rejection message.
 * This prevents invalid accesses during parsing and helps maintain robust error handling.
 * @param rule
 * @returns
 */
const unfinished = <R, E>(rule: Rule<E, R>): Rule<E, R> =>
  of(
    (src: readonly E[]) =>
      (pos: number): Result<R> =>
        pos >= 0 && pos < src.length
          ? rule.run(src)(pos)
          : Result.reject(
              `Cursor out of range (input size: ${src.length}, position: ${pos})`,
            )(pos),
  );

const of = <E, R>(run: Rule<E, R>['run']): Rule<E, R> =>
  Cont({
    run,
  });
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
  <R0, R1, E>(next: (value: R0) => Rule<E, R1>) =>
  (rule0: Rule<E, R0>): Rule<E, R1> =>
    of((src) => (pos) => {
      const result0 = rule0.run(src)(pos);
      switch (result0.accepted) {
        case false:
          return Result.of(result0);
        case true:
          return next(result0.result).run(src)(result0.pos);
      }
    });

function bestOf<T0, T1>(
  result0: Result<T0>,
  result1: Result<T1>,
): Result<T0 | T1> {
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
          return Result.of({
            accepted: false,
            errors: [...result0.errors, ...result1.errors],
          });
      }
  }
}

type ElemOf<R extends Rule<never, unknown>> =
  R extends Rule<infer E, unknown> ? E : never;
type ResultOf<P extends Rule<never, unknown>> =
  P extends Rule<never, infer R> ? R : never;
type ResultsOf<R extends readonly Rule<never, unknown>[]> = R extends [
  Rule<never, infer H>,
  infer RT extends readonly Rule<never, unknown>[],
]
  ? readonly [H, ...ResultsOf<RT>]
  : R extends readonly Rule<never, infer RR>[]
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
type ResultsAsUnion<R extends readonly Rule<never, unknown>[]> = AsUnion<
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
  H extends Rule<never, unknown>,
  T extends readonly [...Rule<ElemOf<H>, unknown>[]],
>(
  head: H,
  ...tail: T
): Rule<ElemOf<H>, ResultsAsUnion<[H, ...T]>> => {
  return of(
    (src: readonly ElemOf<H>[]) =>
      (pos): Result<ResultsAsUnion<[H, ...T]>> => {
        const rules: Rule<ElemOf<H>, unknown>[] = [
          head as unknown as Rule<ElemOf<H>, unknown>,
          ...tail,
        ];
        const results = rules.map((rule) => rule.run(src)(pos));
        const bestresult0 = results.reduce((greediest, current) =>
          bestOf(greediest, current),
        );
        return bestresult0 as Result<ResultsAsUnion<[H, ...T]>>;
      },
  );
};

/**
 * The lazy function creates a Rule that defers the evaluation of a given rule until it is needed.
 * It wraps a rule-generating function (rule) in a way that the rule is constructed and memoized only on the first invocation.
 * This is useful in scenarios where rules are defined recursively or depend on other rules that may not yet be fully constructed.
 * @param expr
 * @returns A rule that is lazily evaluated
 */
const lazy = <E, R>(rule: () => Rule<E, R>): Rule<E, R> => {
  let memo: Rule<E, R>['run'] | null = null;
  return of((src) => (pos): Result<R> => {
    if (memo == null) {
      memo = rule().run;
    }
    return memo(src)(pos);
  });
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
  <E, R>(rule: Rule<E, R>): Rule<E, R> =>
    of((src) => (pos) => Context.inPath(id, () => rule.run(src)(pos)));
/**
 *
 * @param value
 * @returns A rule that instantly accepts, without consuming input, and produces the given value
 */
const accept = <E, R = unknown>(value: R): Rule<E, R> =>
  of(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (src: readonly E[]) =>
      (pos: number): Result<R> =>
        Result.accept(value)(pos),
  );

/**
 * The log function is a parser combinator that wraps a given rule and adds logging behavior.
 * It logs messages about entering the rule, whether the rule matched or rejected,
 * and where it occurred within the input.
 * This is primarily useful for debugging parsers,
 * as it provides visibility into the flow of parsing and helps identify where and why parsing decisions are being made.
 * @param rule
 * @returns A rule that prints in console when a rule is being attempted, and whether it matched or not
 */
const log = <E, R>(rule: Rule<E, R>): Rule<E, R> =>
  of((src) => (pos) => {
    console.group();
    console.log('Will attempt', 'Pos:', pos, 'Path:', Context.getPath());
    try {
      const result = rule.run(src)(pos);
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
  });
/**
 *
 * @param msg
 * @returns A rule that instantly fails with the given msg
 */
const reject =
  (msg: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <E, T>(_src: E[]) =>
  (pos: number): Result<T> =>
    Result.of({
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
const first = <F, E>(rule: Rule<E, readonly [F, ...unknown[]]>): Rule<E, F> =>
  rule.let(map(([f]) => f));
/**
 * The end function is a parser combinator that checks if the current position corresponds to the end of the input.
 * It verifies that there are no more elements left to parse by comparing the current position (pos) with the length of the input array (src).
 * If the current position is at the end of the input, it successfully completes the parse and returns a RuleResult with undefined.
 * If there are still elements left to parse, it rejects the rule and provides an error message.
 * @param src
 * @returns
 */
const end = <E>(): Rule<E, undefined> =>
  of(
    (src: readonly E[]) =>
      (pos: number): Result<undefined> =>
        pos == src.length
          ? Result.accept(undefined)(pos)
          : Result.reject(`Expected EOI, got ${src[pos]} instead`)(pos),
  );
/**
 * The map function transforms the output of an existing parser.
 * It takes a rule, applies it to input, and then modifies the parsed result using the provided transformation function (fn).
 * @param fn
 * @returns A new rule of type Rule<O, E>, which produces the transformed output
 */
const map =
  <I, O>(fn: (i: I) => O) =>
  <E>(rule: Rule<E, I>): Rule<E, O> =>
    of((src) => (pos) => rule.run(src)(pos).let(Result.map(fn)));

/**
 * The as function transforms the output of a rule into a fixed value, ignoring the actual result of the rule.
 * It applies the map combinator to return a constant value (T) ignoring the original's parser result
 * @param value
 * @returns
 */
const as =
  <T>(value: T) =>
  <E, R>(rule: Rule<E, R>): Rule<E, T> =>
    map(() => value)(rule);
/**
 *
 * @param pred The nextIf function applies a condition (pred) to the current element in the input and advances if the condition is met.
 * If the condition fails, it rejects the parse.
 * @returns
 */
const nextIf = <E>(pred: (el: E) => boolean): Rule<E, E> =>
  unfinished(
    of((src: readonly E[]) => (pos) => {
      const el = src[pos]!;
      if (pred(el)) {
        return Result.accept(el)(pos + 1);
      } else return Result.reject('Condition unmet')<E>(pos);
    }),
  );

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
const nextAs = <E, R>(fn: (el: E) => StepResult<R>): Rule<E, R> =>
  unfinished(
    of((src) => (pos) => {
      const result = fn(src[pos]!);
      if (result.accepted) {
        return Result.accept(result.value)(pos + 1);
      } else return Result.reject(result.msg)<R>(pos);
    }),
  );
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
  sep?: Rule<S, unknown>;
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
  <E>(rule: Rule<S, E>) =>
  <R>(init: () => R, fold: (el: E, result: R) => R): Rule<S, R> => {
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
      use: Rule<S, E>,
      next: Rule<S, E>,
      result: R,
    ): Recursive<Result<R>> => {
      if (count < min) {
        const result0 = use.run(src)(pos);

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
              result: Result.of(result0),
            };
        }
      } else if (count == max) {
        return {
          done: true,
          result: Result.accept(result)(pos),
        };
      } else {
        const result0 = use.run(src)(pos);
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
            return Recursive.done(
              Result.of({
                accepted: true,
                result,
                pos,
              }),
            );
        }
      }
    };
    return of(
      (src) => (pos) =>
        Recursive.run(
          loop(
            src,
            pos,
            0,
            //use first
            rule,
            // then use this
            chain<S>()
              .skip(sep)
              .push(rule)
              .done.let(map(([v]) => v)),
            init(),
          ),
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
  (rule: Rule<S, unknown>): Rule<S, undefined> =>
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
  <I>(rule: Rule<E, I>): Rule<E, I[]> =>
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
const nonEmpty = <E, T>(rule: Rule<E, T>): Rule<E, T> =>
  of((src) => (pos) => {
    const result = rule.run(src)(pos);
    if (result.accepted && result.pos <= pos) {
      return Result.reject(
        `The rule succeeded but failed to consume any input`,
      )<T>(pos);
    } else return Result.of(result);
  });
/**
 * The slice function takes a parsing rule and transforms it into a rule that returns the slice of the input string array corresponding to the region consumed by the original rule.
 * If the rule fails, the failure is propagated without modification.
 * This is useful when you need to capture the matched substring(s) rather than the provided result.
 * @param rule
 * @returns
 */
const slice = <R>(rule: Rule<string, R>): Rule<string, string[]> =>
  of((src) => (pos): Result<string[]> => {
    const result = rule.run(src)(pos);
    switch (result.accepted) {
      case false:
        return Result.of(result);
      case true:
        return Result.of(result).let(
          Result.map(() => src.slice(pos, result.pos)),
        );
    }
  });
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
  push<R>(rule: Rule<E, R>): Chain<readonly [...T, R], E>;

  /**
   * Adds a parsing rule to the chain but ignores its result. The tuple T remains unchanged.
   * @param rule
   */
  skip<R>(rule: Rule<E, R>): Chain<T, E>;
  /**
   * A final parser that combines all the rules in the chain and produces a result of type T.
   */
  done: Rule<E, T>;
};
/**
 *
 */
function chain<E>(): Chain<readonly [], E>;
/**
 *
 * @param done
 */
function chain<E, T extends readonly unknown[]>(done: Rule<E, T>): Chain<T, E>;
/**
 *
 * @param done
 * @returns returns a Chain
 */
function chain<E>(
  done: Rule<E, readonly unknown[]> = accept([]),
): Chain<readonly unknown[], E> {
  return {
    push: <R>(rule: Rule<E, R>): Chain<readonly [...unknown[], R], E> =>
      chain(
        done.let(
          flatMap((init) => rule.let(map((last) => [...init, last] as const))),
        ),
      ),
    skip: <R>(rule: Rule<E, R>): Chain<readonly unknown[], E> =>
      chain(done.let(flatMap((init) => rule.let(as(init))))),
    done,
  };
}

const optional = <R, E>(rule: Rule<E, R>): Rule<E, R | undefined> =>
  fork(rule, accept(undefined));

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
  of,
};
export { Chain, ElemOf, ResultOf, ResultsAsUnion, Rule };
