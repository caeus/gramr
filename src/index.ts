interface Cursor<Src, El> {}

type GramrError = { path: string[]; msg: string; pos: number };
type GramrResult<Out> =
  | {
      type: 'failed';
      errors: GramrError[];
    }
  | {
      type: 'done';
      result: Out;
      pos: number;
    };

export type RepConf<Src, El> = {
  sep?: Gramr<Src, El, unknown>;
};
class Gramr<Src, El, out Out> {
  constructor(readonly def: (cursor: Cursor<Src, El>) => GramrResult<Out>) {}
  map<Out2>(fn: (out: Out) => Out2): Gramr<Src, El, Out2> {
    throw '';
  }
  rep(conf: RepConf<Src, El>): Gramr<Src, El, Out[]> {
    throw '';
  }
}
type StrGramr<Out> = Gramr<string, string, Out>;

export function lazy<Src, El, Out>(
  gramr: () => Gramr<Src, El, Out>,
): Gramr<Src, El, Out> {
  throw '';
}
type Fork<Src, El, Gramrs extends [...Gramr<Src, El, unknown>[]]> =
  // case head, tail
  Gramrs extends [
    Gramr<Src, El, infer Out>,
    ...infer Tail extends Gramr<Src, El, unknown>[],
  ]
    ? Out | Fork<Src, El, Tail>
    : // case empty
      Gramrs extends []
      ? never
      : never;

type Chain<Src, El, Gramrs extends [...Gramr<Src, El, unknown>[]]> =
  // case void, tail
  Gramrs extends [
    Gramr<Src, El, void>,
    ...infer Tail extends Gramr<Src, El, unknown>[],
  ]
    ? [...Chain<Src, El, Tail>]
    : // case head, tail
      Gramrs extends [
          Gramr<Src, El, infer Out>,
          ...infer Tail extends Gramr<Src, El, unknown>[],
        ]
      ? [Out, ...Chain<Src, El, Tail>]
      : //case empty
        Gramrs extends []
        ? []
        : never;

export class GramrKit<Src, El> {
  fork<Gramrs extends [...Gramr<Src, El, unknown>[]]>(
    ...gramrs: Gramrs
  ): Gramr<Src, El, Fork<Src, El, Gramrs>> {
    throw '';
  }
  chain<Gramrs extends [...Gramr<Src, El, unknown>[]]>(
    ...gramrs: Gramrs
  ): Gramr<Src, El, Chain<Src, El, Gramrs>> {
    throw '';
  }
  lazy<Out>(gramr: () => Gramr<Src, El, Out>): Gramr<Src, El, Out> {
    throw '';
  }
  capture():Gramr<Src,El,Src>{
    throw ''
  }
  void():Gramr<Src,El,void>{
    throw ""
  }
}
class StrGrammarKit extends GramrKit<string, string> {
  constructor() {
    super();
  }
  exact(str: string): StrGramr<void> {
    throw '';
  }
  regex(pattern:RegExp):StrGramr<string>{
    throw ""
  }
  end():StrGramr<void>{
    throw ""
  }
}


export const str = new StrGrammarKit();

type JsonEl =
  | {
      type: 'null';
    }
  | {
      type: 'bool';
      value: boolean;
    }
  | {
      type: 'array';
      value: JsonEl[];
    };
const jNull: StrGramr<JsonEl> = str
  .exact('null')
  .map((_) => ({ type: 'null' }));

const jBool: StrGramr<JsonEl> = str
  .fork(
    str.exact('true').map(() => true),
    str.exact('false').map(() => false),
  )
  .map((value) => ({ type: 'bool', value }));

const jArray:StrGramr<JsonEl> = lazy(() =>
    str.chain(
        // Opens
        str.exact('['),
        // Elements
        json.rep({ sep: str.exact(',') }),
        // Closes
        str.exact(']')
    )
).map(([value]) => ({ type: 'array', value}));

const json: Gramr<string, string, JsonEl> = str.fork(jNull, jBool, jArray);

const asdasd = json.rep({})
