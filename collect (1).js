#!/usr/bin/env node
/**
 * 职途灵宠 · 招聘数据采集脚本（扁平版 · JobDataLake 自动拉取）
 * ------------------------------------------------------------
 * 作用：从 JobDataLake 免费招聘 API 拉取真实在招岗位，整理成前端可直接消费的 jobs.json。
 *   - 免费档（无需密钥）：https://api.jobdatalake.com/v1/jobs ，每天 500 次调用，足够每周自动跑。
 *   - 可选：设置环境变量 JDL_API_KEY 提升配额（Bearer 鉴权）。
 *   - 兜底：若 API 拉取失败（限流/断网），回退到同目录 seed.json，保证仓库不空。
 * 输出：jobs.json，结构 { version, updatedAt, note, jobsRaw:[...] }
 *   - 仅当数据与上次不同才自增 version 并写盘（避免 GitHub Actions 每周空提交）。
 *
 * 前端合并逻辑：页面读取 jobs.json.jobsRaw，替换内置 CAREER_PET_DATA.jobsRaw
 * （version 比内置 2.0.0 新才生效，绝不降级）。
 *
 * JobDataLake 字段 → 本应用 schema 映射：
 *   title          → title
 *   locations+countries → regionId（如 "远程 · US"）
 *   seniority      → degree 槽位填充为经验要求（如 "3-5年"）
 *   salary_min_usd/max_usd（单位：千美元）→ salaryMin/salaryMax（×1000，面板以 "k" 展示）
 *   required_skills → keywords
 *   （固定）source = "JobDataLake"
 */

const fs = require('fs');
const path = require('path');

const SEED = path.join(__dirname, 'seed.json');
const OUT = path.join(__dirname, 'jobs.json');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function bumpVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || '');
  if (!m) return '2.2.0';
  return `${+m[1]}.${+m[2] + 1}.${+m[3]}`;
}

// seniority 数组 → 经验要求（填充到 degree 槽位，避免面板出现 "· · " 空档）
function normSeniority(sen) {
  const arr = Array.isArray(sen) ? sen : (sen ? [sen] : []);
  const map = [
    [/intern/i, '实习'],
    [/entry/i, '应届/入门'],
    [/junior/i, '初级'],
    [/mid/i, '1-3年'],
    [/senior/i, '3-5年'],
    [/staff|principal/i, '5年以上'],
    [/manager|director|c level/i, '管理岗']
  ];
  for (const s of arr) {
    for (const [re, label] of map) if (re.test(s)) return label;
  }
  return '经验不限';
}

function normRegion(locs, ctrys) {
  const loc = Array.isArray(locs) ? locs : [];
  const c = Array.isArray(ctrys) ? ctrys : [];
  let base = loc[0] || (c[0] || '');
  if (/remote/i.test(base)) base = '远程';
  return [base, c[0]].filter(Boolean).join(' · ');
}

function normalizeJob(j) {
  const salMinUsd = Number(j.salary_min_usd) || 0;
  const salMaxUsd = Number(j.salary_max_usd) || 0;
  return {
    title: String(j.title || '').trim(),
    regionId: normRegion(j.locations, j.countries),
    degree: normSeniority(j.seniority),
    salaryMin: salMinUsd ? salMinUsd * 1000 : 0,
    salaryMax: salMaxUsd ? salMaxUsd * 1000 : 0,
    keywords: Array.isArray(j.required_skills) ? j.required_skills.slice(0, 8).map(String) : [],
    source: 'JobDataLake'
  };
}

async function fetchFromApi() {
  const base = 'https://api.jobdatalake.com/v1/jobs';
  const headers = {};
  // 免费档无需密钥即可调用（每天 500 次）；配置 JDL_API_KEY / JOBDATA_API_KEY 可提升配额
  const apiKey = process.env.JDL_API_KEY || process.env.JOBDATA_API_KEY;
  if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
  const out = [];
  const perPage = 100;
  const maxPages = 2;
  for (let p = 1; p <= maxPages; p++) {
    const url = `${base}?per_page=${perPage}&page=${p}&remote_type=fully_remote`;
    try {
      const r = await fetch(url, { headers });
      if (!r.ok) { console.warn('[collect] API 返回 ' + r.status + '，停止翻页'); break; }
      const d = await r.json();
      const jobs = d.jobs || [];
      if (!jobs.length) break;
      for (const j of jobs) out.push(normalizeJob(j));
    } catch (e) {
      console.warn('[collect] 拉取异常：' + e.message);
      break;
    }
    if (out.length >= 200) break;
  }
  return out.length ? out : null;
}

async function main() {
  let jobs = await fetchFromApi();
  let fromApi = true;
  if (!jobs) {
    fromApi = false;
    const seed = readJSON(SEED);
    jobs = (seed.jobsRaw || []).map(function (j) {
      return {
        title: String(j.title || '').trim(),
        regionId: String(j.regionId || '').trim(),
        degree: String(j.degree || '').trim(),
        salaryMin: Math.max(0, parseInt(j.salaryMin, 10) || 0),
        salaryMax: Math.max(0, parseInt(j.salaryMax, 10) || 0),
        keywords: Array.isArray(j.keywords) ? j.keywords.map(String) : [],
        source: String(j.source || '').trim()
      };
    });
    console.log('[collect] API 不可用，回退到 seed.json（' + jobs.length + ' 条）');
  } else {
    console.log('[collect] 已从 JobDataLake 拉取 ' + jobs.length + ' 条');
  }

  const seen = new Set();
  const dedup = [];
  for (const j of jobs) {
    const k = `${j.title}|${j.regionId}|${j.degree}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(j);
  }

  const prev = fs.existsSync(OUT) ? readJSON(OUT) : null;
  const prevSig = prev ? JSON.stringify(prev.jobsRaw) : '';
  const newSig = JSON.stringify(dedup);

  if (prev && prevSig === newSig) {
    console.log('[collect] 数据无变化，跳过写盘（version 保持 ' + prev.version + '）。');
    return;
  }

  const version = prev ? bumpVersion(prev.version) : '2.2.0';
  const out = {
    version,
    updatedAt: new Date().toISOString().slice(0, 10),
    note: '由 collect.js 自动生成（来源：' + (fromApi ? 'JobDataLake 实时 API' : 'seed.json 兜底') + '），共 ' + dedup.length + ' 条。',
    jobsRaw: dedup
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('[collect] 已写入 jobs.json，version=' + version + '，条数=' + dedup.length);
}

main().catch(e => { console.error(e); process.exit(1); });
