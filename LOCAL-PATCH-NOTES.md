# Local patch: bash tool description (brush semantics)

> 本仓库是本地 fork（TonyDua/oh-my-pi），含一个未提 PR 的本地补丁。
> 目的：升级 omp 后，agent 扫本仓库目录，按本文件恢复补丁。

## 改了什么

- `packages/coding-agent/src/prompts/tools/bash.md` — bash 工具描述模板（commit `79c48efaa`）
  - 开头从 "Runs commands in a persistent shell." 改为
    "Runs commands in the embedded `brush` shell — a Rust bash-compatible shell
    (not the host bash; session per call, retained only while background jobs run)."
  - Windows 分支（`{{#if isWindows}}`）新增 4 条：
    1. 路径用 `C:/…` 或 `~/…`；`/c/…`、`/mnt/c/…` 只在 cd 等内置命令有效，外部命令失败
    2. `$env:NAME` 受保护，逐字透传（双引号内也安全）
    3. 调子解释器（PowerShell 等）外层用单引号包，内层用双引号
    4. 非 ASCII 输出乱码 → 诊断输出保持 ASCII/英文

## 为什么

omp 的 bash 工具是内嵌 brush-core（Rust 实现，reubeno/brush 移植），不是宿主 bash。
原描述按"宿主 bash + persistent shell"误导模型，导致 Windows 上反复踩坑：
路径 `/c/…` 失效、双引号内 `$_` 被展开、`$env:` 被吃、中文乱码。
补丁让模型在 system prompt 里一次拿到正确契约。

## 怎么恢复（升级 omp 后执行）

```sh
node scripts/restore-bash-description.mjs
```

脚本幂等（dist 已打补丁时跳过），作用：

1. 复制 `packages/coding-agent/src/prompts/tools/bash.md` →
   `~/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/prompts/tools/bash.md`
2. 替换 `dist/cli.js` 里的内联模板（单引号 JS 字符串，`\n`/`\u2026`/`\u2192` 转义形式）

然后重启 omp，新会话生效（system prompt 中 bash 工具描述第一行应出现
"Runs commands in the embedded `brush` shell"）。

## 验证基线

- `bun build dist/cli.js` 解析通过；`omp --version` 正常
- 新会话 system prompt 出现新描述（Windows 分支含路径/引号/`$env`/ASCII 四条）
- POSIX 渲染无 Windows 行泄漏

## 备注

- 升级（`omp update` / `bun install -g`）会覆盖 node_modules 中的补丁；核心包更新是手动触发，无后台自动安装
- 实验完成后应把此补丁提 PR 到上游（can1357/oh-my-pi），合并发版后本补丁退役
- 本补丁的由来、用户批评与工作原则（B/A 决策、契约 vs 实现、规则三要素等）见同目录 `AGENT-FEEDBACK.md`
