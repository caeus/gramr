/* eslint-disable @typescript-eslint/no-namespace */
import { Lex } from '@/lex';
import { $ } from '@/pipe';
import { Rule, Skipped, StepResult } from '@/rule';
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
    Rule.nextIf<string>((s) => {
      const trimmed = s.trim();
      return trimmed == '' || trimmed == ',';
    }),
  )(Rule.as(undefined))(log('space')).$;

  namespace paren {
    export const open: Rule<string, Token> = $(Lex.exact('('))(
      Rule.as({
        type: 'brace',
        brace: 'paren',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(Lex.exact(')'))(
      Rule.as({
        type: 'brace',
        brace: 'paren',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  namespace square {
    export const open = $(Lex.exact('['))(
      Rule.as({
        type: 'brace',
        brace: 'square',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(Lex.exact(']'))(
      Rule.as({
        type: 'brace',
        brace: 'square',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  namespace curly {
    export const open = $(Lex.exact('{'))(
      Rule.as({
        type: 'brace',
        brace: 'curly',
        gate: 'open',
      } satisfies Brace),
    ).$;
    export const close = $(Lex.exact('}'))(
      Rule.as({
        type: 'brace',
        brace: 'curly',
        gate: 'close',
      } satisfies Brace),
    ).$;
  }
  const quote: Rule<string, Token> = $(Lex.exact("'"))(
    Rule.as({ type: 'quote' } satisfies Token),
  ).$;
  const backtick: Rule<string, Token> = $(Lex.exact('`'))(
    Rule.as({ type: 'backtick' } satisfies Token),
  ).$;
  const pow: Rule<string, Token> = $(Lex.exact('^'))(
    Rule.as({ type: 'pow' } satisfies Token),
  ).$;
  const at: Rule<string, Token> = $(Lex.exact('@'))(
    Rule.as({ type: 'pow' } satisfies Token),
  ).$;
  const tilde: Rule<string, Token> = $(Lex.exact('~'))(
    Rule.as({ type: 'tilde' } satisfies Token),
  ).$;
  const text: Rule<string, Token> = $(
    Rule.chain(
      Rule.skip(Lex.exact(`"`)),
      $(Rule.fork(Lex.noneOf(`"`), $(Lex.exact(`\\"`))(Rule.as(`"`)).$))(
        Rule.collect(),
      )(Rule.map((s) => s.join(''))).$,
      Rule.skip(Lex.exact(`"`)),
    ),
  )(Rule.map(([value]) => ({ type: 'text', value }) satisfies Token)).$;
  const spliceunquote: Rule<string, Token> = $(Lex.exact('~@'))(
    Rule.as({ type: 'spliceunquote' } satisfies Token),
  ).$;
  const comment = log('comment')(
    Rule.skip(
      Lex.exact(';'),
      $(Lex.noneOf('\n'))(Rule.as(undefined))(Rule.loop()).$,
    ).rule,
  );
  const ignore = $(Rule.fork(comment, space))(log('ignore'))(Rule.loop())(
    Rule.skip,
  ).$;
  const elem: Rule<string, Token> = $(Lex.noneOf(`${whitespaces}[]{}(),'"\`;`))(
    Rule.collect({ min: 1 }),
  )(Rule.map((s) => s.join('')))(
    Rule.map((value) => ({ type: 'elem', value }) satisfies Token),
  ).$;

  const lexer = Lex.create(
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
    const result = $(lexer)(Lex.run(str)).$;
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
  const open = (brace: BraceKind): Skipped<Token> =>
    Rule.skip(
      Rule.nextIf<Token>(
        (el) => el.type == 'brace' && el.brace == brace && el.gate == 'open',
      ),
    );
  const close = (brace: BraceKind): Skipped<Token> =>
    Rule.skip(
      Rule.nextIf<Token>(
        (el) => el.type == 'brace' && el.brace == brace && el.gate == 'close',
      ),
    );
  const elemexpr = $(
    Rule.nextAs<Token, AST>((el: Token) => {
      switch (el.type) {
        case 'elem':
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
      $(
        Rule.chain(
          //open
          open('square'),
          //items
          $(expr)(Rule.collect()).$,
          //close
          close('square'),
        ),
      )(Rule.map(([items]) => ({ type: 'arr', items }) satisfies AST)).$,
  );
  const dictexpr: Rule<Token, AST> = Rule.lazy(
    () =>
      $(
        Rule.chain(
          // open
          open('curly'),
          //pairs
          $(Rule.chain(expr, expr))(Rule.collect()).$,
          // close
          close('curly'),
        ),
      )(Rule.map(([pairs]) => ({ type: 'dict', pairs }) satisfies AST)).$,
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
        Rule.chain(
          // open
          open('paren'),
          // function
          expr,
          // args
          $(expr)(Rule.collect()).$,
          //close
          close('paren'),
        ),
      )(Rule.map(([fun, args]) => ({ type: 's', fun, args }) satisfies AST)).$,
  );
  const expr = Rule.fork(elemexpr, arrexpr, dictexpr, textexpr, sexpr);
  export const parse = $(Rule.chain(expr, Rule.skip(Rule.end)))(
    Rule.map(([e]) => e),
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
