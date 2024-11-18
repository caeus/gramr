/* eslint-disable @typescript-eslint/no-unused-expressions */
import { $ } from '@/pipe';
import { Rule } from '@/rule';
import { expect, suite, test } from 'vitest';
import { Lex } from '.';

suite('exact', () => {
  test('fails', () => {
    $(Lex.exact('thisinput'))(Lex.run('thatinput'))((r) =>
      expect(r.accepted).toBe(false),
    ).$;
  });
  test('succeeds', () => {
    $(Lex.exact('thisinput'))(Lex.run('thisinputandmore'))((r) =>
      expect(r.accepted).toBe(true),
    ).$;
  });
});
suite('chain', () => {
  test('succeeds', () => {
    $(Rule.chain(Lex.exact('ab'), Lex.exact('cd'), Lex.exact('ef')))(
      Lex.run('abcdefgh'),
    )((r) => {
      expect(r.accepted).toBe(true);
      if (r.accepted) expect(r.result.length).toEqual(3);
    });
  });
  test('fails', () => {
    $(Rule.chain(Lex.exact('ab'), Lex.exact('cd'), Lex.exact('ef')))(
      Lex.run('abdefgh'),
    )((r) => expect(r.accepted).toBe(false));
  });
});

suite('fork', () => {
  test('succeeds', () => {
    $(
      Rule.fork(
        $(Lex.exact('ab'))(Rule.as(0)).$,
        $(Lex.exact('bc'))(Rule.as(true)).$,
        $(Lex.exact('cd'))(Rule.as('hola')).$,
      ),
    )(Lex.run('cd'))((r) => {
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
    $(Rule.chain(Lex.exact('asd'), Rule.end))(Lex.run('asd'))((r) =>
      expect(r.accepted).toBe(true),
    ).$;
  });
  test('fails', () => {
    $(Rule.chain(Lex.exact('asd'), Rule.end))(Lex.run('asdd'))((r) =>
      expect(r.accepted).toBe(false),
    ).$;
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
      $(Lex.exact('a'))(Rule.collect({ sep: Lex.exact('*') }))(
        Lex.run('aaaaa'),
      )((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(1);
        }
      });
    });
    test('continues', () => {
      $(Lex.exact('a'))(Rule.collect({ sep: Lex.exact('*') }))(
        Lex.run('a*a*a*a*a'),
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
      $(Lex.exact('a'))(Rule.collect())(Lex.run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(6);
        }
      });
    });
  });
  suite('min', () => {
    test('succeeds', () => {
      $(Lex.exact('a'))(Rule.collect({ min: 6 }))(Lex.run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toEqual(6);
        }
      });
    });
    test('fails', () => {
      $(Lex.exact('a'))(Rule.collect({ min: 7 }))(Lex.run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(false);
      });
    });
  });
  suite('max', () => {
    suite('top', () => {
      test('succeeds', () => {
        $(Lex.exact('a'))(Rule.collect({ max: 3 }))(Lex.run('aaaaaabb'))(
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
        $(Lex.exact('a'))(Rule.collect({ max: 20 }))(Lex.run('aaaaaabb'))(
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
