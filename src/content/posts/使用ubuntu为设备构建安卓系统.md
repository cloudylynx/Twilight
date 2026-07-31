---
title: 使用Ubuntu为设备构建安卓系统
published: 2026-07-31T20:03:00.000+08:00
cover: banner.webp
tags:
  - Xiaomi MIX3
category: AndroidROM
draft: false
---
# Android 源码编译环境搭建教程

## 前言

之前在 KVM 虚拟机编译安卓，但是由于 QEMU 虚拟磁盘的特性，最终磁盘文件大小已经大于设置的磁盘文件的最大容量，然后盘就满了。

KVM 虚拟机就直接暂停了，也没法使用其他 Linux 的 LiveCD，一挂载也会暂停。

使用各种办法挽救，速度忒慢，索性直接重建环境，比那些操作快，毕竟没什么重要文件。



---

## 环境介绍

- 系统：Ubuntu 24.04 LTS
- 示例系统源码：AviumUI 16.2 (Android 16)

---

## 更换源与更新系统

此处默认已进行更换，如果没有，更换源在镜像站一般都有教程。

推荐两个：**[清华源](https://mirrors.tuna.tsinghua.edu.cn/)** 和 **[中科大源](https://mirrors.ustc.edu.cn/)**。

### 更新系统

```bash
sudo apt update && sudo apt upgrade
```

---

## 安装依赖

基础列表来自 [安卓官方文档1](https://source.android.google.cn/docs/setup/start/requirements?hl=zh-cn#installing-required-packages-ubuntu-1804) 和 [安卓官方文档2](https://source.android.google.cn/docs/setup/start/requirements?hl=zh-cn#installing-the-jdk)。

### 所做修改

- 修正找不到包的问题：`git-core` / `libncurses5` / `lib32ncurses5-dev` 已不可用，替换为 `git` / `libncurses6` / `lib32ncurses-dev`
- `repo` 同步工具：源里已有，不需手动设置 PATH。deb 系更新较慢，会报版本不是最新的警告，可忽略
- `ccache`：在 `build/envsetup.sh` 未定义或未手动启用时不会自动开启，参考类原生编译脚本带了它
- `libssl-dev`：解决编译内核时提示 `<openssl/bio.h>` 缺失的问题
- `git-lfs`：部分仓库需要用到，缺少可能导致同步的文件显示 LFS 指针而非本体文件

### 安装命令

```bash
sudo apt install git gnupg flex bison build-essential zip curl \
  zlib1g-dev libc6-dev-i386 libncurses6 lib32ncurses-dev \
  x11proto-core-dev libx11-dev lib32z1-dev libgl1-mesa-dev \
  libxml2-utils xsltproc unzip fontconfig libssl-dev \
  openjdk-8-jdk repo ccache git-lfs libelf-dev rsync
```

---

## 设置 Git 信息

源码同步会提示要求设置 Git 的信息，直接设置即可：

```bash
git config --global user.email "你的 GITHUB 邮箱（或其他）"
git config --global user.name  "你的 GITHUB 用户名（或其他）"
```

---

## 初始化 Repo 同步清单

### 创建源码目录

```bash
mkdir android && cd android
```

### 设置 Repo 下载地址

替换默认被墙的 Google 源，使用清华大学 git-repo 镜像：

```bash
export REPO_URL='https://mirrors.tuna.tsinghua.edu.cn/git/git-repo'
```

### 初始化 Repo

以 AviumUI 为例，清单地址前加上 `https://gh-proxy.com/` 使用国内加速，结尾 `--depth=1` 减少空间占用：

```bash
repo init -u https://gh-proxy.com/https://github.com/AviumUI/android_manifests \
  -b avium-16.2 --git-lfs --depth=1
```

如果是 AOSP 官方源码或 LineageOS 源码，可以使用国内镜像源，教程参考 [清华源文档](https://mirrors.tuna.tsinghua.edu.cn/help/AOSP/)。

可用的源推荐清华源和中科大源，不同之处就是替换 URL 的问题。

---

## 修改清单指向加速源

使用你喜欢的编辑器编辑 `.repo/manifests` 文件夹，依次编辑 `default.xml` 和存在的其他 `.xml` 文件：

- 对于 `https://github.com` 的链接，在最前面加上 `https://gh-proxy.com/`
- 对于 `https://android.googlesource.com` 的链接，更换为 AOSP 镜像源所要求的 URL

### 示例

```xml
<remote name="aosp"
        fetch="https://mirrors.ustc.edu.cn/aosp" />

...

<remote name="avium"
        fetch="https://gh-proxy.com/https://github.com/AviumUI/"
        sync-c="true"
        sync-j="4"
        revision="refs/heads/avium-16" />
```

---

## 同步源码

以下为 AviumUI 的同步命令：

```bash
repo sync -c -j$(nproc --all) --force-sync --no-clone-bundle --no-tags
```

> **⚠️ 注意**
>
> 由于硬盘 I/O 资源有限，Git 服务器每 IP 限制 5 个并发连接。`repo sync` 默认使用 4 个并发连接，请勿使用 `-j` 参数增加并发连接数。

### 自动重试脚本

如果网络不稳定容易失败，可使用以下脚本自动重试直到同步成功或手动退出：

```bash
#!/bin/bash

echo "====== start repo sync ======"

# 执行 repo sync 命令
repo sync

# 使用 while 循环检查命令的退出状态
while [ $? -eq 1 ]; do
    echo "====== sync failed, re-sync again ======"
    sleep 3
    repo sync
done
```

使用方法：

```bash
# 保存为 repo_sync.sh
chmod +x repo_sync.sh
./repo_sync.sh
```

---

## 获取设备树文件

> **注：** 此部分内容为 2025-12-08 追加。

什么是设备树？设备树即描述设备情况的一系列文件，包括平台配置、内核、专有驱动等，用于告诉 Android 构建系统有哪些要求、应该使用什么。

由于 AviumUI 完全兼容 LineageOS 的设备树，这里以 LineageOS 设备树作为演示。

> **Tips：** 设备树仓库一般以一定规律命名，如 `android_device_(oem)_(product)`。

### 设备描述 (device)

以**小米 Mix 3** 为例，设备厂商为 xiaomi，代号为 perseus：

1. 打开 [LineageOS 组织仓库](https://github.com/LineageOS)，搜索 `perseus`
2. 找到代码仓库 `android_device_xiaomi_perseus`
3. 复制仓库链接，克隆到源码目录：

```bash
git clone https://github.com/LineageOS/android_device_xiaomi_perseus \
  device/xiaomi/perseus
```

4. 进入目录，打开 `lineage.dependencies`，查看需要获取的其他设备树文件
5. 按相同方式克隆，如 `sdm845-common`：

```bash
git clone https://github.com/LineageOS/android_device_xiaomi_sdm845-common \
  device/xiaomi/sdm845-common
```

### 内核 (Kernel)

从 `lineage.dependencies` 中查看，获取 kernel 源码。因为内核提交信息非常多，可加 `--depth=1` 减少下载量：

```bash
git clone https://github.com/duckyduckG/android_kernel_xiaomi_sdm845_419 \
  kernel/xiaomi/sdm845 --depth=1
```

> **ℹ️ 注意**
>
> 如果你所使用的内核包含 KernelSU 且将 KernelSU 作为子模块，请务必在克隆内核后初始化 KernelSU：
>
> ```bash
> git submodule init
> git submodule update
> ```

### 厂商私有文件 (vendor)

LineageOS 组织没有 vendor 内容。翻阅 LineageOS Wiki 会要求从设备提取，但实际上 vendor 内容保存在 [TheMuppets](https://github.com/TheMuppets)，其中包含了 LineageOS 维护的设备的 vendor 文件。

### 硬件特性 (hardware)

都在 LineageOS 仓库，具体参考 `lineage.dependencies`。以小米 Mix 3 为例，需要 `android_hardware_xiaomi`：

```bash
git clone https://github.com/LineageOS/android_hardware_xiaomi hardware/xiaomi
```

---

## 初始化编译

### 1. 确保使用 bash

```bash
# 如非 bash，请手动切换
bash
```

### 2. 加载编译环境

```bash
source build/envsetup.sh
```

### 3. 选择编译目标

```bash
lunch lineage_perseus-bp2a-user
```

参数说明：
- `user`：构建类型
- `bp2a`：代表 Android 16 初始版本 (QPR0)
- `lineage_perseus`：目标名称，定义在 `device/xiaomi/perseus/lineage_perseus.mk`

### 4. 开始编译

```bash
make bacon
```
