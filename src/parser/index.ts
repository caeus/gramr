import { Rule } from 'gramr-ts/rule';

type Parser<R, E> = Rule<R, E>;

const end = Rule.end;
const enclose =
  <E>(prefix: Rule<unknown, E>, suffix: Rule<unknown, E>) =>
  <R>(rule: Rule<R, E>): Rule<R, E> =>
    Rule.first(
      Rule.chain<E>()
        //
        .skip(prefix)
        .push(rule)
        //
        .skip(suffix).done,
    );
const Parser = { end, enclose };
export { Parser };
