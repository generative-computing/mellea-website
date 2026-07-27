/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow a LAN device (e.g. a phone) to reach the dev server for on-device
  // testing: set NEXT_DEV_ORIGIN to your machine's LAN IP before `npm run dev`.
  allowedDevOrigins: process.env.NEXT_DEV_ORIGIN ? [process.env.NEXT_DEV_ORIGIN] : [],
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
