import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = resolve(ROOT, "data/services.json");
const SOURCE_URL = "https://clash-jichang.com/airport/";
const SHANGHAI = "Asia/Shanghai";

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code) => {
      const number = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : parseInt(code, 10);
      return Number.isFinite(number) ? String.fromCodePoint(number) : _;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function normalizeText(value) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function parseAttributes(source) {
  const attrs = {};
  const re = /([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let match;
  while ((match = re.exec(source))) attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
  return attrs;
}

function parseHtml(html) {
  const root = { tag: "#root", attrs: {}, children: [], parent: null };
  const stack = [root];
  const tokenRe = /<!--[\s\S]*?-->|<![^>]*>|<[^>]+>|[^<]+/g;
  let token;
  while ((token = tokenRe.exec(html))) {
    const raw = token[0];
    if (raw.startsWith("<!--") || raw.startsWith("<!")) continue;
    if (raw.startsWith("</")) {
      const tag = raw.slice(2, -1).trim().toLowerCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tag === tag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }
    if (raw.startsWith("<")) {
      const selfClosing = /\/\s*>$/.test(raw);
      const inner = raw.slice(1, raw.length - (selfClosing ? 2 : 1)).trim();
      const nameMatch = inner.match(/^([^\s/>]+)/);
      if (!nameMatch) continue;
      const tag = nameMatch[1].toLowerCase();
      const attrs = parseAttributes(inner.slice(nameMatch[0].length));
      const node = { tag, attrs, children: [], parent: stack.at(-1) };
      stack.at(-1).children.push(node);
      if (!selfClosing && !["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].includes(tag)) stack.push(node);
      continue;
    }
    if (raw.trim()) stack.at(-1).children.push({ tag: "#text", text: decodeEntities(raw), children: [], parent: stack.at(-1) });
  }
  return root;
}

function textContent(node) {
  if (!node) return "";
  if (node.tag === "#text") return node.text;
  return node.children.map(textContent).join(" ");
}

function elementChildren(node, tag) {
  return (node?.children || []).filter((child) => child.tag !== "#text" && (!tag || child.tag === tag));
}

function descendants(node, predicate, output = []) {
  for (const child of node?.children || []) {
    if (child.tag !== "#text") {
      if (predicate(child)) output.push(child);
      descendants(child, predicate, output);
    }
  }
  return output;
}

function findFirst(node, predicate) {
  return descendants(node, predicate, [])[0];
}

function links(node) {
  return descendants(node, (item) => item.tag === "a").map((item) => ({
    text: normalizeText(textContent(item)),
    href: item.attrs.href || "",
  }));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "service";
}

function safeAsset(value, index) {
  const slug = slugify(value).replace(/[\u4e00-\u9fff]+/g, (part) => part);
  return slug || `service-${String(index + 1).padStart(2, "0")}`;
}

function tableRows(table) {
  return descendants(table, (node) => node.tag === "tr").map((row) => ({
    cells: elementChildren(row).filter((cell) => cell.tag === "th" || cell.tag === "td").map((cell) => normalizeText(textContent(cell))),
    links: links(row),
  }));
}

function firstSentence(value) {
  const text = normalizeText(value);
  return text.length <= 74 ? text : `${text.slice(0, 72)}…`;
}

function detectPromo(text) {
  const match = text.match(/(?:优惠码|折扣码|折扣).*?(?:[:：]|为|是)?\s*([A-Za-z][A-Za-z0-9_-]{2,})/i);
  return match?.[1] || "—";
}

function detectRoute(text) {
  const matches = [...String(text).matchAll(/(IPLC|IEPL|BGP|SD-WAN|ANYCAST|中转\s*\+\s*直连|中转|直连|专线)/gi)].map((match) => match[1]);
  return [...new Set(matches)].slice(0, 3).join(" + ") || "以主站介绍为准";
}

function detectProtocol(text) {
  const matches = [...String(text).matchAll(/(Hysteria\s*2|AnyTLS|VLESS|Trojan|Shadowsocks|SS)/gi)].map((match) => match[1]);
  return [...new Set(matches)].slice(0, 3).join(" / ") || "以官网资料为准";
}

function categoryFor(service, index) {
  if (service.risk) return ["风险预警"];
  const text = `${service.name} ${service.description} ${service.highlights.join(" ")} ${service.price}`;
  const lowCost = /^(?:[0-9]|10|11)(?:\.\d+)?元/.test(service.price) || /山海|锦云|九云|快狸|99吧|拼好连|极速cloud|边缘节点/.test(service.name);
  const legacy = /老牌|成立于 20|多年稳定|五年|5 年|六年|十年|FlowerCloud|大哥云|龙猫云|飞鸟机场/.test(text);
  const premium = /IPLC|IEPL|企业级|高端|2\.5Gbps|1000Mbps|专线/.test(text) && !lowCost;
  const categories = [];
  if (legacy) categories.push("老牌机场");
  if (lowCost) categories.push("性价比机场");
  if (!lowCost || /稳定|高峰|晚高峰|不限速|专线/.test(text)) categories.push("稳定机场");
  if (premium) categories.push("高端机场");
  if (!categories.length) categories.push(index < 4 ? "稳定机场" : "性价比机场");
  return [...new Set(categories)];
}

function matchDetail(summaryName, detail) {
  const a = summaryName.replace(/机场$/, "");
  const b = detail.name.replace(/机场$/, "");
  return a === b || a.startsWith(b) || b.startsWith(a) || (summaryName.includes("FlowerCloud") && detail.name.includes("花云")) || (summaryName === "云图机场" && detail.name === "云图") || (summaryName === "拼好连" && detail.name.startsWith("拼好连"));
}

function extractDocument(html) {
  const root = parseHtml(html);
  const markdown = findFirst(root, (node) => node.attrs.id === "markdown-content");
  if (!markdown) throw new Error("主站页面缺少 #markdown-content");

  const tables = descendants(markdown, (node) => node.tag === "table");
  const summaryTable = tables.find((table) => tableRows(table)[0]?.cells.includes("名称"));
  if (!summaryTable) throw new Error("主站页面缺少机场汇总表");
  const summary = tableRows(summaryTable).slice(1).map((row) => {
    const name = row.cells[0];
    const direct = row.links.find((link) => link.text === "直达官网") || row.links.find((link) => /go\//.test(link.href));
    const detail = row.links.find((link) => link.text === name) || row.links.find((link) => /#/.test(link.href));
    return {
      name,
      price: row.cells[3] || "以官网为准",
      url: direct?.href || "",
      detailUrl: detail?.href ? new URL(detail.href, SOURCE_URL).href : "",
    };
  });

  const headings = descendants(markdown, (node) => node.tag === "h3" && /^\d+\.\s/.test(normalizeText(textContent(node))));
  const detailList = headings.map((heading) => {
    const nodes = [];
    let cursor = heading.parent?.children?.[heading.parent.children.indexOf(heading) + 1];
    while (cursor && !(cursor.tag === "h3" && /^\d+\.\s/.test(normalizeText(textContent(cursor)))) && cursor.tag !== "h2") {
      if (cursor.tag !== "#text") nodes.push(cursor);
      cursor = heading.parent.children[heading.parent.children.indexOf(cursor) + 1];
    }
    const ps = nodes.filter((node) => node.tag === "p").map((node) => normalizeText(textContent(node))).filter(Boolean);
    const description = ps.find((value) => !/^(?:[^：]{1,20}官网地址|最便宜|👉|💡|核心特性|特色功能|🚨|⚠️|✨)/.test(value)) || "暂无详细介绍，购买前请以主站和官网实时信息为准。";
    const highlights = nodes.flatMap((node) => node.tag === "ul" ? elementChildren(node, "li").map((li) => normalizeText(textContent(li))).filter(Boolean) : []).slice(0, 8);
    const detailLinks = nodes.flatMap(links);
    const review = detailLinks.find((link) => /独立深度评测|跑路情况说明|预警情况说明/.test(link.text));
    const name = normalizeText(textContent(heading)).replace(/^\d+\.\s*/, "").replace(/\s*（.*$/, "").trim();
    const risk = /奈云/.test(name) ? "已确认跑路，主站提示停止充值和续费" : /隐云/.test(name) ? "高风险，主站提示停止续费并更换备用机场" : "";
    return { name, description, highlights, reviewUrl: review?.href ? new URL(review.href, SOURCE_URL).href : "", risk };
  });

  const services = summary.map((item, index) => {
    const detail = detailList.find((candidate) => matchDetail(item.name, candidate)) || { name: item.name, description: "暂无详细介绍，购买前请以主站和官网实时信息为准。", highlights: [], reviewUrl: "", risk: "" };
    const allText = `${detail.description} ${detail.highlights.join(" ")}`;
    const categories = categoryFor({ ...item, ...detail }, index);
    const service = {
      rank: index + 1,
      asset: safeAsset(item.name, index),
      slug: slugify(item.name),
      name: item.name,
      category: categories[0],
      categories,
      route: detectRoute(allText),
      protocol: detectProtocol(allText),
      price: item.price,
      promo: detectPromo(allText),
      use: firstSentence(detail.description),
      evidence: detail.risk ? `主站风险提示：${detail.risk}` : "主站公开资料整理（价格、入口和介绍均来自 clash-jichang.com/airport/）",
      description: detail.risk ? `${detail.risk}。${detail.description}` : detail.description,
      highlights: detail.highlights,
      url: item.url,
      reviewUrl: detail.reviewUrl || (item.detailUrl ? item.detailUrl.replace(/\/$/, "") : SOURCE_URL),
    };
    if (detail.risk) service.risk = detail.risk;
    return service;
  });

  return {
    updatedAt: today(),
    sourceUrl: SOURCE_URL,
    home: "https://clash-jichang.com/",
    telegram: "https://t.me/JIAN6688",
    compare: "https://clash-jichang.com/airport/compare",
    brands: "https://clash-jichang.com/airport/brands",
    category_order: ["老牌机场", "性价比机场", "稳定机场", "高端机场", "风险预警"],
    services,
  };
}

async function loadHtml() {
  if (process.env.SOURCE_FILE) return readFileSync(resolve(process.cwd(), process.env.SOURCE_FILE), "utf8");
  const response = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`读取主站失败：HTTP ${response.status}`);
  return response.text();
}

const payload = extractDocument(await loadHtml());
if (payload.services.length < 1) throw new Error("主站未提取到机场数据");
writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(`已从 ${SOURCE_URL} 同步 ${payload.services.length} 家机场到 data/services.json`);
