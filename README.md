# 职途灵宠 · 招聘数据自动更新（数据源仓库）

这个仓库是「职途灵宠」桌面端/网页端**自动拉取招聘数据**的数据源。你（或 GitHub Actions）只要更新这里的 `data/jobs.json`，所有学生的灵宠「招聘数据」面板就会定期自动更新——**不用重新打包分发软件**。

> 安全：本仓库只放公开的岗位名称、地区、薪资、技能等招聘信息，**不涉及任何用户隐私**。用户数据始终只在学生自己电脑本地。

---

## 一、你只需要做 3 步（纯网页操作，不用装 git）

### 步骤 1：新建一个 GitHub 仓库
1. 登录 GitHub → 右上角 **+** → **New repository**。
2. 仓库名填 `career-pet-jobs`（必须**公开 Public**，否则 jsDelivr 拉不到）。
3. 其它默认，点 **Create repository**。

### 步骤 2：把本包里的文件上传进去
1. 进入你刚建的空仓库，点 **Add file → Upload files**（或直接把文件拖进浏览器）。
2. 把本包里的这些**文件夹和文件**全部拖进去：
   - `data/` （里面有 `seed.json` 和 `jobs.json`）
   - `scripts/` （里面有 `collect.js`）
   - `.github/` （里面有 `workflows/update-jobs.yml`）
3. 页面底部填个提交说明（如「初始化招聘数据源」），点 **Commit changes**。

### 步骤 3：在桌面灵宠里填上你的仓库
1. 打开「职途灵宠」桌面版 → 右键点击系统托盘的小图标（或任务栏图标）。
2. 找到 **📡 招聘数据同步（未配置）** → 点 **配置数据源…**。
3. 填：
   - **GitHub 用户名**：填你自己的 GitHub 用户名
   - **仓库名**：`career-pet-jobs`
   - **分支**：`main`
4. 点 **保存** → 自动「立即同步一次」。托盘菜单会变成「（已配置）」。

完成！之后桌面端每 6 小时自动拉一次最新招聘数据；网页端（部署在服务器上时）打开即拉取。

---

## 二、以后怎么更新招聘数据

**方式 A：每周自动（推荐，零操作）**
仓库里的 `.github/workflows/update-jobs.yml` 已经配置好：**每周一 09:00 UTC** 自动运行 `scripts/collect.js` 并重新生成 `data/jobs.json` 提交。
- 当前 `collect.js` 默认读取 `data/seed.json`（你手动整理的 Demo 真实岗位）。
- 想接真实招聘 API：在仓库 **Settings → Secrets → Actions** 里加一个 `JOBDATA_API_KEY`，并在 `scripts/collect.js` 的 `fetchFromApi()` 里补上对应 API 的字段映射即可（脚本已留好占位与注释）。

**方式 B：手动改数据**
直接编辑 `data/seed.json`（加上/修改岗位），然后在本地运行：
```bash
node scripts/collect.js
git add data/jobs.json && git commit -m "更新招聘数据" && git push
```
`collect.js` 会自动**只在新数据不同于旧数据时才自增版本号并提交**，避免空提交。

---

## 三、常见问题

- **更新后灵宠多久生效？** 桌面端每 6 小时拉一次；你也可以托盘里点「立即同步一次」立刻生效。jsDelivr CDN 有缓存，新数据通常几分钟内、最迟约 12 小时全量生效。
- **拉不到数据？** 检查：① 仓库是 Public；② 仓库名/用户名填对；③ `data/jobs.json` 确实存在（步骤 2 已上传）。托盘「立即同步一次」会弹 Windows 通知告诉你结果。
- **断网了？** 桌面端会把上一次拉到的数据缓存到本地，断网也能用最近一份。
- **会不会把旧数据搞乱？** 不会。页面只在远程 `version` 比内置 `2.0.0` **新**时才覆盖，绝不降级。

---

## 四、文件说明

| 文件 | 作用 |
|------|------|
| `data/seed.json` | 手动整理的招聘数据种子（Demo 真实岗位，66 条，跨广西/广东/湖北，含电气/自动化/农业类） |
| `data/jobs.json` | `collect.js` 生成的最终数据，前端实际拉取的就是它（`{version, updatedAt, jobsRaw}`） |
| `scripts/collect.js` | 采集+清洗+版本自增脚本（可接 API，留好占位） |
| `.github/workflows/update-jobs.yml` | 每周一自动采集并提交 |

字段与前端对齐（`JOBS_RAW`）：`title` / `regionId` / `degree` / `salaryMin` / `salaryMax` / `keywords` / `source`。
