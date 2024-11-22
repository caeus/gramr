/* eslint-disable @typescript-eslint/no-namespace */
import { Lexer } from 'gramr-ts/lexer';
import { $ } from 'gramr-ts/pipe';
import { ResultOf, Rule, StepResult } from 'gramr-ts/rule';
import { expect, test } from 'vitest';
import { Parser } from '.';
type BraceKind = 'paren' | 'curly' | 'square';
const log =
  (id: string) =>
  <R, E>(rule: Rule<R, E>): Rule<R, E> =>
  (src) =>
  (pos) => {
    console.log(`Entered rule ${id}`);
    const result = rule(src)(pos);
    if (!result.accepted) console.log(`Rejected by rule ${id}`);
    else console.log(`Accepted by rule ${id} until ${result.pos}`);
    return result;
  };

namespace tokenizer {
  const whitespaces = ` \t\n\r\v\f`;
  const space = $(
    Rule.nextIf<string>((s) => {
      const trimmed = s.trim();
      return trimmed == '' || trimmed == ',';
    }),
  )(Rule.as(undefined))(log('space')).$;
  const keyword = <Type extends string>(
    type: Type,
    dispay: string = type,
  ): Rule<{ type: Type }, string> =>
    $(Lexer.exact(dispay))(Rule.as({ type })).$;

  const braces = <Type extends string>(
    suffix: Type,
    open: string,
    close: string,
  ): [
    Rule<{ type: `open_${Type}` }, string>,
    Rule<{ type: `close_${Type}` }, string>,
  ] => [keyword(`open_${suffix}`, open), keyword(`close_${suffix}`, close)];

  const parens = braces('paren', '(', ')');
  const curlys = braces('curly', '{', '}');
  const squares = braces('square', '[', ']');

  const quote = keyword('quote', `'`);
  const backtick = keyword('backtick', `'`);
  const pow = keyword('backtick', `^`);
  const at = keyword('at', `@`);
  const tilde = keyword('tilde', `~`);

  const text = $(
    Rule.chain<string>()
      .skip(Lexer.exact(`"`))
      .push(
        $(Rule.fork(Lexer.noneOf(`"`), $(Lexer.exact(`\\"`))(Rule.as(`"`)).$))(
          Rule.collect(),
        )(Rule.map((s) => s.join(''))).$,
      )
      .skip(Lexer.exact(`"`)).done,
  )(Rule.first)(Rule.map((value) => ({ type: 'text' as const, value }))).$;
  const spliceunquote = keyword('spliceunquote', '~@');
  const comment: Rule<readonly [], string> = log('comment')(
    Rule.chain<string>()
      .skip(Lexer.exact(';'))
      .skip($(Lexer.noneOf(`\n`))(Rule.loop()).$).done,
  );
  const ignore = $(Rule.fork(comment, space))(log('ignore'))(Rule.loop()).$;
  const identifier = $(Lexer.noneOf(`${whitespaces}[]{}(),'"\`;`))(
    Rule.collect({ min: 1 }),
  )(Rule.map((s) => s.join('')))(
    Rule.map((value) => ({ type: 'identifier' as const, value })),
  ).$;

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
    const result = $(lexer)(Lexer.run(str)).$;
    switch (result.accepted) {
      case true:
        return result.result;
      case false:
        throw result.errors;
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
  ): [Rule<unknown, Token>, Rule<unknown, Token>] => [
    Rule.nextIf((el: Token) => el.type == (`open_${suffix}` as const)),
    Rule.nextIf((el: Token) => el.type == (`close_${suffix}` as const)),
  ];

  const grouped = <T>(brace: BraceKind, rule: Rule<T, Token>): Rule<T, Token> =>
    Parser.enclose(...delimiters(brace))(rule);
  const idexpr = $(
    Rule.nextAs<Token, AST>((el: Token) => {
      switch (el.type) {
        case 'identifier':
          return { accepted: true, value: el };
        default:
          return {
            accepted: false,
            msg: `Expected elem, got ${el.type} instead`,
          };
      }
    }),
  ).$;
  const arrexpr: Rule<AST, Token> = Rule.lazy<Token, AST>(
    () =>
      $(grouped('square', $(expr)(Rule.collect()).$))(
        Rule.map((items) => ({ type: 'arr', items }) satisfies AST),
      ).$,
  );
  const dictexpr: Rule<AST, Token> = Rule.lazy(
    () =>
      $(
        grouped(
          'curly',
          $(Rule.chain<Token>().push(expr).push(expr).done)(Rule.collect()).$,
        ),
      )(Rule.map((pairs) => ({ type: 'dict', pairs }) satisfies AST)).$,
  );
  const textexpr: Rule<AST, Token> = Rule.nextAs<Token, AST>(
    (el): StepResult<AST> =>
      el.type == 'text'
        ? { accepted: true, value: el }
        : { accepted: false, msg: `Expected text token, got ${el.type}` },
  );
  const sexpr: Rule<AST, Token> = Rule.lazy<Token, AST>(
    () =>
      $(
        grouped(
          'paren',
          Rule.chain<Token>().push(expr).push($(expr)(Rule.collect()).$).done,
        ),
      )(Rule.map(([fun, args]) => ({ type: 's', fun, args }) satisfies AST)).$,
  );
  const expr = Rule.fork(idexpr, arrexpr, dictexpr, textexpr, sexpr);
  export const parse = $(Rule.chain<Token>().push(expr).skip(Rule.end).done)(
    Rule.first,
  ).$;
}

test('simple lisp parser', () => {
  const s = $('(this {will need [to be] lexed} [] {})')(tokenizer.lex)(
    (tokens) => parser.parse(tokens)(0),
  ).$;
  if (!s.accepted) {
    throw new Error(`Didn't lex correctly`);
  }
  const result = s.result;
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
