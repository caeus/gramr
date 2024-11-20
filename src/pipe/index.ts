interface $<T> {
  <R>(cont: (value: T) => R): $<R>;
  readonly $: T;
}
function $<T>(value: T): $<T> {
  const lifted = <R>(cont: (value: T) => R): $<R> => $(cont(value));
  Object.defineProperty(lifted, '$', {
    value,
    writable: false,
    configurable: false,
  });
  return lifted as $<T>;
}
const $function =
  <I, O>(fn: (input: $<I>) => $<O>) =>
  (input: I): O =>
    fn($(input)).$;
export { $, $function };
