import { Cont, DeCont } from 'gramr-ts/cont';

type Rejection = { path: string[]; msg: string; pos: number };
type Accepted<R> = {
  accepted: true;
  result: R;
  pos: number;
};
type Rejected = {
  accepted: false;
  errors: Rejection[];
};
type Result<R> = Cont<Accepted<R> | Rejected>;
const of = <R>(val: DeCont<Result<R>>): Result<R> => {
  return Cont(val);
};
const map =
  <I, O>(fn: (i: I) => O) =>
  (result: Result<I>): Result<O> => {
    const value = result;

    switch (value.accepted) {
      case false:
        return of(value);
      case true:
        return accept(fn(value.result))(value.pos);
    }
  };

const accept =
  <R>(result: R) =>
  (pos: number): Result<R> =>
    of({
      accepted: true,
      result,
      pos,
    });

const reject =
  (msg: string) =>
  <R>(pos: number): Result<R> =>
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

const Result = { accept, reject, map, of };
export { Rejection, Result };
