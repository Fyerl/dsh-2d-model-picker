<div align="center">

<img src="https://raw.githubusercontent.com/Fyerl/dsh-2d-model-picker/main/icon.png" width="160" alt="2D Model Picker logo" />

# 2D Model Picker

**A DeepSeek Harness plugin: pick a model and its reasoning effort in one drag.**

**English** · [简体中文](https://github.com/Fyerl/dsh-2d-model-picker/blob/main/README-zh-CN.md)

![License](https://img.shields.io/badge/license-MIT-blue)
[![npm](https://img.shields.io/npm/v/dsh-2d-model-picker)](https://www.npmjs.com/package/dsh-2d-model-picker)
[![GitHub stars](https://img.shields.io/github/stars/Fyerl/dsh-2d-model-picker?style=social)](https://github.com/Fyerl/dsh-2d-model-picker/stargazers)

</div>

## Demo

https://github.com/user-attachments/assets/a0451182-e4ae-4080-9b84-a0ab2c474feb

## Quick start

In DSH, open **Plugins → Add plugin** and enter:

```text
dsh-2d-model-picker
```

Or use the CLI for the **Web profile**:

```bash
dsh plugin --profile web add dsh-2d-model-picker
```

For Discover, enable **Custom plugin indexes** under **Experimental plugins**, then add [this index](https://raw.githubusercontent.com/Fyerl/dsh-2d-model-picker/main/docs/index.json) in **Plugins → Discover**.

## What is 2D Model Picker?

2D Model Picker is a DeepSeek Harness plugin that replaces the native model picker with a two-dimensional grid: **rows are models, columns are reasoning-effort tiers**. Drag to a supported combination and release to apply it.

---

[Contributing](https://github.com/Fyerl/dsh-2d-model-picker/blob/main/CONTRIBUTING.md) · [MIT License](https://github.com/Fyerl/dsh-2d-model-picker/blob/main/LICENSE)
