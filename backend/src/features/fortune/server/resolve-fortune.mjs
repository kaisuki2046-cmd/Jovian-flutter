export function resolve(specifier, context, next) {
  if (context.parentURL?.includes('/features/fortune/')
    && /^\.{1,2}\//u.test(specifier) && !/\.[a-z]+$/iu.test(specifier)) {
    return next(specifier + '.ts', context);
  }
  return next(specifier, context);
}
