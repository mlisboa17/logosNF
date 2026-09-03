import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit resolve fontes AFM a partir do próprio pacote em runtime.
  // Mantê-lo externo evita que o Turbopack substitua esse caminho por C:\ROOT.
  serverExternalPackages: ["open-nfse", "pdfkit"],
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
