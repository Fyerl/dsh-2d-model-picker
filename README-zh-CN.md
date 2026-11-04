<div align="center">

<img src="https://raw.githubusercontent.com/Fyerl/dsh-2d-model-picker/main/icon.png" width="160" alt="二维模型选择器 logo" />

# 二维模型选择器

**一次拖动，同时选定模型与推理强度。**

[English](https://github.com/Fyerl/dsh-2d-model-picker/blob/main/README.md) · **简体中文**

![License](https://img.shields.io/badge/license-MIT-blue)
![GitHub stars](https://img.shields.io/github/stars/Fyerl/dsh-2d-model-picker?style=social)

</div>

## 演示

https://github.com/user-attachments/assets/a0451182-e4ae-4080-9b84-a0ab2c474feb

## 快速接入

在 DSH 中打开 **插件 → 添加插件**，输入：

```text
dsh-2d-model-picker
```

也可以通过 CLI 安装到 **Web profile**：

```bash
dsh plugin --profile web add dsh-2d-model-picker
```

使用「发现」页时，先在 **实验性插件** 中启用 **自定义插件索引**，再到 **插件 → 发现** 添加[此索引](https://raw.githubusercontent.com/Fyerl/dsh-2d-model-picker/main/docs/index.json)。

## 二维模型选择器是什么？

二维模型选择器是一个 DeepSeek Harness 插件，将原生模型选择器替换为二维网格：**行是模型，列是推理强度档位**。拖动到支持的组合，松手即可确认。

---

[参与贡献](https://github.com/Fyerl/dsh-2d-model-picker/blob/main/CONTRIBUTING.md) · [MIT 许可证](https://github.com/Fyerl/dsh-2d-model-picker/blob/main/LICENSE)
