import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Für Production Build
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // ESLint: Ignoriere während Build (Warnings blockieren nicht mehr)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Server-only Packages (nicht im Client-Bundle)
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-libsql'],

  // Fix für libsql Import-Fehler
  webpack: (config, { isServer }) => {
    // Nur auf Server-Seite libsql verarbeiten
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@prisma/adapter-libsql': false,
        '@libsql/client': false,
      };
    }

    // Ignoriere nicht-Code-Dateien aus node_modules
    config.module.rules.push({
      test: /\.(md|txt)$/,
      type: 'asset/source',
    });

    // Ignoriere LICENSE und .node Binaries
    config.module.rules.push({
      test: /\.(LICENSE|\.node)$/,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;
