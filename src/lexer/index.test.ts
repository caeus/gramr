/* eslint-disable @typescript-eslint/no-unused-expressions */
import { $ } from 'gramr-ts/pipe';
import { Rule } from 'gramr-ts/rule';
import { expect, suite, test } from 'vitest';
import { Lexer } from '.';

suite('exact', () => {
  test('fails', () => {
    $(Lexer.exact('thisinput'))(Lexer.run('thatinput'))((r) =>
      expect(r.accepted).toBe(false),
    ).$;
  });
  test('succeeds', () => {
    $(Lexer.exact('thisinput'))(Lexer.run('thisinputandmore'))((r) =>
      expect(r.accepted).toBe(true),
    ).$;
  });
});
suite('chain', () => {
  test('succeeds', () => {
    $(
      Rule.chain<string>()
        .push(Lexer.exact('ab'))
        .push(Lexer.exact('cd'))
        .push(Lexer.exact('ef')).done,
    )(Lexer.run('abcdefgh'))((r) => {
      expect(r.accepted).toBe(true);
      if (r.accepted) expect(r.result.length).toEqual(3);
    });
  });
  test('fails', () => {
    $(
      Rule.chain<string>()
        .skip(Lexer.exact('ab'))
        .skip(Lexer.exact('cd'))
        .skip(Lexer.exact('ef')).done,
    )(Lexer.run('abdefgh'))((r) => expect(r.accepted).toBe(false));
  });
});

suite('fork', () => {
  test('succeeds', () => {
    $(
      Rule.fork(
        $(Lexer.exact('ab'))(Rule.as(0)).$,
        $(Lexer.exact('bc'))(Rule.as(true)).$,
        $(Lexer.exact('cd'))(Rule.as('hola')).$,
      ),
    )(Lexer.run('cd'))((r) => {
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
    $(Rule.chain<string>().skip(Lexer.exact('asd')).skip(Rule.end).done)(
      Lexer.run('asd'),
    )((r) => expect(r.accepted).toBe(true)).$;
  });
  test('fails', () => {
    $(Rule.chain<string>().skip(Lexer.exact('asd')).skip(Rule.end).done)(
      Lexer.run('asdd'),
    )((r) => expect(r.accepted).toBe(false)).$;
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
      $(Lexer.exact('a'))(Rule.collect({ sep: Lexer.exact('*') }))(
        Lexer.run('aaaaa'),
      )((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(1);
        }
      });
    });
    test('continues', () => {
      $(Lexer.exact('a'))(Rule.collect({ sep: Lexer.exact('*') }))(
        Lexer.run('a*a*a*a*a'),
      )((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(5);
        }
      });
    });
  });
  suite('defaults', () => {
    test('succeeds', () => {
      $(Lexer.exact('a'))(Rule.collect())(Lexer.run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(6);
        }
      });
    });
  });
  suite('min', () => {
    test('succeeds', () => {
      $(Lexer.exact('a'))(Rule.collect({ min: 6 }))(Lexer.run('aaaaaabb'))(
        (r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toEqual(6);
          }
        },
      );
    });
    test('fails', () => {
      $(Lexer.exact('a'))(Rule.collect({ min: 7 }))(Lexer.run('aaaaaabb'))(
        (r) => {
          expect(r.accepted).toBe(false);
        },
      );
    });
  });
  suite('max', () => {
    suite('top', () => {
      test('succeeds', () => {
        $(Lexer.exact('a'))(Rule.collect({ max: 3 }))(Lexer.run('aaaaaabb'))(
          (r) => {
            expect(r.accepted).toBe(true);
            if (r.accepted) {
              expect(r.result.length).toEqual(3);
            }
          },
        );
      });
    });
    suite('starve', () => {
      test('succeeds', () => {
        $(Lexer.exact('a'))(Rule.collect({ max: 20 }))(Lexer.run('aaaaaabb'))(
          (r) => {
            expect(r.accepted).toBe(true);
            if (r.accepted) {
              expect(r.result.length).toEqual(6);
            }
          },
        );
      });
    });
  });
});
