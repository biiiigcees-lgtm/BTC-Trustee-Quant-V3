import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
    // Never cache API routes — prices must always be live
    runtimeCaching: [
      {
        urlPattern: /^\/api\/.*/,
        handler: "NetworkOnly",
      },
    ],
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Fix cross-origin warning for browser preview
  allowedDevOrigins: ['127.0.0.1'],
  // Next.js 16 requires explicit turbopack config when webpack config is present via plugins.
  turbopack: {
    root: process.cwd(),
  },
};

export default withPWA(nextConfig);
