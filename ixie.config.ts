import { defineConfig } from "ixie";
export default defineConfig({
  publicDir: "./web/public",
  sourceDir: "./web/src",
  serve: {
    config: {
      resolve: {
        conditions: ["browser"],
      },
    },
  },
  resolve: {
    alias: {
      awawa: {
        browser: "data:text/javascript,console.log('browsers say awawa')",
        node: "data:text/javascript,console.log('node says awawa')",
        default:
          "data:text/javascript,console.log('other things say awawa too')",
      },
      "node:path": {
        browser: new URL("web/polyfills/path.cjs", import.meta.url).href,
      },
      "node:os": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/os.js",
          import.meta.url,
        ).href,
      },
      "node:events": {
        browser: new URL("web/polyfills/events.cjs", import.meta.url).href,
      },
      "node:util": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/util.js",
          import.meta.url,
        ).href,
      },
      "node:fs/promises": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/fs/promises.js",
          import.meta.url,
        ).href,
      },
      "node:fs": {
        browser: new URL("web/polyfills/fs.cjs", import.meta.url).href,
      },
      "node:v8": {
        browser: new URL("web/polyfills/v8.cjs", import.meta.url).href,
      },
      "node:crypto": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/crypto.js",
          import.meta.url,
        ).href,
      },
      "node:url": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/url.js",
          import.meta.url,
        ).href,
      },
      "node:querystring": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/querystring.js",
          import.meta.url,
        ).href,
      },
      "node:module": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/module.js",
          import.meta.url,
        ).href,
      },
      "node:assert": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/assert.js",
          import.meta.url,
        ).href,
      },
      "node:buffer": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/buffer.js",
          import.meta.url,
        ).href,
      },
      "node:zlib": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/zlib.js",
          import.meta.url,
        ).href,
      },
      "node:stream": {
        browser: new URL("web/polyfills/stream.cjs", import.meta.url).href,
      },
      "node:string_decoder": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/string_decoder.js",
          import.meta.url,
        ).href,
      },
      "node:process": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/process.js",
          import.meta.url,
        ).href,
      },
      "node:child_process": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/child_process.js",
          import.meta.url,
        ).href,
      },
      "node:worker_threads": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/worker_threads.js",
          import.meta.url,
        ).href,
      },
      "node:http2": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/http2.js",
          import.meta.url,
        ).href,
      },
      "node:tty": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/tty.js",
          import.meta.url,
        ).href,
      },
      "node:http": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/http.js",
          import.meta.url,
        ).href,
      },
      "node:https": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/https.js",
          import.meta.url,
        ).href,
      },
      "node:dns": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/dns.js",
          import.meta.url,
        ).href,
      },
      "node:net": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/net.js",
          import.meta.url,
        ).href,
      },
      "node:tls": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/tls.js",
          import.meta.url,
        ).href,
      },
      "node:timers/promises": {
        browser: new URL(
          "node_modules/@jspm/core/nodelibs/browser/timers/promises.js",
          import.meta.url,
        ).href,
      },
      "./make-spawn-args.js": {
        browser: "data:text/javascript,",
      },
      ".": "./.",
    },
  },
});
