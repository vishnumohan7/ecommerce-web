/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint remains available via `pnpm --filter @app/admin lint` without blocking deployments.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
