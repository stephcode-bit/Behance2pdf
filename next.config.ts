import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `output: "standalone"` is harmless on Vercel (it ignores the standalone
  // output and uses its own deployment pipeline) but is needed for the local
  // dev preview's build script. Leave it on.
  output: "standalone",

  // ---- @sparticuz/chromium on Vercel serverless ----
  // The package ships a brotli-compressed Chromium binary in `bin/` that it
  // loads at runtime via `__dirname`-based path lookups. Next.js's bundler
  // (Turbopack/webpack) would inline the JS but skip the .br files, leaving
  // the Lambda without a browser. Two fixes:
  //
  //   1. `serverExternalPackages`: don't bundle the package's JS — load it
  //      from node_modules at runtime so its `__dirname` resolves correctly.
  //   2. `outputFileTracingIncludes`: force NFT to copy the .br binaries
  //      into the serverless function bundle at /var/task/node_modules/...
  serverExternalPackages: ["@sparticuz/chromium"],
  outputFileTracingIncludes: {
    "/api/convert": [
      "./node_modules/@sparticuz/chromium/bin/**/*",
      "./node_modules/@sparticuz/chromium/package.json",
    ],
  },

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
