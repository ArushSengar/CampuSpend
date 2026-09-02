import type { NextConfig } from "next";

/**
 * Next 16 blocks cross-origin requests to dev-only resources (JS chunks, HMR)
 * unless the host is listed here. Hosted dev sandboxes — Arena/e2b, Codespaces,
 * Gitpod — serve the app from a generated public hostname, so without this the
 * preview loads the HTML but never hydrates: buttons silently do nothing.
 */
const devOrigins = [
  process.env.E2B_SANDBOX_ID ? `3000-${process.env.E2B_SANDBOX_ID}.e2b.app` : null,
  process.env.E2B_SANDBOX_ID ? `${process.env.E2B_SANDBOX_ID}-3000.e2b.app` : null,
  ...(process.env.DEV_ALLOWED_ORIGINS?.split(",") ?? []),
  ...(process.env.CODESPACES ? [process.env.CODESPACE_NAME ? `3000-${process.env.CODESPACE_NAME}.preview.app.github.dev` : null] : []),
].filter((value): value is string => Boolean(value));

const nextConfig: NextConfig = {
  ...(devOrigins.length ? { allowedDevOrigins: devOrigins } : {}),
};

export default nextConfig;
