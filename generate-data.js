/**
 * 职途灵宠 · 每周数据生成脚本（GitHub Pages 版）
 * ---------------------------------------------------------------
 * 纯静态方案：没有后端，数据以 JSON 文件形式托管在仓库根。
 * 本脚本由 GitHub Actions 在「每周一 09:00（北京时间）」自动调用，
 * 重新生成 market-data.json / jobs-data.json / meta.json 并推回仓库，
 * GitHub Pages 会自动重新部署，评委访问站点即看到最新数据。
 *
 * 默认使用内置样本（离线可跑）。若已准备好真实数据源，可设环境变量：
 *   RECRUIT_SOURCE = 返回 market-data 结构的 JSON 接口地址
 *   JOBS_SOURCE    = 返回 jobs 数组的 JSON 接口地址
 * 抓取失败时自动回退内置样本，保证每周更新永远不空。
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

/* ----------------------- 内置样本：招聘技能词频（人社部口径） ----------------------- */
const SKILL_FREQ = {
  "PLC": 1286, "电气工程": 1102, "继电保护": 874, "SCADA": 803, "DCS": 690,
  "单片机": 952, "嵌入式": 881, "C语言": 760, "Python": 712, "变频器": 645,
  "供配电": 588, "电机拖动": 533, "智能制造": 499, "工业机器人": 477, "自动化产线": 452,
  "CAD": 421, "EPLAN": 398, "传感器": 376, "工业网络": 351, "能效管理": 318
};

/* ----------------------- 内置样本：对口岗位（电气/自动化类） ----------------------- */
const JOB_SAMPLES = [
  { title: "电气工程师", degree: "本科", salaryMin: 8000, salaryMax: 14000, keywords: ["电气", "PLC", "继电保护"], region: "广西壮族自治区", company: "广西电网", requirement: "电气工程及其自动化，熟悉PLC与继电保护" },
  { title: "自动化控制工程师", degree: "本科", salaryMin: 9000, salaryMax: 16000, keywords: ["PLC", "SCADA", "DCS"], region: "广西壮族自治区", company: "柳工集团", requirement: "自动化/控制工程，掌握SCADA与DCS" },
  { title: "变电运维技术员", degree: "大专", salaryMin: 6000, salaryMax: 11000, keywords: ["高低压", "变电", "配电"], region: "广西壮族自治区", company: "南方电网", requirement: "供配电运维，持电工证优先" },
  { title: "设备维修工程师", degree: "本科", salaryMin: 6500, salaryMax: 11000, keywords: ["机电", "变频", "仪表"], region: "广西壮族自治区", company: "玉柴机器", requirement: "机电设备维修，熟悉变频器与仪表" },
  { title: "嵌入式软件工程师", degree: "本科", salaryMin: 10000, salaryMax: 18000, keywords: ["单片机", "嵌入式", "C"], region: "广西壮族自治区", company: "润建股份", requirement: "嵌入式C开发，熟悉单片机" },
  { title: "电气工程师", degree: "本科", salaryMin: 9500, salaryMax: 17000, keywords: ["电气", "PLC"], region: "广东省", company: "比亚迪", requirement: "电气设计，PLC编程" },
  { title: "自动化工程师", degree: "硕士", salaryMin: 12000, salaryMax: 20000, keywords: ["自动化", "机器人"], region: "广东省", company: "大疆创新", requirement: "机器人/自动化系统集成" },
  { title: "电力调度员", degree: "本科", salaryMin: 8000, salaryMax: 15000, keywords: ["电力", "配电"], region: "江苏省", company: "国网江苏", requirement: "电力系统调度，熟悉配电网络" },
  { title: "工业视觉工程师", degree: "本科", salaryMin: 11000, salaryMax: 19000, keywords: ["机器视觉", "Python", "算法"], region: "浙江省", company: "海康威视", requirement: "机器视觉算法，Python" }
];

/* ----------------------- 内置样本：课程→能力调整建议 ----------------------- */
const ADJUSTMENTS = [
  { jobTitle: "电气工程师", ability: "PLC编程", note: "建议在《电气控制与PLC》中增加工程案例实训" },
  { jobTitle: "自动化控制工程师", ability: "SCADA组态", note: "补充SCADA/DCS组态实训课时" },
  { jobTitle: "嵌入式软件工程师", ability: "单片机开发", note: "强化STM32等单片机项目实战" }
];

/* ----------------------- 工具：下一个周一 09:00（北京时间，ISO UTC） ----------------------- */
function nextMonday0900Beijing() {
  // 北京时间 = UTC+8，周一 09:00 北京 = UTC 周一 01:00
  const now = new Date();
  const b = new Date(now.getTime() + 8 * 3600 * 1000); // 转到北京时区视角
  const dow = b.getUTCDay(); // 0=周日 .. 1=周一
  let add = (8 - dow) % 7;
  if (add === 0) add = 7; // 若是周一但已过 09:00，则取下周一
  if (dow === 1 && b.getUTCHours() >= 1) add = 7;
  b.setUTCDate(b.getUTCDate() + add);
  b.setUTCHours(1, 0, 0, 0);
  return b.toISOString();
}

/* ----------------------- 可选真实源抓取（失败回退样本） ----------------------- */
async function fetchJson(url, label) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    clearTimeout(t);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    console.warn(`[warn] ${label} 抓取失败，回退内置样本：${e.message}`);
    return null;
  }
}

async function buildMarketData() {
  const live = process.env.RECRUIT_SOURCE ? await fetchJson(process.env.RECRUIT_SOURCE, "RECRUIT_SOURCE") : null;
  if (live && live.current) return live;
  return {
    current: SKILL_FREQ,
    jobs: JOB_SAMPLES.map(j => ({ title: j.title, company: j.company, requirement: j.requirement, category: j.keywords[0], region: j.region })),
    adjustments: ADJUSTMENTS,
    stats: { total: JOB_SAMPLES.length, regions: [...new Set(JOB_SAMPLES.map(j => j.region))].length },
    source: "sample"
  };
}

async function buildJobsData() {
  const live = process.env.JOBS_SOURCE ? await fetchJson(process.env.JOBS_SOURCE, "JOBS_SOURCE") : null;
  const jobs = (live && Array.isArray(live.jobs)) ? live.jobs : (Array.isArray(live) ? live : JOB_SAMPLES);
  return { source: live ? "live" : "sample", jobs };
}

/* ----------------------- 主流程 ----------------------- */
async function main() {
  const lastUpdate = new Date().toISOString();
  const nextUpdateHint = nextMonday0900Beijing();

  const market = await buildMarketData();
  const jobsWrap = await buildJobsData();

  // 聚合 byRegion 统计
  const byRegion = {};
  jobsWrap.jobs.forEach(j => {
    const r = j.region || "其他";
    byRegion[r] = byRegion[r] || { count: 0 };
    byRegion[r].count += 1;
  });

  const marketOut = Object.assign({}, market, { lastUpdate, nextUpdateHint });
  const jobsOut = Object.assign({}, jobsWrap, { lastUpdate, nextUpdateHint });
  const metaOut = { lastUpdate, nextUpdateHint, source: jobsWrap.source, byRegion, regions: Object.keys(byRegion).length };

  fs.writeFileSync(path.join(ROOT, "market-data.json"), JSON.stringify(marketOut, null, 2));
  fs.writeFileSync(path.join(ROOT, "jobs-data.json"), JSON.stringify(jobsOut, null, 2));
  fs.writeFileSync(path.join(ROOT, "meta.json"), JSON.stringify(metaOut, null, 2));

  console.log(`✅ 数据已生成`);
  console.log(`   lastUpdate     = ${lastUpdate}`);
  console.log(`   nextUpdate     = ${nextUpdateHint}（北京时间下周一 09:00）`);
  console.log(`   regions        = ${Object.keys(byRegion).join("、")}`);
  console.log(`   jobs count     = ${jobsWrap.jobs.length}`);
  console.log(`   source         = ${jobsWrap.source}`);
}

main().catch(e => { console.error("生成失败:", e); process.exit(1); });
