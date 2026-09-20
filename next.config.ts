import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  poweredByHeader: false,

  experimental: {
    /*
     * SMOOTHNESS: Next.js 15 re-fetches a page from the server every time
     * you navigate to it, even if you were on it 2 seconds ago.
     * This keeps recently visited pages for 30 seconds so clicking between
     * Dashboard / Students / Attendance feels instant.
     * (Saving data still refreshes it - see router.refresh() in the components.)
     */
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
