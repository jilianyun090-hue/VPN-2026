/**
 * README generator modeled after the reference repository.
 *
 * DATA_URL is optional. When it is empty, data/services.json is used.
 * The endpoint may return either an array or { services: [...] }.
 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_DATA = resolve(ROOT, "data/services.json");
const DATA_URL = (process.env.DATA_URL || "").trim();
const SHANGHAI = "Asia/Shanghai";

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function loadPayload() {
  if (!DATA_URL) return JSON.parse(readFileSync(LOCAL_DATA, "utf8"));
  const response = await fetch(DATA_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`读取 ${DATA_URL} 失败：HTTP ${response.status}`);
  return response.json();
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "service";
}

function tableValue(value) {
  return String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ").trim() || "—";
}

function mdLink(label, url) {
  return url ? `[${label}](${url})` : label;
}

function svgText(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function assetSlug(service) {
  return service.asset || `service-${String(service.rank).padStart(2, "0")}`;
}

const THEMES = [
  { bg: ["#fff7ed", "#ffedd5"], accent: "#ea580c", accent2: "#f59e0b", ink: "#431407", soft: "#7c2d12" },
  { bg: ["#f5f3ff", "#ede9fe"], accent: "#7c3aed", accent2: "#a855f7", ink: "#2e1065", soft: "#5b21b6" },
  { bg: ["#ecfeff", "#cffafe"], accent: "#0891b2", accent2: "#06b6d4", ink: "#083344", soft: "#155e75" },
  { bg: ["#fff1f2", "#ffe4e6"], accent: "#e11d48", accent2: "#fb7185", ink: "#4c0519", soft: "#9f1239" },
  { bg: ["#f0fdf4", "#dcfce7"], accent: "#16a34a", accent2: "#84cc16", ink: "#052e16", soft: "#166534" },
];

function themeFor(service) {
  return THEMES[(Math.max(1, Number(service.rank) || 1) - 1) % THEMES.length];
}

function bannerSvg(date, count) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" role="img" aria-label="2026 机场推荐与梯子清单横幅">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff7ed"/><stop offset=".52" stop-color="#f5f3ff"/><stop offset="1" stop-color="#e0f2fe"/></linearGradient><linearGradient id="accent" x1="0" x2="1"><stop stop-color="#ea580c"/><stop offset=".5" stop-color="#7c3aed"/><stop offset="1" stop-color="#0891b2"/></linearGradient></defs>
  <rect width="1200" height="300" rx="30" fill="url(#bg)"/><path d="M0 235 C190 140 315 315 520 215 S890 86 1200 180 V300 H0 Z" fill="#ffffff" opacity=".55"/><circle cx="1070" cy="48" r="165" fill="#7c3aed" opacity=".12"/><circle cx="120" cy="275" r="130" fill="#ea580c" opacity=".10"/>
  <text x="72" y="70" fill="#7c3aed" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="20" font-weight="800" letter-spacing="2">CLASH · SING-BOX · V2RAY · IEPL / IPLC</text>
  <text x="72" y="145" fill="#1e1b4b" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="52" font-weight="900">2026 机场推荐与梯子清单</text>
  <text x="74" y="198" fill="#475569" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="22">${count} 条公开资料 · 稳定专线 · 平价月付 · ChatGPT / Claude · 每日同步</text>
  <rect x="74" y="231" width="230" height="9" rx="5" fill="url(#accent)"/><text x="1128" y="250" text-anchor="end" fill="#64748b" font-family="Arial,sans-serif" font-size="15">更新：${date} · 独立配色示意</text>
</svg>`;
}

function speedSvg(service) {
  const theme = themeFor(service);
  const seed = Math.max(1, Number(service.rank) || 1);
  const bars = [
    ["亚洲入口", 72 + ((seed * 11) % 22)],
    ["日韩 / 台湾入口", 58 + ((seed * 7) % 25)],
    ["欧美入口", 42 + ((seed * 5) % 28)],
  ];
  const rows = bars.map(([label, width], index) => {
    const y = 112 + index * 62;
    const color = index === 0 ? theme.accent : index === 1 ? theme.accent2 : theme.soft;
    return `<text x="54" y="${y}" fill="${theme.ink}" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="16" font-weight="800">● ${label}</text><rect x="54" y="${y + 15}" width="920" height="16" rx="8" fill="#ffffffaa"/><rect x="54" y="${y + 15}" width="${Math.round(920 * width / 100)}" height="16" rx="8" fill="${color}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 330" role="img" aria-label="${svgText(service.name)}测速示意图">
  <defs><linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${theme.bg[0]}"/><stop offset="1" stop-color="${theme.bg[1]}"/></linearGradient></defs><rect width="1040" height="330" rx="26" fill="url(#card)"/><circle cx="960" cy="40" r="120" fill="${theme.accent}" opacity=".10"/><text x="54" y="48" fill="${theme.accent}" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="21" font-weight="900">◈ ${svgText(service.name)} · 线路概览</text>
  <text x="54" y="76" fill="#64748b" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="13">独立配色示意图 · 线路和套餐以官网当前信息为准</text><line x1="54" x2="986" y1="90" y2="90" stroke="#64748b33"/>${rows}
  <line x1="54" x2="986" y1="290" y2="290" stroke="#64748b33"/><text x="54" y="313" fill="#64748b" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="13">参考线路：${svgText(service.route)} · 协议：${svgText(service.protocol)}</text><text x="986" y="313" text-anchor="end" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">VPN-2026</text></svg>`;
}

function unlockSvg(service) {
  const theme = themeFor(service);
  const names = ["ChatGPT", "Claude", "Gemini", "Netflix", "Disney+", "YouTube", "TikTok", "Spotify", "Bilibili", "HBO Max"];
  const cells = names.map((name, index) => {
    const x = 40 + (index % 5) * 196;
    const y = 96 + Math.floor(index / 5) * 92;
    return `<rect x="${x}" y="${y}" width="176" height="70" rx="16" fill="#ffffffbb" stroke="${theme.accent}33"/><text x="${x + 88}" y="${y + 25}" text-anchor="middle" fill="${theme.ink}" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="15" font-weight="800">${name}</text><text x="${x + 88}" y="${y + 51}" text-anchor="middle" fill="#15803d" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="13" font-weight="800">✓ 已解锁</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1040 300" role="img" aria-label="${svgText(service.name)} AI 与流媒体状态示意图"><defs><linearGradient id="card" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${theme.bg[0]}"/><stop offset="1" stop-color="${theme.bg[1]}"/></linearGradient></defs><rect width="1040" height="300" rx="26" fill="url(#card)"/><circle cx="980" cy="44" r="100" fill="${theme.accent2}" opacity=".13"/><text x="40" y="46" fill="${theme.accent}" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="21" font-weight="900">✦ ${svgText(service.name)} · AI / 流媒体状态</text><text x="40" y="72" fill="#64748b" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="13">状态标签采用统一展示样式，实际体验会随节点、地区和时间变化</text>${cells}<text x="1000" y="282" text-anchor="end" fill="#94a3b8" font-family="Arial,sans-serif" font-size="12">VPN-2026</text></svg>`;
}

function writeImages(services, date) {
  const imageDir = resolve(ROOT, "images");
  mkdirSync(imageDir, { recursive: true });
  for (const file of readdirSync(imageDir)) {
    if (file.endsWith("-speed.svg") || file.endsWith("-unlock.svg")) unlinkSync(resolve(imageDir, file));
  }
  writeFileSync(resolve(imageDir, "banner.svg"), bannerSvg(date, services.length), "utf8");
  for (const service of services) {
    const name = assetSlug(service);
    writeFileSync(resolve(imageDir, `${name}-speed.svg`), speedSvg(service), "utf8");
    writeFileSync(resolve(imageDir, `${name}-unlock.svg`), unlockSvg(service), "utf8");
  }
}

function basisLabel(service) {
  const evidence = String(service.evidence || "");
  if (evidence.includes("实测")) return "✅ 有实测记录";
  if (evidence.includes("待独立核验") || evidence.includes("用户提供") || evidence.includes("资料整理")) {
    return "📝 资料整理";
  }
  if (evidence.includes("核验")) return "📋 套餐已核验";
  return "📝 资料整理";
}

function normalize(payload) {
  const meta = Array.isArray(payload) ? {} : payload;
  const raw = Array.isArray(payload) ? payload : (payload.services || payload.airports || []);
  if (!Array.isArray(raw) || raw.length === 0) throw new Error("数据源缺少非空 services 数组");

  const seen = new Set();
  return {
    meta,
    services: raw.map((item, index) => {
      if (!item?.name) throw new Error(`第 ${index + 1} 条资料缺少 name`);
      const service = {
        rank: index + 1,
        category: "其他",
        route: "待核验",
        protocol: "待核验",
        price: "以官网为准",
        promo: "—",
        use: "日常使用",
        evidence: "资料整理，购买前请自行核验",
        description: "暂无详细说明",
        url: "",
        ...item,
      };
      service.rank = Number(service.rank) || index + 1;
      service.slug = service.slug || slugify(service.name);
      if (seen.has(service.slug)) {
        service.name = `${service.name}（重复记录）`;
        service.slug = `${service.slug}-duplicate-${index + 1}`;
        service.evidence = "原始资料存在重复记录，待确认";
      }
      seen.add(service.slug);
      return service;
    }),
  };
}

function generate(services, meta) {
  const date = today();
  const categories = meta.category_order || ["高端专线", "平价月付", "AI / 原生 IP", "流媒体"];
  const ordered = [...services].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name, "zh"));
  const groups = new Map(categories.map((category) => [category, []]));
  for (const service of ordered) {
    if (!groups.has(service.category)) groups.set(service.category, []);
    groups.get(service.category).push(service);
  }
  const tested = services.filter((service) => String(service.evidence).includes("实测")).length;
  const duplicates = services.filter((service) => String(service.evidence).includes("重复记录")).length;
  const home = meta.home || "";
  const telegram = meta.telegram || "";
  const lines = [
    `# 2026 梯子推荐与机场推荐清单（${services.length} 条资料，每日自动更新）`,
    "",
    `![更新日期](https://img.shields.io/badge/更新-${date.replaceAll("-", "--")}-00e676) ![收录资料](https://img.shields.io/badge/收录-${services.length}%20条-00b0ff) ![有实测记录](https://img.shields.io/badge/有实测-${tested}%20条-fbbf24) ![每日同步](https://img.shields.io/badge/每日同步-GitHub%20Actions-2088ff)`,
    "",
    "> 本仓库是公开资料整理与 GitHub 镜像示例。价格、优惠码、线路和可用性会变化，购买前请在官网核验，并优先月付试用。",
    ">",
    "> 订阅链接等同账号密钥，请勿公开粘贴或提交到 Issues、日志和截图中。请遵守你所在地的法律法规及服务条款。",
    "",
    `**数据更新时间：${date}（Asia/Shanghai）** · ${home ? mdLink("主站", home) : "主站待配置"}${telegram ? ` · ${mdLink("Telegram", telegram)}` : ""}`,
    "",
    "![2026 机场推荐、梯子节点与代理客户端导航](images/banner.svg)",
    "",
    "这是一个围绕 **2026 机场推荐、梯子推荐、稳定专线、平价月付、ChatGPT / Claude 节点、Clash、Sing-box、V2Ray、Shadowsocks、Trojan、IEPL / IPLC** 等搜索需求整理的 GitHub 资料页。表格用于快速对比价格、协议、线路和适用场景，具体可用性以官网和自行测试为准。",
    "每家资料均配有独立配色的线路概览图和 AI / 流媒体状态图，图片只用于阅读导航和版式展示。",
    "",
    "## 📋 目录",
    "",
    "- [本期摘要](#摘要) · [TOP 推荐](#top) · [快速选购指南](#guide) · [全部资料](#全部资料)",
    "- [高端专线](#高端专线) · [平价月付](#平价月付) · [AI / 原生 IP](#ai-原生-ip) · [流媒体](#流媒体)",
    "- [数据如何自动更新](#数据如何自动更新) · [客户端建议](#客户端建议) · [常见问题](#常见问题) · [免责声明](#免责声明)",
    "",
    '<a name="摘要"></a>',
    "## 📢 本期摘要",
    "",
    `- 当前展示 **${services.length} 条资料**，其中有明确实测记录的 **${tested} 条**。`,
    "- 排名是资料整理的参考顺序，不代表任何时段的速度、稳定性或解锁保证。",
  ];
  if (duplicates) lines.push(`- 检测到 **${duplicates} 条重复记录**，已在列表中标注，建议你补充或删除重复项。`);

  lines.push("", '<a name="top"></a>', "## 🏆 TOP 推荐（参考排序）", "", "| 位置 | 名称 | 入门价格 | 线路 / 协议 | 适用场景 | 资料口径 | 入口 |", "| :---: | :--- | :--- | :--- | :--- | :--- | :--- |");
  for (const service of ordered.slice(0, 3)) {
    lines.push(`| ${service.rank} | ${mdLink(tableValue(service.name), service.url)} | ${tableValue(service.price)} | ${tableValue(service.route)} / ${tableValue(service.protocol)} | ${tableValue(service.use)} | ${basisLabel(service)} | ${service.url ? mdLink("官网注册", service.url) : "待配置"} |`);
  }

  lines.push("", '<a name="guide"></a>', "## ⚡ 快速选购指南", "", "| 使用需求 | 优先查看 | 选择建议 |", "| :--- | :--- | :--- |");
  const guideRows = [
    ["追求晚高峰稳定", ordered.filter((item) => item.category === "高端专线").slice(0, 3), "先月付，完整体验晚高峰后再考虑长期套餐"],
    ["预算敏感 / 备用线路", ordered.filter((item) => item.category === "平价月付").slice(0, 3), "优先看月付价格、流量有效期和退款规则"],
    ["ChatGPT / Claude / Gemini", ordered.filter((item) => item.category === "AI / 原生 IP").slice(0, 3), "不要只看宣传，购买后逐个节点验证"],
    ["Netflix / YouTube / 4K 流媒体", ordered.filter((item) => item.category === "流媒体").slice(0, 3), "解锁状态会变动，优先选择可短期试用的套餐"],
  ];
  for (const [need, items, advice] of guideRows) {
    lines.push(`| **${need}** | ${items.length ? items.map((item) => mdLink(item.name, `#${item.slug}`)).join("、") : "待补充"} | ${advice} |`);
  }
  lines.push("", "> 选购纪律：新服务先月付，准备一条低价备用线路，不要公开粘贴订阅地址。", "");

  lines.push("", '<a name="全部资料"></a>', `## 📊 全部资料（${services.length} 条，按参考排序）`, "", "| 排名 | 名称 | 分类 | 入门价格 | 优惠码 | 线路 | 协议 | 资料口径 | 入口 |", "| :---: | :--- | :--- | :--- | :---: | :--- | :--- | :--- | :--- |");
  for (const service of ordered) {
    lines.push(`| ${service.rank} | ${mdLink(tableValue(service.name), `#${service.slug}`)} | ${tableValue(service.category)} | ${tableValue(service.price)} | \`${tableValue(service.promo)}\` | ${tableValue(service.route)} | ${tableValue(service.protocol)} | ${basisLabel(service)} | ${service.url ? mdLink("官网注册", service.url) : "待配置"} |`);
  }

  for (const [category, items] of groups) {
    if (!items.length) continue;
    lines.push("", `<a name="${slugify(category)}"></a>`, `## 🧭 ${category}（${items.length} 条）`, "");
    for (const service of items) {
      lines.push(`### ${service.rank}. ${service.name}`, "", `**${tableValue(service.price)}** · 线路：${tableValue(service.route)} · 协议：${tableValue(service.protocol)} · 优惠码：\`${tableValue(service.promo)}\``, "", tableValue(service.description), "", `- 适用场景：${tableValue(service.use)}`, `- 资料口径：${tableValue(service.evidence)}`, `- 入口：${service.url ? mdLink("官网注册", service.url) : "待配置"}`, "");
      {
        const name = assetSlug(service);
        lines.push(`![${service.name}线路概览示意图](images/${name}-speed.svg)`, "", `![${service.name}AI与流媒体状态示意图](images/${name}-unlock.svg)`, "");
      }
    }
  }

  lines.push(
    '<a name="数据如何自动更新"></a>',
    "## 🔄 数据如何自动更新",
    "",
    "1. `.github/workflows/daily-sync.yml` 按北京时间每天 00:30 运行，也支持在 Actions 页面手动运行。",
    "2. 工作流执行 `node scripts/build-readme.mjs`。脚本优先读取 `DATA_URL` 指向的 HTTPS JSON；没有配置时使用仓库内的 `data/services.json`。",
    "3. 脚本重新生成 `README.md`，更新日期、数量徽章和表格；文件有变化时，Actions 自动提交。",
    "",
    "### 接入外部 JSON 接口",
    "",
    "在 GitHub 仓库的 Settings → Secrets and variables → Actions → Variables 中添加 `DATA_URL`。接口可以直接返回数组，也可以返回 `{\"updatedAt\": \"...\", \"services\": [...]}`。",
    "",
    "> 参考仓库的链接本质上是 JSON 数据里的 URL 字段被生成器写成 Markdown `[文字](https://...)`，并不是 GitHub 自动生成的特殊链接。",
    "",
    '<a name="客户端建议"></a>',
    "## 📱 客户端建议",
    "",
    "- Windows / macOS：Clash Verge Rev、v2rayN、sing-box",
    "- Android：Clash Meta for Android、v2rayNG",
    "- iOS：Shadowrocket、Stash（请通过官方渠道获取）",
    "- 导入订阅前确认链接来源，订阅地址不要公开发送。",
    "",
    '<a name="常见问题"></a>',
    "## ❓ 常见问题",
    "",
    "**没有外部接口可以运行吗？** 可以。保持 `DATA_URL` 未设置，脚本会使用 `data/services.json`。",
    "",
    "**如何手动更新？** 打开仓库的 Actions，选择 `每日同步 README`，点击 `Run workflow`。",
    "",
    '<a name="免责声明"></a>',
    "## 📌 免责声明",
    "",
    "本清单只做公开资料整理和技术演示。价格、优惠活动、线路、IP 质量、速度、解锁状态和服务存续都可能变化；除明确标注的记录外，不应把表格内容理解为独立实测结论。部分链接可能包含推广参数，是否使用由你自行决定。",
    "",
    "⭐ 如果这个仓库对你有帮助，欢迎 Star；发现过期资料请提交 Issue。",
    "",
  );
  return lines.join("\n");
}

const payload = await loadPayload();
const { meta, services } = normalize(payload);
writeImages(services, today());
writeFileSync(resolve(ROOT, "README.md"), generate(services, meta), "utf8");
console.log(`完成：README.md（${services.length} 条资料，数据源：${DATA_URL || "data/services.json"}）`);
