/* eslint-disable @typescript-eslint/no-namespace */
import { Lexer } from 'gramr-ts/lexer';
import { ResultOf, Rule, StepResult } from 'gramr-ts/rule';
import { expect, test } from 'vitest';
import { Parser } from '.';
type BraceKind = 'paren' | 'curly' | 'square';
const log =
  (id: string) =>
  <R, E>(rule: Rule<E, R>): Rule<E, R> =>
    Rule.of((src) => (pos) => {
      console.log(`Entered rule ${id}`);
      const result = rule.run(src)(pos);
      if (!result.val.accepted) console.log(`Rejected by rule ${id}`);
      else console.log(`Accepted by rule ${id} until ${result.val.pos}`);
      return result;
    });

namespace tokenizer {
  const whitespaces = ` \t\n\r\v\f`;
  const space = Rule.nextIf<string>((s) => {
    const trimmed = s.trim();
    return trimmed == '' || trimmed == ',';
  })
    .let(Rule.as(undefined))
    .let(log('space'));
  const keyword = <Type extends string>(
    type: Type,
    dispay: string = type,
  ): Rule<string, { type: Type }> => Lexer.exact(dispay).let(Rule.as({ type }));

  const braces = <Type extends string>(
    suffix: Type,
    open: string,
    close: string,
  ): [
    Rule<string, { type: `open_${Type}` }>,
    Rule<string, { type: `close_${Type}` }>,
  ] => [keyword(`open_${suffix}`, open), keyword(`close_${suffix}`, close)];

  const parens = braces('paren', '(', ')');
  const curlys = braces('curly', '{', '}');
  const squares = braces('square', '[', ']');

  const quote = keyword('quote', `'`);
  const backtick = keyword('backtick', `'`);
  const pow = keyword('backtick', `^`);
  const at = keyword('at', `@`);
  const tilde = keyword('tilde', `~`);

  const text = Rule.chain<string>()
    .skip(Lexer.exact(`"`))
    .push(
      Rule.fork(Lexer.noneOf(`"`), Lexer.exact(`\\"`).let(Rule.as(`"`)))
        .let(Rule.collect())
        .let(Rule.map((s) => s.join(''))),
    )
    .skip(Lexer.exact(`"`))
    .done.let(Rule.first)
    .let(Rule.map((value) => ({ type: 'text' as const, value })));
  const spliceunquote = keyword('spliceunquote', '~@');
  const comment: Rule<string, readonly []> = log('comment')(
    Rule.chain<string>()
      .skip(Lexer.exact(';'))
      .skip(Lexer.noneOf(`\n`).let(Rule.loop())).done,
  );
  const ignore = Rule.fork(comment, space).let(log('ignore')).let(Rule.loop());
  const identifier = Lexer.noneOf(`${whitespaces}[]{}(),'"\`;`)
    .let(Rule.collect({ min: 1 }))
    .let(Rule.map((s) => s.join('')))
    .let(Rule.map((value) => ({ type: 'identifier' as const, value })));

  const lexer = Lexer.create(
    [
      ...parens,
      ...curlys,
      ...squares,
      quote,
      backtick,
      pow,
      at,
      tilde,
      text,
      spliceunquote,
      identifier,
    ],
    ignore,
  );
  export type Token = ResultOf<typeof lexer>[number];
  export function lex(str: string): Token[] {
    const result = lexer.let(Lexer.feed(str));
    switch (result.val.accepted) {
      case true:
        return result.val.result;
      case false:
        throw result.val.errors;
    }
  }
}
type AST =
  | {
      readonly type: 'text';
      readonly value: string;
    }
  | {
      readonly type: 'identifier';
      readonly value: string;
    }
  | {
      readonly type: 'arr';
      readonly items: readonly AST[];
    }
  | {
      readonly type: 'dict';
      readonly pairs: readonly (readonly [AST, AST])[];
    }
  | {
      readonly type: 's';
      readonly fun: AST;
      readonly args: readonly AST[];
    };
type Token = tokenizer.Token;
namespace parser {
  const delimiters = (
    suffix: BraceKind,
  ): [Rule<Token, unknown>, Rule<Token, unknown>] => [
    Rule.nextIf((el: Token) => el.type == (`open_${suffix}` as const)),
    Rule.nextIf((el: Token) => el.type == (`close_${suffix}` as const)),
  ];

  const grouped = <T>(brace: BraceKind, rule: Rule<Token, T>): Rule<Token, T> =>
    Parser.enclose(...delimiters(brace))(rule);
  const idexpr = Rule.nextAs<Token, AST>((el: Token) => {
    switch (el.type) {
      case 'identifier':
        return { accepted: true, value: el };
      default:
        return {
          accepted: false,
          msg: `Expected elem, got ${el.type} instead`,
        };
    }
  });
  const arrexpr: Rule<Token, AST> = Rule.lazy<Token, AST>(() =>
    grouped('square', expr.let(Rule.collect())).let(
      Rule.map((items) => ({ type: 'arr', items }) satisfies AST),
    ),
  );
  const dictexpr: Rule<Token, AST> = Rule.lazy(() => {
    return grouped(
      'curly',
      Rule.chain<Token>().push(expr).push(expr).done.let(Rule.collect()),
    ).let(Rule.map((pairs) => ({ type: 'dict', pairs }) satisfies AST as AST));
  });
  const textexpr: Rule<Token, AST> = Rule.nextAs<Token, AST>(
    (el): StepResult<AST> =>
      el.type == 'text'
        ? { accepted: true, value: el }
        : { accepted: false, msg: `Expected text token, got ${el.type}` },
  );
  const sexpr: Rule<Token, AST> = Rule.lazy<Token, AST>(() =>
    grouped(
      'paren',
      Rule.chain<Token>().push(expr).push(expr.let(Rule.collect())).done,
    ).let(Rule.map(([fun, args]) => ({ type: 's', fun, args }) satisfies AST)),
  );
  const expr = Rule.fork(idexpr, arrexpr, dictexpr, textexpr, sexpr);
  export const parse = Rule.chain<Token>()
    .push(expr)
    .skip(Rule.end())
    .done.let(Rule.first);
}

test('simple lisp parser', () => {
  const tokens = tokenizer.lex('(this {will need [to be] lexed} [] {})');
  const s = parser.parse.run(tokens)(0);
  if (!s.val.accepted) {
    throw new Error(`Didn't lex correctly`);
  }
  const result = s.val.result;
  const expectation: AST = {
    type: 's',
    fun: { type: 'identifier', value: 'this' },
    args: [
      {
        type: 'dict',
        pairs: [
          [
            { type: 'identifier', value: 'will' },
            { type: 'identifier', value: 'need' },
          ],
          [
            {
              type: 'arr',
              items: [
                { type: 'identifier', value: 'to' },
                { type: 'identifier', value: 'be' },
              ],
            },
            { type: 'identifier', value: 'lexed' },
          ],
        ],
      },
      {
        type: 'arr',
        items: [],
      },
      { type: 'dict', pairs: [] },
    ],
  };
  expect(result).toEqual(expectation);
});
