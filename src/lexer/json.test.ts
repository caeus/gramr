import * as Result from 'gramr-ts/result';

import fc from 'fast-check';
import { $ } from 'gramr-ts/pipe';
import { Rule } from 'gramr-ts/rule';
import { expect, suite, test } from 'vitest';
import { Lexer, LexRule } from '.';

const exact = Lexer.exact;
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace rules {
  export const $null = Lexer.exact('null');
  export const $bool = $(
    Rule.fork(
      //
      $(Lexer.exact('false'))(Rule.as(false)).$,
      //
      $(exact('true'))(Rule.as(true)).$,
    ),
  )(Rule.path('bool')).$;
  const digit = $(Lexer.anyOf('0123456789'))(Rule.as(undefined))(
    Rule.path('digit'),
  ).$;

  const digits = $(digit)(Rule.loop({ min: 1 }))(Rule.path('digits')).$;
  const sign = $(Rule.fork(exact('+'), exact('-')))(Lexer.optional)(
    Rule.path('sign'),
  ).$;

  const exponent: LexRule<undefined> = $(
    Rule.chain<string>()
      .skip(Rule.fork(exact('e'), exact('E')))
      .skip(sign)
      .skip(digits).done,
  )(Rule.as(undefined))(Rule.path('exponent')).$;
  const fractional = $(Rule.chain<string>().skip(exact('.')).skip(digits).done)(
    Rule.as(undefined),
  )(Rule.path('fractional')).$;
  export const $integral = $(
    Rule.fork(
      exact('0'),
      Rule.chain<string>()
        .skip(Lexer.anyOf('123456789'))
        .skip($(digit)(Rule.loop()).$).done,
    ),
  )(Rule.path('integral')).$;
  export const $number = $(
    Rule.chain<string>()
      .skip(sign)
      .skip($integral)
      .skip(Lexer.optional(fractional))
      .skip(Lexer.optional(exponent)).done,
  )(Rule.path('number')).$;

  const unicodeEscape = Rule.chain<string>()
    .skip(exact('u'))
    .skip(
      Rule.loop<string>({ min: 4, max: 4 })(
        $(Lexer.anyOf('abcdefABCDEF0123456789'))(Rule.as(undefined)).$,
      ),
    ).done;
  const escape = Rule.chain<string>()
    .skip(exact(`\\`))
    .skip(Rule.fork(unicodeEscape, Lexer.anyOf(`"b\\/fnrt`))).done;
  const $strChar = $(Lexer.noneOf(`"\\`))(Rule.as(undefined)).$;
  export const $string = $(
    Rule.chain<string>()
      .skip($(Lexer.exact(`"`))(Rule.path('openquote')).$)
      .skip(
        $(Rule.fork($strChar, escape))(Rule.as(undefined))(
          Rule.path('strchars'),
        )(Rule.loop()).$,
      )
      .skip($(exact(`"`))(Rule.path('closequotes')).$).done,
  )(Rule.path('string')).$;

  const space = $(Rule.nextIf<string>((el) => el.trim() == ''))(Rule.loop()).$;

  export const $array = $(
    Rule.lazy(
      () =>
        Rule.chain<string>()
          .skip(exact(`[`))
          .skip(
            $(Rule.chain<string>().skip(space).skip($json).done)(
              Rule.loop({
                sep: Rule.chain<string>().skip(space).skip(exact(',')).done,
              }),
            ).$,
          )
          .skip(space)
          .skip(exact(`]`)).done,
    ),
  )(Rule.as(undefined)).$;
  export const $object = $(
    Rule.lazy(
      () =>
        Rule.chain<string>()
          .skip(exact(`{`))
          .skip(
            $(
              Rule.chain<string>()
                .skip(space)
                .skip($string)
                .skip(space)
                .skip(exact(':'))
                .skip(space)
                .skip($json).done,
            )(
              Rule.loop({
                sep: Rule.as(undefined)(
                  Rule.chain<string>().skip(space).skip(exact(',')).done,
                ),
              }),
            ).$,
          )
          .skip(space)
          .skip(exact(`}`)).done,
    ),
  )(Rule.as(undefined)).$;
  export const $json: Rule<string, undefined> = $(
    Rule.lazy(() => Rule.fork($null, $bool, $number, $string, $array, $object)),
  )(Rule.as(undefined)).$;

  export const json = $(
    Rule.chain<string>().skip(space).skip($json).skip(space).skip(Rule.end)
      .done,
  )(Rule.as(undefined)).$;
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
        $(rules.$number)(Lexer.run(JSON.stringify(x)))(
          loggingIfError((s: Result.RuleResult<unknown>) =>
            expect(s.accepted).toBe(true),
          ),
        );
      }),
    ),
  );
});
test('null', () => {
  $(rules.$null)(Lexer.run('null'))((s) => expect(s.accepted).toBe(true));
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

  $(rules.$json)(Lexer.run(sample))((s) => expect(s.accepted).toBe(true));
});
test('string', () => {
  fc.assert(
    fc.property(strArb, (str) => {
      $(rules.$string)(Lexer.run(JSON.stringify(str)))((s) =>
        expect(s.accepted).toBe(true),
      );
    }),
  );
});
test('string case', () => {
  $(rules.$string)(Lexer.run(JSON.stringify('zcag<20WJm')));
});

suite('json', () => {
  test('no spaces', () => {
    fc.assert(
      fc.property(
        jsonArb,
        loggingIfError((x: unknown) => {
          $(rules.json)(Lexer.run(JSON.stringify(x)))(
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
          $(rules.json)(Lexer.run(JSON.stringify(x, null, 2)))(
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
          $(rules.json)(Lexer.run(JSON.stringify(x, null, 2) + '^'))(
            loggingIfError((s: Result.RuleResult<undefined>) =>
              expect(s.accepted).toBe(false),
            ),
          );
        }),
      ),
    );
  });
});
