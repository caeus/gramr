const pathStack: string[] = [];

const inPath = <R>(id: string, fn: () => R): R => {
  pathStack.push(id);
  try {
    return fn();
  } finally {
    pathStack.pop();
  }
};
const getPath = (): string[] => pathStack.map((p) => p);
const Context = { inPath, getPath };
export { Context };
