import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  serverExternalPackages: ['pdfkit'],
  transpilePackages: ['lucide-react'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.corenexis.com',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Ensure Vercel output tracing includes all pdfkit runtime assets
  // (standard font .cjs chunks resolved via package #imports map at runtime)
  outputFileTracingIncludes: {
    '/api/admin/events/[id]/pdf': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/admin/results/[id]/pdf': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/admin/results/export-pdf': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/admin/results/[id]/responses/[responseId]/pdf': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/feedback/response/download': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/exams/pdf/result': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
    '/api/exams/pdf/roster': [
      './node_modules/pdfkit/js/**/*.cjs',
      './node_modules/pdfkit/js/**/*.js',
      './node_modules/pdfkit/js/**/*.mjs',
    ],
  },
};

export default nextConfig;
