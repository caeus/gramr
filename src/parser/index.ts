import { RuleResult } from 'gramr-ts/result';
import { Rule } from 'gramr-ts/rule';

const match =
  <K, E>(type: (elem: E) => K) =>
  (k: K): Rule<E, E> =>
    Rule.unfinished<E, E>((src: E[]) => (pos: number) => {
      const el = src[pos]!;
      const ck = type(el);
      if (ck == k) {
        return RuleResult.accept(el)(pos + 1);
      }
      return RuleResult.reject(`Expected ${k}, got ${ck} instead`)(pos);
    });
type Parser<E, R> = Rule<E, R>;

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
const Parser = { end, match, enclose };
export { Parser };
