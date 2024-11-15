export type Recursive<Out> =
  | {
      done: true;
      result: Out;
    }
  | {
      done: false;
      continue: () => Recursive<Out>;
    };

export interface $<T> {
  <R>(cont: (value: T) => R): $<R>;
  readonly $: T;
}
export interface Skipped<E> {
  readonly rule: Rule<E, undefined>;
}

export const skip = <E>(
  rule0: Rule<E, unknown>,
  ...rules: Rule<E, unknown>[]
): Skipped<E> => {
  let rule = rule0;
  for (const ruleN of rules) {
    rule = $(rule)(flatMap(() => ruleN)).$;
  }
  return { rule: $(rule)(as(undefined)).$ };
};
export function $<T>(value: T): $<T> {
  const lifted = <R>(cont: (value: T) => R): $<R> => $(cont(value));
  Object.defineProperty(lifted, '$', {
    value,
    writable: false,
    configurable: false,
  });
  return lifted as $<T>;
}
export namespace $ {
  export const fun =
    <I, O>(fn: (input: $<I>) => $<O>) =>
    (input: I): O =>
      fn($(input)).$;
}
export namespace Recursive {
  export function run<Out>(recursive: Recursive<Out>): Out {
    let rec = recursive;
    while (!rec.done) {
      rec = rec.continue();
    }
    return rec.result;
  }
}

export type Rule<E, R> = (src: E[]) => (pos: number) => RuleResult<R>;

export function Rule<E, R>(def: Rule<E, R>): Rule<E, R> {
  return def;
}
export namespace Rule {
  export const unfinished =
    <E, R>(rule: Rule<E, R>) =>
    (src: E[]) =>
    (pos: number): RuleResult<R> =>
      pos >= 0 && pos < src.length
        ? rule(src)(pos)
        : RuleResult.reject(
            `Cursor out of range (input size: ${src.length}, position: ${pos})`,
          )(pos);
}
export type RuleError = { path: string[]; msg: string; pos: number };
export type RuleResult<Out> =
  | {
      accepted: false;
      errors: RuleError[];
    }
  | {
      accepted: true;
      result: Out;
      pos: number;
    };

export namespace RuleResult {
  export const map =
    <I, O>(fn: (i: I) => O) =>
    (result: RuleResult<I>): RuleResult<O> => {
      const value = result;
      switch (value.accepted) {
        case false:
          return value;
        case true:
          return {
            accepted: true,
            result: fn(value.result),
            pos: value.pos,
          };
      }
    };
  export const accept =
    <R>(result: R) =>
    (pos: number): RuleResult<R> => ({
      accepted: true,
      result,
      pos,
    });

  export const reject =
    (msg: string) =>
    <R>(pos: number): RuleResult<R> => ({
      accepted: false,
      errors: [
        {
          pos,
          msg,
          path: [],
        },
      ],
    });
}

export type Fork<S, Rules extends [...Rule<S, unknown>[]]> =
  // case head, tail
  Rules extends [Rule<S, infer Out>, ...infer Tail extends Rule<S, unknown>[]]
    ? Out | Fork<S, Tail>
    : // case empty
      Rules extends []
      ? never
      : never;

export type Chain<
  S,
  Rules extends readonly [...(Rule<S, unknown> | Skipped<S>)[]],
> = Rules extends [
  Rule<S, infer Out>,
  ...infer Tail extends (Rule<S, unknown> | Skipped<S>)[],
]
  ? [Out, ...Chain<S, Tail>]
  : Rules extends [
        Skipped<S>,
        ...infer Tail extends (Rule<S, unknown> | Skipped<S>)[],
      ]
    ? Chain<S, Tail>
    : //case empty
      Rules extends []
      ? []
      : never;

export const flatMap =
  <E, R0, R1>(next: (value: R0) => Rule<E, R1>) =>
  (rule0: Rule<E, R0>): Rule<E, R1> =>
    Rule((src) => (pos) => {
      const result0 = rule0(src)(pos);
      switch (result0.accepted) {
        case false:
          return result0;
        case true:
          return next(result0.result)(src)(result0.pos);
      }
    });

export function chain<E>(): Rule<E, []>;
export function chain<
  E,
  RT extends readonly [...(Skipped<E> | Rule<E, unknown>)[]],
>(head: Skipped<E>, ...tail: RT): Rule<E, Chain<E, RT>>;
export function chain<
  E,
  H,
  RT extends readonly [...(Skipped<E> | Rule<E, unknown>)[]],
>(head: Rule<E, H>, ...tail: RT): Rule<E, [H, ...Chain<E, RT>]>;
export function chain<E>(
  ...rules: (Skipped<E> | Rule<E, unknown>)[]
): Rule<E, unknown[]> {
  let result: $<Rule<E, unknown[]>> = $(accept([]));
  for (const rule of rules) {
    if ('rule' in rule) {
      result = result(flatMap((result) => $(rule.rule)(as(result)).$));
    } else if (typeof rule == 'function') {
      result = result(
        flatMap((result) => $(rule)(map((el) => [...result, el])).$),
      );
    }
  }
  return result.$;
}

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

export const fork = <S, Head, Rules extends [...Rule<S, unknown>[]]>(
  head: Rule<S, Head>,
  ...rules: Rules
): Rule<S, Head | Fork<S, Rules>> =>
  Rule<S, Head | Fork<S, Rules>>((src) => (pos) => {
    const results = [head, ...rules].map((rule) => rule(src)(pos));
    const bestresult0 = results.reduce((greediest, current) =>
      bestOf(greediest, current),
    );
    return bestresult0 as RuleResult<Head | Fork<S, Rules>>;
  });
export const lazy = <E, Out>(expr: () => Rule<E, Out>) => {
  let memo: Rule<E, Out> | null = null;
  return Rule<E, Out>((src) => (pos) => {
    if (memo == null) {
      memo = expr();
    }
    return memo(src)(pos);
  });
};
export const path =
  (id: string) =>
  <S, O>(rule: Rule<S, O>): Rule<S, O> =>
    Rule((src) => (pos) => {
      const result = rule(src)(pos);
      switch (result.accepted) {
        case false:
          return {
            accepted: false,
            errors: result.errors.map((err) => ({
              path: [id, ...err.path],
              msg: err.msg,
              pos: err.pos,
            })),
          };
        case true:
          return result;
      }
    });
export const accept =
  <T>(value: T) =>
  <E>(_: E[]) =>
  (pos: number): RuleResult<T> => ({
    accepted: true,
    result: value,
    pos: pos,
  });

export const reject =
  (msg: string) =>
  <E, T>(src: E[]) =>
  (pos: number): RuleResult<T> => ({
    accepted: false,
    errors: [
      {
        path: [],
        msg,
        pos,
      },
    ],
  });

export const end =
  <E>(src: E[]) =>
  (pos: number): RuleResult<undefined> =>
    pos == src.length
      ? {
          accepted: true,
          result: undefined,
          pos,
        }
      : RuleResult.reject(`Expected EOI, got ${src[pos]} instead`)(pos);
export const map =
  <Out0, Out1>(fn: (i: Out0) => Out1) =>
  <S>(rule: Rule<S, Out0>): Rule<S, Out1> =>
    Rule((src) => (pos) => $(rule(src)(pos))(RuleResult.map(fn)).$);
export const as =
  <T>(value: T) =>
  <E, R>(rule: Rule<E, R>) =>
    map(() => value)(rule);

export const nextIf = <E>(pred: (el: E) => boolean): Rule<E, E> =>
  Rule((src) => (pos) => {
    if (pos < src.length && pred(src[pos])) {
      return RuleResult.accept(src[pos])(pos + 1);
    } else return RuleResult.reject('Condition unmet')(pos);
  });

export type Take<R> =
  | {
      readonly value: R;
    }
  | {
      readonly msg: string;
    };

export const nextAs = <E, R>(fn: (el: E) => Take<R>) =>
  Rule<E, R>((src) => (pos) => {
    const take = fn(src[pos]);
    if ('value' in take) {
      return RuleResult.accept(take.value)(pos + 1);
    } else return RuleResult.reject(take.msg)(pos);
  });

export type RepOptions<S> = {
  min?: number;
  max?: number;
  sep?: Rule<S, undefined>;
};

export const repeat =
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
            return {
              done: false,
              continue: () =>
                loop(
                  src,
                  result0.pos,
                  count + 1,
                  next,
                  next,
                  fold(result0.result, result),
                ),
            };
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
            return {
              done: false,
              continue: () =>
                loop(
                  src,
                  result0.pos,
                  count + 1,
                  next,
                  next,
                  fold(result0.result, result),
                ),
            };
          case false:
            return {
              done: true,
              result: {
                accepted: true,
                result,
                pos: pos,
              },
            };
        }
      }
    };
    return Rule<S, R>(
      (src) => (pos) =>
        Recursive.run(
          loop(
            src,
            pos,
            0,
            //use first
            rule,
            // then use this
            $(chain(sep, rule))(map(([_, v]) => v)).$,
            init(),
          ),
        ),
    );
  };

export const loop =
  <S>(options?: RepOptions<S>) =>
  (rule: Rule<S, undefined>) =>
    repeat(options)(rule)(
      () => undefined,
      () => undefined,
    );
export const collect =
  <S>(options?: RepOptions<S>) =>
  <E>(rule: Rule<S, E>) =>
    repeat(options)(rule)<E[]>(
      () => [],
      (el, r) => (r.push(el), r),
    );
export const moveOrFail =
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
