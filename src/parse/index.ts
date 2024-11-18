import { RuleResult } from '@/result';
import { Rule } from '@/rule';

export const token =
  <K, E>(type: (elem: E) => K) =>
  (k: K): Rule<E, E> =>
    Rule.unfinished<E, E>((src: E[]) => (pos: number) => {
      const el = src[pos];
      const ck = type(el);
      if (ck == k) {
        return RuleResult.accept(el)(pos + 1);
      }
      return RuleResult.reject(`Expected ${k}, got ${ck} instead`)(pos);
    });

const end = Rule.end;
export const Parse = { end, token };
