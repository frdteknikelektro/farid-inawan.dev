import type { NextConfig } from "next";

// When deploying to GitHub Pages as a project site the app is served from
// https://<user>.github.io/farid-inawan.dev/, so assets need a base path.
// The deploy script sets NEXT_PUBLIC_BASE_PATH; local dev leaves it empty.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath: basePath || undefined,
  images: { unoptimized: true },
};

export default nextConfig;
