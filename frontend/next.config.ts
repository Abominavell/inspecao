import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const isCapacitor = process.env.CAPACITOR === "true";

const nextConfig: NextConfig = {
  output: isCapacitor ? "export" : "standalone",
  images: { unoptimized: true },
  ...(isCapacitor ? { trailingSlash: true } : {}),
  turbopack: {},
};

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development" || isCapacitor,
});

export default isCapacitor ? nextConfig : withSerwist(nextConfig);
