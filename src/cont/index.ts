type Cont<T extends object> = T & {
  let<R>(cont: (self: Cont<T>) => R): R;
};
const ContPrototype = {
  let<R>(cont: (self: Cont<object>) => R): R {
    return cont(this as unknown as Cont<object>);
  },
};
const Cont = <T extends object>(value: T): Cont<T> =>
  Object.assign(Object.create(ContPrototype), value);

type DeCont<T extends Cont<object>> = T extends Cont<infer V> ? V : never;
export { Cont, DeCont };
