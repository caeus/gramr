import { Rule } from 'gramr-ts/rule';

type Parser<R, E> = Rule<E, R>;

const end = Rule.end;
const enclose =
  <E>(prefix: Rule<E, unknown>, suffix: Rule<E, unknown>) =>
  <R>(rule: Rule<E, R>): Rule<E, R> =>
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
