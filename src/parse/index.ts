import * as core from '@/core';
import { Rule } from '@/core';

export const token =
  <K, E>(type: (elem: E) => K) =>
  (k: K): Rule<E, E> =>
    Rule.unfinished<E, E>((src: E[]) => (pos: number) => {
      const el = src[pos];
      const ck = type(el);
      const s = core.RuleResult.accept(el)(pos + 1);
      if (ck == k) {
        return core.RuleResult.accept(el)(pos + 1);
      }
      return core.RuleResult.reject(`Expected ${k}, got ${ck} instead`)(pos);
    });

export namespace ParseCursor {}
export const end = core.end;
