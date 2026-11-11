import { readFileSync } from "node:fs";

const overrides = JSON.parse(readFileSync(new URL("../data/overrides.json", import.meta.url), "utf8"));

for (const [name, value] of Object.entries(overrides.registrationUrls || {})) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${name} 的注册入口必须是无账号密码的 HTTPS URL`);
  }
}
if (!Number.isInteger(overrides.testingSummary?.count) || overrides.testingSummary.count < 0) {
  throw new Error("testingSummary.count 必须是非负整数");
}

// Both website synchronization and README generation honor the maintained links.
export function applyOverrides(payload) {
  const meta = Array.isArray(payload) ? {} : payload;
  const services = Array.isArray(payload) ? payload : (payload.services || payload.airports);
  if (!Array.isArray(services)) throw new Error("数据源缺少 services 数组");
  return {
    ...meta,
    testingSummary: { ...overrides.testingSummary },
    services: services.map((service) => {
      const url = overrides.registrationUrls?.[service.name];
      return url ? { ...service, url } : service;
    }),
  };
}
