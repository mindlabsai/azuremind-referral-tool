import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@react-pdf/renderer"],
  // unpdf is the serverless PDF text path for intake (no DOMMatrix / canvas).
  serverExternalPackages: ["unpdf", "pdfjs-dist", "mammoth"],
};

export default nextConfig;
