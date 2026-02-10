import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Für Production Build
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // ESLint: Ignoriere während Build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Server-only Packages: Nicht bundlen, sondern als externe Module laden.
  // Verhindert Turbopack/Webpack-Fehler mit .md/.node Dateien in diesen Paketen.
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-libsql',
    '@libsql/client',
    '@libsql/isomorphic-fetch',
  ],

  // Webpack (für `next build` / Production)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@prisma/adapter-libsql': false,
        '@libsql/client': false,
      };
    }
    return config;
  },
};

export default nextConfig;
