import { Rule } from 'gramr-ts/rule';
import { expect, suite, test } from 'vitest';
import { Lexer } from '.';

suite('exact', () => {
  test('fails', () => {
    Lexer.exact('thisinput')
      .let(Lexer.feed('thatinput'))
      .let((r) => expect(r.accepted).toBe(false));
  });
  test('succeeds', () => {
    Lexer.exact('thisinput')
      .let(Lexer.feed('thisinputandmore'))
      .let((r) => expect(r.accepted).toBe(true));
  });
});
suite('chain', () => {
  test('succeeds', () => {
    Rule.chain<string>()
      .push(Lexer.exact('ab'))
      .push(Lexer.exact('cd'))
      .push(Lexer.exact('ef'))
      .done.let(Lexer.feed('abcdefgh'))
      .let((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) expect(r.result.length).toEqual(3);
      });
  });
  test('fails', () => {
    Rule.chain<string>()
      .skip(Lexer.exact('ab'))
      .skip(Lexer.exact('cd'))
      .skip(Lexer.exact('ef'))
      .done.let(Lexer.feed('abdefgh'))
      .let((r) => expect(r.accepted).toBe(false));
  });
});

suite('fork', () => {
  test('succeeds', () => {
    Rule.fork(
      Lexer.exact('ab').let(Rule.as(0)),
      Lexer.exact('bc').let(Rule.as(true)),
      Lexer.exact('cd').let(Rule.as('hola')),
    )
      .let(Lexer.feed('cd'))
      .let((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result).toBe('hola');
          expect(r.pos).toBe(2);
        }
      });
  });
});
suite('eoi', () => {
  test('succeeds', () => {
    Rule.chain<string>()
      .skip(Lexer.exact('asd'))
      .skip(Rule.end)
      .done.let(Lexer.feed('asd'))
      .let((r) => expect(r.accepted).toBe(true));
  });
  test('fails', () => {
    Rule.chain<string>()
      .skip(Lexer.exact('asd'))
      .skip(Rule.end)
      .done.let(Lexer.feed('asdd'))
      .let((r) => expect(r.accepted).toBe(false));
  });
});
suite('collect', () => {
  suite('wrong options', () => {
    test('fails', () => {
      expect(() =>
        Rule.loop({
          min: 10,
          max: 5,
        })(Rule.accept(undefined)),
      ).toThrowError();
    });
  });
  suite('separator', () => {
    test('stops', () => {
      Lexer.exact('a')
        .let(Rule.collect({ sep: Lexer.exact('*') }))
        .let(Lexer.feed('aaaaa'))
        .let((r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toBe(1);
          }
        });
    });
    test('continues', () => {
      Lexer.exact('a')
        .let(Rule.collect({ sep: Lexer.exact('*') }))
        .let(Lexer.feed('a*a*a*a*a'))
        .let((r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toBe(5);
          }
        });
    });
  });
  suite('defaults', () => {
    test('succeeds', () => {
      Lexer.exact('a')
        .let(Rule.collect())
        .let(Lexer.feed('aaaaaabb'))
        .let((r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toBe(6);
          }
        });
    });
  });
  suite('min', () => {
    test('succeeds', () => {
      Lexer.exact('a')
        .let(Rule.collect({ min: 6 }))
        .let(Lexer.feed('aaaaaabb'))
        .let((r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toEqual(6);
          }
        });
    });
    test('fails', () => {
      Lexer.exact('a')
        .let(Rule.collect({ min: 7 }))
        .let(Lexer.feed('aaaaaabb'))
        .let((r) => {
          expect(r.accepted).toBe(false);
        });
    });
  });
  suite('max', () => {
    suite('top', () => {
      test('succeeds', () => {
        Lexer.exact('a')
          .let(Rule.collect({ max: 3 }))
          .let(Lexer.feed('aaaaaabb'))
          .let((r) => {
            expect(r.accepted).toBe(true);
            if (r.accepted) {
              expect(r.result.length).toEqual(3);
            }
          });
      });
    });
    suite('starve', () => {
      test('succeeds', () => {
        Lexer.exact('a')
          .let(Rule.collect({ max: 20 }))
          .let(Lexer.feed('aaaaaabb'))
          .let((r) => {
            expect(r.accepted).toBe(true);
            if (r.accepted) {
              expect(r.result.length).toEqual(6);
            }
          });
      });
    });
  });
});
