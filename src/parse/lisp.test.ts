import {
  $,
  as,
  chain,
  collect,
  fork,
  lazy,
  loop,
  map,
  nextAs,
  nextIf,
  Rule,
  skip,
  Take,
} from '@/core';
import { createLexer, exact, noneOf, run } from '@/lex';
import { expect, test } from 'vitest';
import { end } from '.';

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
      type: 'elem';
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
    nextIf<string>((s) => {
      const trimmed = s.trim();
      return trimmed == '' || trimmed == ',';
    }),
  )(as(undefined))(log('space')).$;
  namespace paren {
    export const open: Rule<string, Token> = $(exact('('))(
      as({
        type: 'brace',
        brace: 'paren',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(exact(')'))(
      as({
        type: 'brace',
        brace: 'paren',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  namespace square {
    export const open = $(exact('['))(
      as({
        type: 'brace',
        brace: 'square',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(exact(']'))(
      as({
        type: 'brace',
        brace: 'square',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  namespace curly {
    export const open = $(exact('{'))(
      as({
        type: 'brace',
        brace: 'curly',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(exact('}'))(
      as({
        type: 'brace',
        brace: 'curly',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  const quote: Rule<string, Token> = $(exact("'"))(
    as({ type: 'quote' } satisfies Token),
  ).$;
  const backtick: Rule<string, Token> = $(exact('`'))(
    as({ type: 'backtick' } satisfies Token),
  ).$;
  const pow: Rule<string, Token> = $(exact('^'))(
    as({ type: 'pow' } satisfies Token),
  ).$;
  const at: Rule<string, Token> = $(exact('@'))(
    as({ type: 'pow' } satisfies Token),
  ).$;
  const tilde: Rule<string, Token> = $(exact('~'))(
    as({ type: 'tilde' } satisfies Token),
  ).$;
  const text: Rule<string, Token> = $(
    chain(
      skip(exact(`"`)),
      $(fork(noneOf(`"`), $(exact(`\\"`))(as(`"`)).$))(collect())(
        map((s) => s.join('')),
      ).$,
      skip(exact(`"`)),
    ),
  )(map(([value]) => ({ type: 'text', value }) satisfies Token)).$;
  const spliceunquote: Rule<string, Token> = $(exact('~@'))(
    as({ type: 'spliceunquote' } satisfies Token),
  ).$;
  const comment = log('comment')(
    skip(exact(';'), $(noneOf('\n'))(as(undefined))(loop()).$).rule,
  );
  const ignore = $(fork(comment, space))(log('ignore'))(loop())(skip).$;
  const elem: Rule<string, Token> = $(noneOf(`${whitespaces}[]{}(),'"\`;`))(
    collect({ min: 1 }),
  )(map((s) => s.join('')))(
    map((value) => ({ type: 'elem', value }) satisfies Token),
  ).$;
  const token: Rule<string, Token> = log('token')(
    fork(
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
      elem,
    ),
  );
  const lexer = createLexer(
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
      elem,
    ],
    ignore,
  );
  export function lex(str: string): Token[] {
    const result = $(lexer)(run(str)).$;
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
      type: 'text';
      readonly value: string;
    }
  | {
      type: 'elem';
      readonly value: string;
    }
  | {
      type: 'arr';
      items: AST[];
    }
  | {
      type: 'dict';
      pairs: [AST, AST][];
    }
  | {
      type: 's';
      fun: AST;
      args: AST[];
    };
namespace parser {
  const open = (brace: BraceKind) =>
    skip(
      nextIf<Token>(
        (el) => el.type == 'brace' && el.brace == brace && el.gate == 'open',
      ),
    );
  const close = (brace: BraceKind) =>
    skip(
      nextIf<Token>(
        (el) => el.type == 'brace' && el.brace == brace && el.gate == 'close',
      ),
    );
  const elemexpr = $(
    nextAs<Token, AST>((el: Token) => {
      switch (el.type) {
        case 'elem':
          return { value: el };
        default:
          return { msg: `Expected elem, got ${el.type} instead` };
      }
    }),
  ).$;
  const arrexpr: Rule<Token, AST> = lazy<Token, AST>(
    () =>
      $(
        chain(
          //open
          open('square'),
          //items
          $(expr)(collect()).$,
          //close
          close('square'),
        ),
      )(map(([items]) => ({ type: 'arr', items }) satisfies AST)).$,
  );
  const dictexpr: Rule<Token, AST> = lazy(
    () =>
      $(
        chain(
          // open
          open('curly'),
          //pairs
          $(chain(expr, expr))(collect()).$,
          // close
          close('curly'),
        ),
      )(map(([pairs]) => ({ type: 'dict', pairs }) satisfies AST)).$,
  );
  const textexpr: Rule<Token, AST> = nextAs<Token, AST>(
    (el): Take<AST> => (el.type == 'text' ? { value: el } : { msg: `Expected text token, got ${el.type}` }),
  );
  const sexpr: Rule<Token, AST> = lazy<Token, AST>(
    () =>
      $(
        chain(
          // open
          open('paren'),
          // function
          expr,
          // args
          $(expr)(collect()).$,
          //close
          close('paren'),
        ),
      )(map(([fun, args]) => ({ type: 's', fun, args }) satisfies AST)).$,
  );
  const expr = fork(elemexpr, arrexpr, dictexpr, textexpr, sexpr);
  export const parse = $(chain(expr, skip(end)))(map(([e]) => e)).$;
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
    fun: { type: 'elem', value: 'this' },
    args: [
      {
        type: 'dict',
        pairs: [
          [
            { type: 'elem', value: 'will' },
            { type: 'elem', value: 'need' },
          ],
          [
            {
              type: 'arr',
              items: [
                { type: 'elem', value: 'to' },
                { type: 'elem', value: 'be' },
              ],
            },
            { type: 'elem', value: 'lexed' },
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
