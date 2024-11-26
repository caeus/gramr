import * as Result from 'gramr-ts/result';

import fc from 'fast-check';
import { Rule } from 'gramr-ts/rule';
import { expect, suite, test } from 'vitest';
import { Lexer, LexRule } from '.';

const exact = Lexer.exact;

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace rules {
  export const $null = Lexer.exact('null');
  export const $bool = Rule.fork(
    //
    Lexer.exact('false').let(Rule.as(false)),
    //
    exact('true').let(Rule.as(true)),
  ).let(Rule.path('bool'));
  const digit = Lexer.anyOf('0123456789')
    .let(Rule.as(undefined))
    .let(Rule.path('digit'));

  const digits = digit.let(Rule.loop({ min: 1 })).let(Rule.path('digits'));
  const sign = Rule.fork(exact('+'), exact('-'))
    .let(Lexer.optional)
    .let(Rule.path('sign'));

  const exponent: LexRule<undefined> = Rule.chain<string>()
    .skip(Rule.fork(exact('e'), exact('E')))
    .skip(sign)
    .skip(digits)
    .done.let(Rule.as(undefined))
    .let(Rule.path('exponent'));
  const fractional = Rule.chain<string>()
    .skip(exact('.'))
    .skip(digits)
    .done.let(Rule.as(undefined))
    .let(Rule.path('fractional'));
  export const $integral = Rule.fork(
    exact('0'),
    Rule.chain<string>()
      .skip(Lexer.anyOf('123456789'))
      .skip(digit.let(Rule.loop())).done,
  ).let(Rule.path('integral'));
  export const $number = Rule.chain<string>()
    .skip(sign)
    .skip($integral)
    .skip(Lexer.optional(fractional))
    .skip(Lexer.optional(exponent))
    .done.let(Rule.path('number'));

  const unicodeEscape = Rule.chain<string>()
    .skip(exact('u'))
    .skip(
      Rule.loop<string>({ min: 4, max: 4 })(
        Lexer.anyOf('abcdefABCDEF0123456789').let(Rule.as(undefined)),
      ),
    ).done;
  const escape = Rule.chain<string>()
    .skip(exact(`\\`))
    .skip(Rule.fork(unicodeEscape, Lexer.anyOf(`"b\\/fnrt`))).done;
  const $strChar = Lexer.noneOf(`"\\`).let(Rule.as(undefined));
  export const $string = Rule.chain<string>()
    .skip(Lexer.exact(`"`).let(Rule.path('openquote')))
    .skip(
      Rule.fork($strChar, escape)
        .let(Rule.as(undefined))
        .let(Rule.path('strchars'))
        .let(Rule.loop()),
    )
    .skip(exact(`"`).let(Rule.path('closequotes')))
    .done.let(Rule.path('string'));

  const space = Rule.nextIf<string>((el) => el.trim() == '').let(Rule.loop());

  export const $array = Rule.lazy(
    () =>
      Rule.chain<string>()
        .skip(exact(`[`))
        .skip(
          Rule.chain<string>()
            .skip(space)
            .skip($json)
            .done.let(
              Rule.loop({
                sep: Rule.chain<string>().skip(space).skip(exact(',')).done,
              }),
            ),
        )
        .skip(space)
        .skip(exact(`]`)).done,
  ).let(Rule.as(undefined));
  export const $object = Rule.lazy(
    () =>
      Rule.chain<string>()
        .skip(exact(`{`))
        .skip(
          Rule.chain<string>()
            .skip(space)
            .skip($string)
            .skip(space)
            .skip(exact(':'))
            .skip(space)
            .skip($json)
            .done.let(
              Rule.loop({
                sep: Rule.as(undefined)(
                  Rule.chain<string>().skip(space).skip(exact(',')).done,
                ),
              }),
            ),
        )
        .skip(space)
        .skip(exact(`}`)).done,
  ).let(Rule.as(undefined));
  export const $json: Rule<string, undefined> = Rule.lazy(() =>
    Rule.fork($null, $bool, $number, $string, $array, $object),
  ).let(Rule.as(undefined));

  export const json = Rule.chain<string>()
    .skip(space)
    .skip($json)
    .skip(space)
    .skip(Rule.end)
    .done.let(Rule.as(undefined));
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
        rules.$number
          .let(Lexer.feed(JSON.stringify(x)))
          .let(
            loggingIfError((s: Result.Result<unknown>) =>
              expect(s.accepted).toBe(true),
            ),
          );
      }),
    ),
  );
});
test('null', () => {
  rules.$null.let(Lexer.feed('null')).let((s) => expect(s.accepted).toBe(true));
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

  rules.$json.let(Lexer.feed(sample)).let((s) => expect(s.accepted).toBe(true));
});
test('string', () => {
  fc.assert(
    fc.property(strArb, (str) => {
      rules.$string
        .let(Lexer.feed(JSON.stringify(str)))
        .let((s) => expect(s.accepted).toBe(true));
    }),
  );
});
test('string case', () => {
  rules.$string.let(Lexer.feed(JSON.stringify('zcag<20WJm')));
});

suite('json', () => {
  test('no spaces', () => {
    fc.assert(
      fc.property(
        jsonArb,
        loggingIfError((x: unknown) => {
          rules.json
            .let(Lexer.feed(JSON.stringify(x)))
            .let(
              loggingIfError((s: Result.Result<undefined>) =>
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
          rules.json
            .let(Lexer.feed(JSON.stringify(x, null, 2)))
            .let(
              loggingIfError((s: Result.Result<undefined>) =>
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
          rules.json
            .let(Lexer.feed(JSON.stringify(x, null, 2) + '^'))
            .let(
              loggingIfError((s: Result.Result<undefined>) =>
                expect(s.accepted).toBe(false),
              ),
            );
        }),
      ),
    );
  });
});
