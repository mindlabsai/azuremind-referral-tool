import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Avoid eslint-webpack-plugin running inside webpack’s child compilation.
   * Known breakage: `Cannot set properties of undefined (setting 'defaultMeta')`
   * (ESLint / eslint-webpack-plugin / transitive logging deps after npm updates).
   * Run `npm run lint` locally / in CI instead.
   */
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
