import { $, accept, chain, collect, fork, loop, map } from '@/core';
import { expect, suite, test } from 'vitest';
import { end, exact, run } from '.';

suite('exact', () => {
  test('fails', () => {
    $(exact('thisinput'))(run('thatinput'))((r) =>
      expect(r.accepted).toBe(false),
    ).$;
  });
  test('succeeds', () => {
    $(exact('thisinput'))(run('thisinputandmore'))((r) =>
      expect(r.accepted).toBe(true),
    ).$;
  });
});
suite('chain', () => {
  test('succeeds', () => {
    $(chain(exact('ab'), exact('cd'), exact('ef')))(run('abcdefgh'))((r) => {
      expect(r.accepted).toBe(true);
      if (r.accepted) expect(r.result.length).toEqual(3);
    });
  });
  test('fails', () => {
    $(chain(exact('ab'), exact('cd'), exact('ef')))(run('abdefgh'))((r) =>
      expect(r.accepted).toBe(false),
    );
  });
});

suite('fork', () => {
  test('succeeds', () => {
    $(
      fork(
        $(exact('ab'))(map((_) => 0)).$,
        $(exact('bc'))(map((_) => true)).$,
        $(exact('cd'))(map((_) => 'hola')).$,
      ),
    )(run('cd'))((r) => {
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
    $(chain(exact('asd'), end))(run('asd'))((r) =>
      expect(r.accepted).toBe(true),
    ).$;
  });
  test('fails', () => {
    $(chain(exact('asd'), end))(run('asdd'))((r) =>
      expect(r.accepted).toBe(false),
    ).$;
  });
});
suite('collect', () => {
  suite('wrong options', () => {
    test('fails', () => {
      expect(() =>
        loop({
          min: 10,
          max: 5,
        })(accept(undefined)),
      ).toThrowError();
    });
  });
  suite('separator', () => {
    test('stops', () => {
      $(exact('a'))(collect({ sep: exact('*') }))(run('aaaaa'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(1);
        }
      });
    });
    test('continues', () => {
      $(exact('a'))(collect({ sep: exact('*') }))(run('a*a*a*a*a'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(5);
        }
      });
    });
  });
  suite('defaults', () => {
    test('succeeds', () => {
      $(exact('a'))(collect())(run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toBe(6);
        }
      });
    });
  });
  suite('min', () => {
    test('succeeds', () => {
      $(exact('a'))(collect({ min: 6 }))(run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(true);
        if (r.accepted) {
          expect(r.result.length).toEqual(6);
        }
      });
    });
    test('fails', () => {
      $(exact('a'))(collect({ min: 7 }))(run('aaaaaabb'))((r) => {
        expect(r.accepted).toBe(false);
      });
    });
  });
  suite('max', () => {
    suite('top', () => {
      test('succeeds', () => {
        $(exact('a'))(collect({ max: 3 }))(run('aaaaaabb'))((r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toEqual(3);
          }
        });
      });
    });
    suite('starve', () => {
      test('succeeds', () => {
        $(exact('a'))(collect({ max: 20 }))(run('aaaaaabb'))((r) => {
          expect(r.accepted).toBe(true);
          if (r.accepted) {
            expect(r.result.length).toEqual(6);
          }
        });
      });
    });
  });
});
