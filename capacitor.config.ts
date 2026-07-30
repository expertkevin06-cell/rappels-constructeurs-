import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.rappels.constructeurs",
  appName: "Rappels Constructeurs",
  webDir: "dist",
  server: {
    url: "https://rappels-constructeurs.vercel.app",
    cleartext: false,
  },
};

export default config;
