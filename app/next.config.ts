import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Für Production Build
  output: process.env.NODE_ENV === 'production' ? 'standalone' : undefined,

  // ESLint: Ignoriere während Build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Server-only Packages
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-libsql',
    '@libsql/client',
    '@libsql/isomorphic-fetch',
  ],

  // Turbopack (für `next dev --turbopack`)
  turbopack: {
    rules: {
      '*.md': {
        loaders: ['raw-loader'],
        as: '*.js',
      },
    },
  },

  // Webpack (für `next build` / Production)
  webpack: (config, { isServer, dev }) => {
    // Webpack Persistent Cache deaktivieren im Dev-Modus
    // (Workaround für ENOENT-Fehler bei Pfaden mit Leerzeichen)
    if (dev) {
      config.cache = false;
    }

    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@prisma/adapter-libsql': false,
        '@libsql/client': false,
      };
    }

    config.module.rules.push({
      test: /\.(md|txt)$/,
      type: 'asset/source',
    });

    config.module.rules.push({
      test: /\.(LICENSE|\.node)$/,
      type: 'asset/resource',
    });

    return config;
  },
};

export default nextConfig;
