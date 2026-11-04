# Contributing

感谢你对 `dsh-model-matrix` 的关注。

## 提 Issue

- **Bug**：请附上 DSH 版本、操作系统、复现步骤和期望行为。
- **Feature**：说清使用场景和它带来的价值，而不是只描述实现。

## 本地开发

本插件无构建步骤，`client.js` 为经典脚本，直接改即可。

```bash
git clone https://github.com/Fyerl/dsh-model-matrix.git
cd dsh-model-matrix
node --check client.js          # 语法校验
node -e "import('./index.js')"  # 入口校验
dsh plugin add .                # 本地安装到某个 profile 验证
```

## 提 PR

- 一个 PR 只做一件事。
- 同步更新 `CHANGELOG.md`。
- 确认 `node --check client.js` 与 JSON 校验通过（CI 也会跑）。
