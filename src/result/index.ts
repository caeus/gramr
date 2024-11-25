type RuleError = { path: string[]; msg: string; pos: number };

type RuleResult<Out> = {
  val:
    | {
        accepted: false;
        errors: RuleError[];
      }
    | {
        accepted: true;
        result: Out;
        pos: number;
      };
  let: <R>(cont: (self: RuleResult<Out>) => R) => R;
};
const of = <R>(val: RuleResult<R>['val']): RuleResult<R> => {
  const result: RuleResult<R> = {
    val,
    let: <T>(cont: (self: RuleResult<R>) => T) => cont(result),
  };
  return result;
};
const map =
  <I, O>(fn: (i: I) => O) =>
  (result: RuleResult<I>): RuleResult<O> => {
    const value = result.val;
    switch (value.accepted) {
      case false:
        return of(value);
      case true:
        return accept(fn(value.result))(value.pos);
    }
  };

const accept =
  <R>(result: R) =>
  (pos: number): RuleResult<R> =>
    of({
      accepted: true,
      result,
      pos,
    });

const reject =
  (msg: string) =>
  <R>(pos: number): RuleResult<R> =>
    of({
      accepted: false,
      errors: [
        {
          pos,
          msg,
          path: [],
        },
      ],
    });

const RuleResult = { accept, reject, map, of };
export { RuleError, RuleResult };
