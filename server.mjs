// Outplane node-start buildpack entry shim.
// Outplane's Paketo node-start buildpack expects either a "main" field in
// package.json or an explicit Procfile target — we provide both. This shim
// just delegates to the Nitro server output that `nuxt build` produces.
import './.output/server/index.mjs'
