type Recursive<Out> =
  | {
      done: true;
      result: Out;
    }
  | {
      done: false;
      next: () => Recursive<Out>;
    };
function run<Out>(recursive: Recursive<Out>): Out {
  let rec = recursive;
  while (!rec.done) {
    rec = rec.next();
  }
  return rec.result;
}

function next<Out>(next: () => Recursive<Out>): Recursive<Out> {
  return { done: false, next };
}
function done<Out>(result: Out): Recursive<Out> {
  return { done: true, result };
}
const Recursive = { run, next, done };
export { Recursive };
