/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Lint remains available via `pnpm --filter @app/web lint` without blocking deployments.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
