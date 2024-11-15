import {
  $,
  as,
  chain,
  fork,
  lazy,
  loop,
  map,
  nextIf,
  path,
  Rule,
  RuleResult,
  skip,
} from '@/core';
import fc from 'fast-check';
import { expect, suite, test } from 'vitest';
import { anyOf, end, exact, LexRule, noneOf, optional, run, slice } from '.';

namespace rules {
  export const $null = exact('null');
  export const $bool = $(
    fork(
      $(exact('false'))(map((_) => false)).$,
      $(exact('true'))(map((_) => true)).$,
    ),
  )(path('bool')).$;
  const digit = $(anyOf('0123456789'))(as(undefined))(path('digit')).$;

  const digits = $(digit)(loop({ min: 1 }))(path('digits')).$;
  const sign = $(fork(exact('+'), exact('-')))(optional)(path('sign')).$;

  const exponent: LexRule<undefined> = $(
    chain(fork(exact('e'), exact('E')) as LexRule<undefined>, sign, digits),
  )(as(undefined))(path('exponent')).$;
  const fractional = $(chain(exact('.'), digits))(map(() => undefined))(
    path('fractional'),
  ).$;
  export const $integral = $(
    fork(exact('0'), chain(anyOf('123456789'), $(digit)(loop()).$)),
  )(path('integral')).$;
  export const $number = $(
    chain(sign, $integral, optional(fractional), optional(exponent)),
  )(slice)(map((n) => JSON.parse(n.join('')) as number))(path('number')).$;

  const unicodeEscape = chain(
    exact('u'),
    loop<string>({ min: 4, max: 4 })(
      $(anyOf('abcdefABCDEF0123456789'))(as(undefined)).$,
    ),
  );

  const escape = chain(exact(`\\`), fork(unicodeEscape, anyOf(`"b\\/fnrt`)));
  const $strChar = $(noneOf(`"\\`))(as(undefined)).$;
  export const $string = $(
    chain(
      $(exact(`"`))(path('openquote')).$,
      $(fork($strChar, escape))(as(undefined))(path('strchars'))(loop()).$,
      $(exact(`"`))(path('closequotes')).$,
    ),
  )(path('string')).$;

  const space = $(nextIf<string>((el) => el.trim() == ''))(as(undefined))(
    loop(),
  )(skip).$;

  export const $array = $(
    lazy(() =>
      chain(
        exact(`[`),
        $(chain(space, $json))(as(undefined))(
          loop({
            sep: as(undefined)(chain(space, exact(','))),
          }),
        ).$,
        space,
        exact(`]`),
      ),
    ),
  )(as(undefined)).$;
  export const $object = $(
    lazy(() =>
      chain(
        exact(`{`),
        $(chain(space, $string, space, exact(':'), space, $json))(
          as(undefined),
        )(
          loop({
            sep: as(undefined)(chain(space, exact(','))),
          }),
        ).$,
        space,
        exact(`}`),
      ),
    ),
  )(as(undefined)).$;
  export const $json: Rule<string, undefined> = $(
    lazy(() => fork($null, $bool, $number, $string, $array, $object)),
  )(as(undefined)).$;

  export const json = $(chain(space, $json, space, end))(as(undefined)).$;
}

const {
  json: jsonArb,
  number: numArb,
  string: strArb,
} = fc.letrec((tie) => ({
  null: fc.constant(null),
  boolean: fc.boolean(),
  number: fc.float({
    noDefaultInfinity: true,
    noNaN: true,
  }),
  string: fc.string(),
  array: fc.array(tie('json')),
  object: fc.dictionary(fc.string(), tie('json')),
  json: fc.oneof(
    tie('null'),
    tie('boolean'),
    tie('number'),
    tie('array'),
    tie('object'),
  ),
}));

function loggingIfError<Fn extends Function>(fn: Fn): Fn {
  function decorated(...args: any[]): any {
    try {
      return fn(...args);
    } catch (e) {
      console.log('raw', args);
      console.log(JSON.stringify(args, null, 2));
      throw e;
    }
  }
  return decorated as unknown as Fn;
}

test('numbers', () => {
  fc.assert(
    fc.property(
      numArb,
      loggingIfError((x: number) => {
        $(rules.$number)(run(JSON.stringify(x)))(
          loggingIfError((s: RuleResult<number>) =>
            expect(s.accepted).toBe(true),
          ),
        );
      }),
    ),
  );
});
test('null', () => {
  $(rules.$null)(run('null'))((s) => expect(s.accepted).toBe(true));
});

test('done', () => {
  const sample = JSON.stringify(
    {
      '&~"': null,
      ';<XfjF$Q': true,
      '': false,
      '8i\\K%Go.': {
        '0': {},
        'f252:': null,
        'hI(~]8X': {
          JyB: null,
          '2.CqZ()': null,
          '5J)P3$Cx': null,
          '[uq?`6=]{': null,
          ']P;dw': null,
          '}n[5 =f81#': null,
          'e<.At': [[null, null], null],
          '+hox(Lo': null,
          "q-r4'Hw": true,
          dP_xUcFb: null,
        },
        '': [],
        '[z3w>': false,
      },
      r: [null, null, null],
      '6^|4h': false,
      'BpJN9l>n_w': {
        'Pf_{KeN53{': null,
        '': null,
        wQXiOz: null,
        P: null,
        G: null,
        'F4x3Y1#?}': null,
        ';0*^+z': null,
      },
      'I[:,n': null,
      '*qJ||': [
        [
          null,
          [],
          null,
          [
            null,
            null,
            null,
            {
              'r=?t]': null,
              'of0N/;@_V': null,
              't9N|S}QyJ': null,
              _: null,
              'jR_$}6': null,
            },
            null,
            null,
            null,
          ],
          null,
          null,
        ],
      ],
      '{|fmLz': {
        '8j_X': false,
        '(7W+UkEP': null,
        S: null,
        'UV-': null,
        '^)u': null,
      },
    },
    null,
    2,
  );

  $(rules.$json)(run(sample))((s) => expect(s.accepted).toBe(true));
});
test('string', () => {
  fc.assert(
    fc.property(strArb, (str) => {
      $(rules.$string)(run(JSON.stringify(str)))((s) =>
        expect(s.accepted).toBe(true),
      );
    }),
  );
});
test('string case', () => {
  $(rules.$string)(run(JSON.stringify('zcag<20WJm')));
});

suite('json', () => {
  test('no spaces', () => {
    fc.assert(
      fc.property(
        jsonArb,
        loggingIfError((x: unknown) => {
          $(rules.json)(run(JSON.stringify(x)))(
            loggingIfError((s: RuleResult<undefined>) =>
              expect(s.accepted).toBe(true),
            ),
          );
        }),
      ),
    );
  });

  test('spaces', () => {
    fc.assert(
      fc.property(
        jsonArb,
        loggingIfError((x: unknown) => {
          $(rules.json)(run(JSON.stringify(x, null, 2)))(
            loggingIfError((s: RuleResult<undefined>) =>
              expect(s.accepted).toBe(true),
            ),
          );
        }),
      ),
    );
  });
  test('invalid', () => {
    fc.assert(
      fc.property(
        jsonArb,
        loggingIfError((x: unknown) => {
          $(rules.json)(run(JSON.stringify(x, null, 2) + '^'))(
            loggingIfError((s: RuleResult<undefined>) =>
              expect(s.accepted).toBe(false),
            ),
          );
        }),
      ),
    );
  });
});
