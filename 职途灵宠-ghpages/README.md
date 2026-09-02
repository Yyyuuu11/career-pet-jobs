# 职途灵宠 · GitHub Pages 公网部署包

> **用途**：让"每周一 09:00 自动更新岗位/招聘数据"这个功能在**公网真实运行**，评委访问 `https://<用户名>.github.io/<仓库名>/` 即可看到每周刷新的数据。
> **成本**：**免费**。只需一个 GitHub 邮箱账号（QQ/163 邮箱均可），**不需要信用卡、不需要实名、不需要爬墙（VPN）**。
> **原理**：GitHub Pages 托管前端 + 静态 JSON 数据；GitHub Actions 每周一 09:00（北京时间）自动跑 `generate-data.js` 重新生成数据并推回仓库，Pages 自动重新发布。

---

## 一、目录结构（本文件夹即全部内容）

```
职途灵宠-ghpages/
├── index.html              # 前端（已改为读同目录静态 JSON，双击也能离线用）
├── generate-data.js        # 数据生成脚本（Actions 每周一调用）
├── market-data.json        # 招聘/技能词频数据（自动更新）
├── jobs-data.json          # 岗位数据（自动更新）
├── meta.json               # 元信息：lastUpdate / 覆盖省份（自动更新）
├── .github/workflows/weekly-update.yml   # Actions 定时任务（每周一 09:00）
└── README.md
```

---

## 二、你本地操作（5 步，约 10 分钟）

### 1. 注册 GitHub（免费）
打开 https://github.com → Sign up → 用邮箱注册（国内邮箱可注册）。**无需绑卡、无需实名**。

### 2. 新建仓库
右上角 ➕ → New repository → 仓库名随便（如 `career-pet`）→ 选 **Public**（Pages 免费版需公开仓库）→ Create。

### 3. 上传本文件夹全部内容
最简单：**网页拖拽上传**——进仓库 → Add file → Upload files → 把 `职途灵宠-ghpages/` 里**所有文件和 `.github` 文件夹**拖进去 → Commit。
（熟悉 git 也可 `git clone` 后 `git push`，结果一样。）

> ⚠️ 必须含隐藏文件夹 `.github`（定时任务配置），否则自动更新不会跑。

### 4. 开启 GitHub Pages
仓库 → Settings → Pages → Source 选 **Deploy from a branch** → Branch 选 **main**（或你的默认分支）→ 目录选 **/ (root)** → Save。
约 1 分钟后得到网址：`https://<用户名>.github.io/<仓库名>/`

### 5. 验证
浏览器打开上面网址，确认：
- 页面正常显示（岗位/技能热度有数据）
- 访问 `https://<用户名>.github.io/<仓库名>/meta.json`，能看到 `lastUpdate` 字段（即最近一次更新时间）

三者正常 = 部署成功。

---

## 三、自动更新怎么"看得见"

- **每周一 09:00（北京时间）**：Actions 自动运行，重新生成数据推回仓库，Pages 几分钟内自动刷新。评委下次打开看到的 `lastUpdate` 就是最近周一。
- **演示时当场证明（推荐）**：仓库 → Actions → 选 "每周自动更新岗位与招聘数据" → 右侧 **Run workflow** → 点一次。约 10 秒后 `meta.json` 的 `lastUpdate` 立即变成当前时间——这就是"自动更新在跑"的现场证据，评委看得到。
- 也可在答辩稿写："数据更新时间见页面底部 `数据源：线上自动更新 · 最近更新 …`，由 GitHub Actions 于每周一 09:00 自动执行。"

---

## 四、接真实数据（可选）

默认是**内置样本**，自动更新机制照常每周跑。要真实数据：
- 准备两个返回指定结构的 JSON 接口：
  - `RECRUIT_SOURCE` → 返回 `{current:{词:频次}, jobs:[...], adjustments:[...], stats:{...}}`
  - `JOBS_SOURCE` → 返回 `{jobs:[{title,degree,salaryMin,salaryMax,keywords,region,...}]}`
- 在 Actions 的 workflow 文件里加 `env:` 设这两个变量，或在仓库 Settings → Secrets/Variables 设。
- 抓取失败自动回退内置样本，**保证每周更新永不空**。

---

## 五、注意事项

| 项 | 说明 |
|----|------|
| 访问速度 | `*.github.io` 国内多数能开，偶尔抽风变慢（比纯海外节点稳）。演示前自己先点开一次预热 |
| 备案 | 默认 `*.github.io` 子域名**免 ICP 备案**即可访问；若绑自己域名才需备案 |
| 免费额度 | Actions 每月 2000 分钟免费，每周跑一次消耗量极小，比赛期完全够 |
| 休眠 | 纯静态 Pages **无休眠**，评委随时能开；只有 Actions 在调度时间点才运行 |
| 离线兜底 | 评委若断网/`file://` 双击打开，前端自动回退内置样本，岗位与技能热度照常显示 |

---

## 六、与 LeanCloud 方案对比（已弃用）

LeanCloud 于 2026 年停止新账号注册，故改用本方案。本方案更省（免费、免实名、免绑卡）、更适合国内评委访问，且自动更新由平台级 Actions 兜底，**不受实例休眠影响**（LeanCloud 免费版休眠会导致周一漏跑，本方案无此问题）。
