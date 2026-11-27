import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (context.parentURL?.includes('/synastry/') && specifier.startsWith('.')
      && !['.ts', '.mjs', '.json'].some((suffix) => specifier.endsWith(suffix))) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);
