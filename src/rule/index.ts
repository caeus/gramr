import { Context } from 'gramr-ts/context';
import { $ } from 'gramr-ts/pipe';
import { Recursive } from 'gramr-ts/recursive';
import { RuleResult } from 'gramr-ts/result';

type Rule<E, R> = (src: E[]) => (pos: number) => RuleResult<R>;

const unfinished =
  <E, R>(rule: Rule<E, R>) =>
  (src: E[]) =>
  (pos: number): RuleResult<R> =>
    pos >= 0 && pos < src.length
      ? rule(src)(pos)
      : RuleResult.reject(
          `Cursor out of range (input size: ${src.length}, position: ${pos})`,
        )(pos);

type Fork<S, Rules extends [...Rule<S, unknown>[]]> =
  // case head, tail
  Rules extends [Rule<S, infer Out>, ...infer Tail extends Rule<S, unknown>[]]
    ? Out | Fork<S, Tail>
    : // case empty
      Rules extends []
      ? never
      : never;

const flatMap =
  <E, R0, R1>(next: (value: R0) => Rule<E, R1>) =>
  (rule0: Rule<E, R0>): Rule<E, R1> =>
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

const fork =
  <S, Head, Rules extends [...Rule<S, unknown>[]]>(
    head: Rule<S, Head>,
    ...rules: Rules
  ): Rule<S, Head | Fork<S, Rules>> =>
  (src: S[]) =>
  (pos): RuleResult<Head | Fork<S, Rules>> => {
    const results = [head, ...rules].map((rule) => rule(src)(pos));
    const bestresult0 = results.reduce((greediest, current) =>
      bestOf(greediest, current),
    );
    return bestresult0 as RuleResult<Head | Fork<S, Rules>>;
  };
const lazy = <E, Out>(expr: () => Rule<E, Out>): Rule<E, Out> => {
  let memo: Rule<E, Out> | null = null;
  return (src) =>
    (pos): RuleResult<Out> => {
      if (memo == null) {
        memo = expr();
      }
      return memo(src)(pos);
    };
};
const path =
  (id: string) =>
  <S, O>(rule: Rule<S, O>): Rule<S, O> =>
  (src) =>
  (pos) =>
    Context.inPath(id, () => rule(src)(pos));

const accept =
  <T>(value: T) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <E>(src: E[]) =>
  (pos: number): RuleResult<T> => ({
    accepted: true,
    result: value,
    pos: pos,
  });

const log =
  <E, R>(rule: Rule<E, R>): Rule<E, R> =>
  (src) =>
  (pos) => {
    console.log(
      `Entered rule at position ${pos} with path ${Context.getPath()}`,
    );
    const result = rule(src)(pos);
    switch (result.accepted) {
      case true:
        console.log(
          `Matched rule with path ${Context.getPath()} until position ${result.pos}`,
        );
        break;
      case false:
        console.log(
          `Rejected rule with path ${Context.getPath()} at position ${pos}`,
        );
        break;
    }

    return result;
  };

const reject =
  (msg: string) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  <E, T>(src: E[]) =>
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

const first = <E, F>(rule: Rule<E, readonly [F, ...unknown[]]>): Rule<E, F> =>
  $(rule)(map(([f]) => f)).$;

const end =
  <E>(src: E[]) =>
  (pos: number): RuleResult<undefined> =>
    pos == src.length
      ? {
          accepted: true,
          result: undefined,
          pos,
        }
      : RuleResult.reject(`Expected EOI, got ${src[pos]} instead`)(pos);
const map =
  <Out0, Out1>(fn: (i: Out0) => Out1) =>
  <S>(rule: Rule<S, Out0>): Rule<S, Out1> =>
  (src) =>
  (pos) =>
    $(rule(src)(pos))(RuleResult.map(fn)).$;
const as =
  <T>(value: T) =>
  <E, R>(rule: Rule<E, R>): Rule<E, T> =>
    map(() => value)(rule);

const nextIf =
  <E>(pred: (el: E) => boolean): Rule<E, E> =>
  (src) =>
  (pos) => {
    if (pos < src.length && pred(src[pos])) {
      return RuleResult.accept(src[pos])(pos + 1);
    } else return RuleResult.reject('Condition unmet')(pos);
  };

export type StepResult<R> =
  | {
      readonly accepted: true;
      readonly value: R;
    }
  | {
      readonly accepted: false;
      readonly msg: string;
    };

const nextAs =
  <E, R>(fn: (el: E) => StepResult<R>): Rule<E, R> =>
  (src) =>
  (pos) => {
    const result = fn(src[pos]);
    if (result.accepted) {
      return RuleResult.accept(result.value)(pos + 1);
    } else return RuleResult.reject(result.msg)(pos);
  };

type RepOptions<S> = {
  min?: number;
  max?: number;
  sep?: Rule<S, unknown>;
};

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
      src: S[],
      pos: number,
      count: number,
      use: Rule<S, E>,
      next: Rule<S, E>,
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

const loop =
  <S>(options?: RepOptions<S>) =>
  (rule: Rule<S, unknown>): Rule<S, undefined> =>
    repeat(options)(rule)(
      () => undefined,
      () => undefined,
    );
const collect =
  <S>(options?: RepOptions<S>) =>
  <E>(rule: Rule<S, E>): Rule<S, E[]> =>
    repeat(options)(rule)<E[]>(
      () => [],
      (el, r) => (r.push(el), r),
    );
const nonEmpty =
  <E, T>(rule: Rule<E, T>): Rule<E, T> =>
  (src) =>
  (pos) => {
    const result = rule(src)(pos);
    if (result.accepted && result.pos <= pos) {
      return RuleResult.reject(
        `Rule expected to consume input is succeeding without moving forward`,
      )(pos);
    } else return result;
  };
const slice =
  <R>(rule: Rule<string, R>): Rule<string, string[]> =>
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
type Concat<E, T extends readonly unknown[]> = {
  push<R>(rule: Rule<E, R>): Concat<E, readonly [...T, R]>;
  skip<R>(rule: Rule<E, R>): Concat<E, T>;
  done: Rule<E, T>;
};

function chain<E>(): Concat<E, readonly []>;
function chain<E, T extends readonly unknown[]>(done: Rule<E, T>): Concat<E, T>;
function chain<E>(
  done: Rule<E, readonly unknown[]> = accept([]),
): Concat<E, readonly unknown[]> {
  return {
    push: <R>(rule: Rule<E, R>): Concat<E, readonly [...unknown[], R]> =>
      chain(
        $(done)(
          flatMap((init) => $(rule)(map((last) => [...init, last] as const)).$),
        ).$,
      ),
    skip: <R>(rule: Rule<E, R>): Concat<E, readonly unknown[]> =>
      chain($(done)(flatMap((init) => $(rule)(as(init)).$)).$),
    done,
  };
}

const Rule = {
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
};
export { Rule };
