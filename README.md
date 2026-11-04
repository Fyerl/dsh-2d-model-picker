# 模型矩阵 · Model Matrix

> 用二维矩阵替换 DeepSeek Harness 的模型选择器：**行是模型，列是推理强度档位**，拖动滑点吸附到交叉点，松手即确认「模型 + 智能度」组合。

Replaces the DeepSeek Harness model selector with a two-dimensional grid:
**rows are models, columns are reasoning-effort tiers**. Drag the puck to an
intersection and release to confirm a **model + intelligence** combo.

## 特性 / Features

- **二维矩阵**：模型（纵轴）× 推理强度（横轴）一屏选完。
- **拖动即选**：滑点跟手、松手确认，带吸附预览；也支持键盘（←→↑↓ 移动、Enter/空格 确认、Esc 关闭）。
- **智能排序**：模型按能力自动从上到下排，列是所有模型的推理档位并集。
- **真实数据**：读 `modelSelection` / `modelCatalog`，写 `remote.session.selectModel`。
- **细节打磨**：MAX 档渐变 + 光晕 + 粒子动效（尊重 `prefers-reduced-motion`），深浅色主题自适应。

## 安装 / Install

```bash
dsh plugin add dsh-model-matrix
```

或经插件市场「发现」页一键安装（见下方索引地址）。

## 使用 / Usage

1. 打开对话输入框，点击模型选择器位置。
2. 在矩阵里拖动滑点到目标交叉点。
3. 松手即完成「模型 + 推理强度」切换。

## 市场索引 / Market index

本仓库根目录的 [`index.json`](./index.json) 是一份 DSH 插件市场索引（format 1）。
用 GitHub Pages 托管本仓库后，把下面地址填进 DSH「设置 → 插件 → 发现 → 索引来源」：

```
https://Fyerl.github.io/dsh-model-matrix/index.json
```

## 发布 / Publishing

1. 改版本：`npm version patch|minor|major`
2. 发 npm：`npm publish`（包名 `dsh-model-matrix`）
3. 更新 `index.json` 里的 `version` 与 `publishTimestamp`，推送后市场即可见新版。

## License

[MIT](./LICENSE)
