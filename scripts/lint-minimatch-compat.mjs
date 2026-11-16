import { createRequire } from "node:module";

// Legacy lint plugins expect a callable CommonJS default; upstream v11 exports
// named functions. Adapt only the lint process, before those plugins load.
// All matching still executes the patched upstream implementation unchanged.
const require = createRequire(import.meta.url);
const path = require.resolve("minimatch");
const upstream = require(path);
if (typeof upstream !== "function") {
  const callable = Object.assign(upstream.minimatch, {
    minimatch: upstream.minimatch,
    Minimatch: upstream.Minimatch,
    GLOBSTAR: upstream.GLOBSTAR,
    braceExpand: upstream.braceExpand,
    escape: upstream.escape,
    unescape: upstream.unescape,
    filter: upstream.filter,
    // eslint-plugin-import/no-internal-modules only calls result.test().
    // v11 intentionally removed regex compilation; retain that test contract
    // using its nonrecursive matcher, never rebuild the vulnerable regex engine.
    makeRe: (pattern, options) => {
      const matcher = new upstream.Minimatch(pattern, options);
      return { test: value => matcher.match(value) };
    },
    match: upstream.match,
    sep: upstream.sep,
  });
  require.cache[path].exports = callable;
}
