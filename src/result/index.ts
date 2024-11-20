type RuleError = { path: string[]; msg: string; pos: number };
type RuleResult<Out> =
  | {
      accepted: false;
      errors: RuleError[];
    }
  | {
      accepted: true;
      result: Out;
      pos: number;
    };

const map =
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
const accept =
  <R>(result: R) =>
  (pos: number): RuleResult<R> => ({
    accepted: true,
    result,
    pos,
  });

const reject =
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

const RuleResult = { accept, reject, map };
export { RuleResult, RuleError };
