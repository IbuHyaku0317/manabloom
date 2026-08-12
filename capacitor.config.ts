import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.ibuhyaku.manabloom",
  appName: "ManaBloom",
  webDir: "mobile-dist",
  backgroundColor: "#f7f5ee",
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
};

export default config;
