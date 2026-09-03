# 职途灵宠 · 招聘数据自动更新（数据源仓库 · 扁平版）

这个仓库是「职途灵宠」桌面端/网页端**自动拉取招聘数据**的数据源。你更新这里的 `jobs.json`，所有学生的灵宠「招聘数据」面板就会定期自动更新——**不用重新打包分发软件**。

> 安全：本仓库只放公开的岗位名称、地区、薪资、技能等招聘信息，**不涉及任何用户隐私**。用户数据始终只在学生自己电脑本地。

---

## 文件布局（扁平版，全部在仓库根目录）

| 文件 | 作用 |
|------|------|
| `domestic_seed.json` | **国内岗位样本**（默认数据源）：覆盖 31 个大陆省级行政区 × 学校各专业，每个专业类别在每个省份至少有 1 条岗位；含省份、人民币薪资、按专业类别对齐的技能关键词，共约 1000 条 |
| `seed.json` | 兜底种子（手动整理的 Demo 岗位，66 条）。仅在 `domestic_seed.json` 缺失时回退使用，保证仓库不空 |
| `jobs.json` | `collect.js` 生成的最终数据，前端实际拉取的就是它（`{version, updatedAt, jobsRaw}`，当前 v2.4.0，约 1020 条国内岗位） |
| `collect.js` | 采集+清洗+版本自增脚本。**默认国内模式**（读取 `domestic_seed.json`）；配置 `JDL_API_KEY` 且 `DATA_MODE=international` 时改拉 JobDataLake 国际 API |
| `.github/workflows/update-jobs.yml` | 每周一 09:00 UTC 自动跑 `collect.js` 并提交（环境变量 `DATA_MODE: domestic`） |
| `README.md` | 本说明 |

字段与前端对齐（`JOBS_RAW`）：`title` / `regionId` / `degree` / `salaryMin` / `salaryMax` / `keywords` / `source`。

---

## 你只需要做 3 步（纯网页操作，不用装 git）

### 步骤 1：新建一个 GitHub 仓库
1. 登录 GitHub → 右上角 **+** → **New repository**。
2. 仓库名填 `career-pet-jobs`（必须**公开 Public**）。
3. 其它默认，点 **Create repository**。

### 步骤 2：把本包里的文件上传进去
1. 进入空仓库 → **Add file → Upload files**（或直接把文件拖进浏览器）。
2. 把本包里的这些文件**全部拖到根目录**上传：
   - `collect.js`
   - `domestic_seed.json`
   - `seed.json`
   - `jobs.json`
   - `.github/workflows/update-jobs.yml`
   - `README.md`
3. 页面底部写提交说明（如「初始化招聘数据源」），点 **Commit changes**。

### 步骤 3：在桌面灵宠里填上你的仓库
1. 打开「职途灵宠」桌面版 v1.9.10+ → 右键点击**灵宠本体**（或系统托盘小图标）。
2. 找到 **📡 招聘数据同步（未配置）** → 点 **配置数据源…**。
3. 填：
   - **GitHub 用户名**：你的 GitHub 用户名
   - **仓库名**：`career-pet-jobs`
   - **分支**：`main`
4. 点 **保存** → 自动「立即同步一次」。

完成！之后桌面端每 6 小时自动拉一次最新招聘数据；网页端（部署在服务器上时）打开即拉取。

---

## 以后怎么更新招聘数据

**方式 A：每周自动（推荐，零操作）**
仓库里的 `.github/workflows/update-jobs.yml` 已配置：**每周一 09:00 UTC**（北京时间约 17:00）自动运行 `node collect.js` 并重新生成 `jobs.json` 提交。

**默认国内模式（已按目标市场配置）**：`collect.js` 默认读取 `domestic_seed.json` —— 一份覆盖学校各专业 + 多省份的**国内招聘岗位样本**（中文标题、省份、人民币薪资、技能关键词按专业类别对齐，约 149 条），整理成前端可直接消费的 `jobs.json`。面向国内市场，学生打开灵宠后「最新招聘信息」面板会**按所选专业 + 意向就业地自动筛选**对口岗位。

**可选国际模式**：如需拉真实国际在招岗位，在仓库 **Settings → Secrets → Actions** 里加 `JDL_API_KEY`（JobDataLake 免费 API 密钥，可选），并把 workflow 的 `DATA_MODE` 改为 `international`。`collect.js` 会调用 `https://api.jobdatalake.com/v1/jobs` 拉取真实在招岗位（免费档每天 500 次，足够每周跑）。

- 拉取失败时自动回退到 `seed.json` / `domestic_seed.json`，保证仓库不空。

**方式 B：手动改数据**
如需人工干预，可编辑 `seed.json`（兜底用）；或直接点击 GitHub Actions 页面里的 **Run workflow** 手动触发；或在本地运行：
```bash
node collect.js
git add jobs.json && git commit -m "更新招聘数据" && git push
```
`collect.js` 会自动**只在新数据不同于旧数据时才自增版本号并提交**，避免空提交。

---

## 常见问题

- **更新后灵宠多久生效？** 桌面端每 6 小时拉一次；你也可以右键灵宠 → 立即同步一次。jsDelivr CDN 有缓存，通常几分钟内、最迟约 12 小时全量生效。
- **拉不到数据？** 检查：① 仓库是 Public；② 用户名/仓库名填对；③ `jobs.json` 已上传到根目录。右键灵宠 → 立即同步一次会弹 Windows 通知告诉你结果。
- **断网了？** 桌面端会把上一次拉到的数据缓存到本地，断网也能用最近一份。
- **会不会把旧数据搞乱？** 不会。页面只在远程 `version` 比内置 `2.0.0` **新**时才覆盖，绝不降级。
- **可以放 `data/jobs.json` 而不是根目录吗？** 可以。桌面端 v1.9.9+ 会同时尝试 `/data/jobs.json` 和根目录 `/jobs.json` 两个路径，两种布局都兼容。
