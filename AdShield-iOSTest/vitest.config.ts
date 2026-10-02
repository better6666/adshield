import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // AdShield 保持本地优先：测试环境固定声明不使用外部 API 凭据。
    env: { ADSHIELD_NO_EXTERNAL_SECRET: "local-only" },
  },
});
