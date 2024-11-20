/* eslint-disable @typescript-eslint/no-namespace */
import { Lexer } from 'gramr-ts/lexer';
import { $ } from 'gramr-ts/pipe';
import { Rule, StepResult } from 'gramr-ts/rule';
import { expect, test } from 'vitest';
type GateKind = 'open' | 'close';
type BraceKind = 'paren' | 'curly' | 'square';
type Brace = {
  type: 'brace';
  gate: GateKind;
  brace: BraceKind;
};
type Token =
  | Brace
  | {
      type: 'quote';
    }
  | {
      type: 'backtick';
    }
  | {
      type: 'pow';
    }
  | {
      type: 'at';
    }
  | {
      type: 'tilde';
    }
  | { type: 'spliceunquote' }
  | {
      type: 'text';
      value: string;
    }
  | {
      type: 'identifier';
      value: string;
    };

const log =
  (id: string) =>
  <E, R>(rule: Rule<E, R>): Rule<E, R> =>
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

  namespace paren {
    export const open: Rule<string, Token> = $(Lexer.exact('('))(
      Rule.as({
        type: 'brace',
        brace: 'paren',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(Lexer.exact(')'))(
      Rule.as({
        type: 'brace',
        brace: 'paren',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  namespace square {
    export const open = $(Lexer.exact('['))(
      Rule.as({
        type: 'brace',
        brace: 'square',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(Lexer.exact(']'))(
      Rule.as({
        type: 'brace',
        brace: 'square',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  namespace curly {
    export const open = $(Lexer.exact('{'))(
      Rule.as({
        type: 'brace',
        brace: 'curly',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(Lexer.exact('}'))(
      Rule.as({
        type: 'brace',
        brace: 'curly',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  const quote: Rule<string, Token> = $(Lexer.exact("'"))(
    Rule.as({ type: 'quote' } satisfies Token),
  ).$;
  const backtick: Rule<string, Token> = $(Lexer.exact('`'))(
    Rule.as({ type: 'backtick' } satisfies Token),
  ).$;
  const pow: Rule<string, Token> = $(Lexer.exact('^'))(
    Rule.as({ type: 'pow' } satisfies Token),
  ).$;
  const at: Rule<string, Token> = $(Lexer.exact('@'))(
    Rule.as({ type: 'pow' } satisfies Token),
  ).$;
  const tilde: Rule<string, Token> = $(Lexer.exact('~'))(
    Rule.as({ type: 'tilde' } satisfies Token),
  ).$;

  const text: Rule<string, Token> = $(
    Rule.chain<string>()
      .skip(Lexer.exact(`"`))
      .push(
        $(Rule.fork(Lexer.noneOf(`"`), $(Lexer.exact(`\\"`))(Rule.as(`"`)).$))(
          Rule.collect(),
        )(Rule.map((s) => s.join(''))).$,
      )
      .skip(Lexer.exact(`"`)).done,
  )(Rule.first)(
    Rule.map((value) => ({ type: 'text', value }) satisfies Token),
  ).$;
  const spliceunquote: Rule<string, Token> = $(Lexer.exact('~@'))(
    Rule.as({ type: 'spliceunquote' } satisfies Token),
  ).$;
  const comment = log('comment')(
    Rule.chain<string>()
      .skip(Lexer.exact(';'))
      .skip($(Lexer.noneOf(`\n`))(Rule.loop()).$).done,
  );
  const ignore = $(Rule.fork(comment, space))(log('ignore'))(Rule.loop()).$;
  const identifier: Rule<string, Token> = $(
    Lexer.noneOf(`${whitespaces}[]{}(),'"\`;`),
  )(Rule.collect({ min: 1 }))(Rule.map((s) => s.join('')))(
    Rule.map((value) => ({ type: 'identifier', value }) satisfies Token),
  ).$;

  const lexer = Lexer.create(
    [
      paren.open,
      paren.close,
      curly.open,
      curly.close,
      square.open,
      square.close,
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

namespace parser {
  const open = (brace: BraceKind): Rule<Token, unknown> =>
    Rule.nextIf<Token>(
      (el) => el.type == 'brace' && el.brace == brace && el.gate == 'open',
    );
  const close = (brace: BraceKind): Rule<Token, unknown> =>
    Rule.nextIf<Token>(
      (el) => el.type == 'brace' && el.brace == brace && el.gate == 'close',
    );
  const grouped = <T>(brace: BraceKind, rule: Rule<Token, T>): Rule<Token, T> =>
    $(Rule.chain<Token>().skip(open(brace)).push(rule).skip(close(brace)).done)(
      Rule.first,
    ).$;
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
  const arrexpr: Rule<Token, AST> = Rule.lazy<Token, AST>(
    () =>
      $(grouped('square', $(expr)(Rule.collect()).$))(
        Rule.map((items) => ({ type: 'arr', items }) satisfies AST),
      ).$,
  );
  const dictexpr: Rule<Token, AST> = Rule.lazy(
    () =>
      $(
        grouped(
          'curly',
          $(Rule.chain<Token>().push(expr).push(expr).done)(Rule.collect()).$,
        ),
      )(Rule.map((pairs) => ({ type: 'dict', pairs }) satisfies AST)).$,
  );
  const textexpr: Rule<Token, AST> = Rule.nextAs<Token, AST>(
    (el): StepResult<AST> =>
      el.type == 'text'
        ? { accepted: true, value: el }
        : { accepted: false, msg: `Expected text token, got ${el.type}` },
  );
  const sexpr: Rule<Token, AST> = Rule.lazy<Token, AST>(
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
