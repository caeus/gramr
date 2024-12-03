type Cont<out T extends object> = <R>(cont: (value: Selfie<T>) => R) => R;
type Selfie<T extends Readonly<object>> = Readonly<
  T & {
    let: Cont<T>;
  }
>;
const SelfiePrototype = {
  let<R>(cont: (self: Selfie<object>) => R): R {
    return cont(this as unknown as Selfie<object>);
  },
};
const Selfie = <T extends object>(value: T): Selfie<T> =>
  Object.assign(Object.create(SelfiePrototype), value);

type DeSelfie<T extends Selfie<object>> =
  T extends Selfie<infer V extends object> ? V : never;
export { Cont, DeSelfie, Selfie };
