<div align="center">

<img src="./icon.png" width="160" alt="二维模型选择器 logo" />

# 二维模型选择器

**一次拖动，同时选定模型与推理强度。**

[English](./README.md) · **简体中文**

![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/Fyerl/dsh-2d-model-picker?style=social)

</div>

## 演示

[![二维模型选择器演示：拖动滑点选择模型与推理强度](./docs/assets/demo.gif)](./docs/assets/demo.mp4)

[观看原始视频（MP4）](./docs/assets/demo.mp4)

## 快速接入

通过 DSH CLI 安装：

```bash
dsh plugin add dsh-2d-model-picker
```

也可以通过插件市场安装。在 **设置 → 插件 → 发现 → 索引来源** 中添加：

```text
https://raw.githubusercontent.com/Fyerl/dsh-2d-model-picker/main/docs/index.json
```

## 二维模型选择器是什么？

二维模型选择器是一个 DeepSeek Harness 插件，将原生模型选择器替换为二维网格：**行是模型，列是推理强度档位**。拖动到支持的组合，松手即可确认。

---

[参与贡献](./CONTRIBUTING.md) · [MIT 许可证](./LICENSE)
