import * as Result from '@/result';

import { $ } from '@/pipe';
import { Rule } from '@/rule';
import fc from 'fast-check';
import { expect, suite, test } from 'vitest';
import { Lex, LexRule } from '.';

const exact = Lex.exact;
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace rules {
  export const $null = Lex.exact('null');
  export const $bool = $(
    Rule.fork(
      //
      $(Lex.exact('false'))(Rule.as(false)).$,
      //
      $(exact('true'))(Rule.as(true)).$,
    ),
  )(Rule.path('bool')).$;
  const digit = $(Lex.anyOf('0123456789'))(Rule.as(undefined))(
    Rule.path('digit'),
  ).$;

  const digits = $(digit)(Rule.loop({ min: 1 }))(Rule.path('digits')).$;
  const sign = $(Rule.fork(exact('+'), exact('-')))(Lex.optional)(
    Rule.path('sign'),
  ).$;

  const exponent: LexRule<undefined> = $(
    Rule.chain(
      Rule.fork(exact('e'), exact('E')) as LexRule<undefined>,
      sign,
      digits,
    ),
  )(Rule.as(undefined))(Rule.path('exponent')).$;
  const fractional = $(Rule.chain(exact('.'), digits))(
    Rule.map(() => undefined),
  )(Rule.path('fractional')).$;
  export const $integral = $(
    Rule.fork(
      exact('0'),
      Rule.chain(Lex.anyOf('123456789'), $(digit)(Rule.loop()).$),
    ),
  )(Rule.path('integral')).$;
  export const $number = $(
    Rule.chain(
      sign,
      $integral,
      Lex.optional(fractional),
      Lex.optional(exponent),
    ),
  )(Lex.slice)(Rule.map((n) => JSON.parse(n.join('')) as number))(
    Rule.path('number'),
  ).$;

  const unicodeEscape = Rule.chain(
    exact('u'),
    Rule.loop<string>({ min: 4, max: 4 })(
      $(Lex.anyOf('abcdefABCDEF0123456789'))(Rule.as(undefined)).$,
    ),
  );

  const escape = Rule.chain(
    exact(`\\`),
    Rule.fork(unicodeEscape, Lex.anyOf(`"b\\/fnrt`)),
  );
  const $strChar = $(Lex.noneOf(`"\\`))(Rule.as(undefined)).$;
  export const $string = $(
    Rule.chain(
      $(Lex.exact(`"`))(Rule.path('openquote')).$,
      $(Rule.fork($strChar, escape))(Rule.as(undefined))(Rule.path('strchars'))(
        Rule.loop(),
      ).$,
      $(exact(`"`))(Rule.path('closequotes')).$,
    ),
  )(Rule.path('string')).$;

  const space = $(Rule.nextIf<string>((el) => el.trim() == ''))(
    Rule.as(undefined),
  )(Rule.loop())(Rule.skip).$;

  export const $array = $(
    Rule.lazy(() =>
      Rule.chain(
        exact(`[`),
        $(Rule.chain(space, $json))(Rule.as(undefined))(
          Rule.loop({
            sep: Rule.as(undefined)(Rule.chain(space, exact(','))),
          }),
        ).$,
        space,
        exact(`]`),
      ),
    ),
  )(Rule.as(undefined)).$;
  export const $object = $(
    Rule.lazy(() =>
      Rule.chain(
        exact(`{`),
        $(Rule.chain(space, $string, space, exact(':'), space, $json))(
          Rule.as(undefined),
        )(
          Rule.loop({
            sep: Rule.as(undefined)(Rule.chain(space, exact(','))),
          }),
        ).$,
        space,
        exact(`}`),
      ),
    ),
  )(Rule.as(undefined)).$;
  export const $json: Rule<string, undefined> = $(
    Rule.lazy(() => Rule.fork($null, $bool, $number, $string, $array, $object)),
  )(Rule.as(undefined)).$;

  export const json = $(Rule.chain(space, $json, space, Rule.end))(
    Rule.as(undefined),
  ).$;
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function loggingIfError<Fn extends Function>(fn: Fn): Fn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
        $(rules.$number)(Lex.run(JSON.stringify(x)))(
          loggingIfError((s: Result.RuleResult<number>) =>
            expect(s.accepted).toBe(true),
          ),
        );
      }),
    ),
  );
});
test('null', () => {
  $(rules.$null)(Lex.run('null'))((s) => expect(s.accepted).toBe(true));
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

  $(rules.$json)(Lex.run(sample))((s) => expect(s.accepted).toBe(true));
});
test('string', () => {
  fc.assert(
    fc.property(strArb, (str) => {
      $(rules.$string)(Lex.run(JSON.stringify(str)))((s) =>
        expect(s.accepted).toBe(true),
      );
    }),
  );
});
test('string case', () => {
  $(rules.$string)(Lex.run(JSON.stringify('zcag<20WJm')));
});

suite('json', () => {
  test('no spaces', () => {
    fc.assert(
      fc.property(
        jsonArb,
        loggingIfError((x: unknown) => {
          $(rules.json)(Lex.run(JSON.stringify(x)))(
            loggingIfError((s: Result.RuleResult<undefined>) =>
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
          $(rules.json)(Lex.run(JSON.stringify(x, null, 2)))(
            loggingIfError((s: Result.RuleResult<undefined>) =>
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
          $(rules.json)(Lex.run(JSON.stringify(x, null, 2) + '^'))(
            loggingIfError((s: Result.RuleResult<undefined>) =>
              expect(s.accepted).toBe(false),
            ),
          );
        }),
      ),
    );
  });
});
