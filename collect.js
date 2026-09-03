#!/usr/bin/env node
/**
 * 职途灵宠 · 招聘数据采集脚本
 * ------------------------------------------------------------
 * 作用：把「招聘原始数据」整理成前端可直接消费的 jobs.json。
 *   - 默认：读取 data/seed.json（手动整理的 Demo 真实岗位）。
 *   - 进阶：若设置环境变量 JOBDATA_API_KEY，可接入免费招聘 API（见底部 fetchFromApi 占位）。
 * 输出：data/jobs.json，结构 { version, updatedAt, jobsRaw:[...] }
 *   - 仅当数据与上次不同才自增 version 并写盘（避免 GitHub Actions 每周空提交）。
 *
 * 前端合并逻辑：页面读取 jobs.json.jobsRaw，替换内置 CAREER_PET_DATA.jobsRaw
 * （version 比内置 2.0.0 新才生效，绝不降级）。
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SEED = path.join(ROOT, 'data', 'seed.json');
const OUT = path.join(ROOT, 'data', 'jobs.json');

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function bumpVersion(v) {
  // "2.0.0" -> "2.1.0"（次版本递增）；非法输入从 2.1.0 起
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v || '');
  if (!m) return '2.1.0';
  const major = +m[1], minor = +m[2] + 1, patch = +m[3];
  return `${major}.${minor}.${patch}`;
}

function normalizeJob(j) {
  // 字段对齐前端 JOBS_RAW：title/regionId/degree/salaryMin/salaryMax/keywords/source
  return {
    title: String(j.title || '').trim(),
    regionId: String(j.regionId || '').trim(),
    degree: String(j.degree || '').trim(),
    salaryMin: Math.max(0, parseInt(j.salaryMin, 10) || 0),
    salaryMax: Math.max(0, parseInt(j.salaryMax, 10) || 0),
    keywords: Array.isArray(j.keywords) ? j.keywords.map(String) : [],
    source: String(j.source || '').trim()
  };
}

// —— 进阶：接入免费招聘 API（可选）。当前为占位，配置 JOBDATA_API_KEY 后实现解析即可 ——
async function fetchFromApi() {
  if (!process.env.JOBDATA_API_KEY) return null;
  // 示例（伪代码，按你选用的 API 调整）：
  // const res = await fetch('https://api.example.com/jobs?key=' + process.env.JOBDATA_API_KEY);
  // const raw = await res.json();
  // return raw.map(mapApiRowToJob);
  console.log('[collect] 检测到 JOBDATA_API_KEY，但 fetchFromApi 尚未实现具体 API 映射，回退到 seed。');
  return null;
}

async function main() {
  let jobs = await fetchFromApi();
  if (!jobs) {
    const seed = readJSON(SEED);
    jobs = (seed.jobsRaw || []).map(normalizeJob);
  }
  // 去重（同 title+region+degree 保留一条）
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

  const version = prev ? bumpVersion(prev.version) : '2.1.0';
  const out = {
    version,
    updatedAt: new Date().toISOString().slice(0, 10),
    note: '由 collect.js 生成。job 总数 ' + dedup.length + '。',
    jobsRaw: dedup
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('[collect] 已写入 data/jobs.json，version=' + version + '，条数=' + dedup.length);
}

main().catch(e => { console.error(e); process.exit(1); });
