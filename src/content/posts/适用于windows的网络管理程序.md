---
title: 适用于windows的网络管理程序
published: 2026-07-31T18:20:00.000+08:00
updated: ""
description: "    一个基于 Avalonia UI + .NET 8 的 Windows 网络管理器，使用 Windows Filtering
  Platform 和 IP Helper API 实现进程级网络流量监控与联网权限控制。Material Design 3
  风格界面、深色/浅色主题切换，可编译为单文件 exe。"
cover: 微信图片_20260731194349_23_8.png
tags:
  - Widows
category: WindowsAPP
draft: false
---
# Windows Network Manager



---

## 概览

Windows Network Manager 是一个现代化的 Windows 桌面工具，用于实时监控所有运行进程的网络活动，并通过 Windows 防火墙 API 精细控制每个进程的联网权限。

### 核心功能

- **进程树** — WMI 查询父子关系，树状展示所有进程及子进程，默认折叠，点击展开
- **实时流量** — 全局网络带宽 + TCP/UDP 连接数按比例分配，显示每个进程的上下行速度与累计流量
- **防火墙控制** — 5 级联网权限：🚫临时禁止 / ♾永久禁止 / ⬆仅上传 / ⬇仅下载 / ✅允许全部
- **4 种排序** — 上传速度 ↓ / 下载速度 ↓ / 上传总量 ↓ / 下载总量 ↓
- **进程图标** — `System.Drawing` 提取 exe 原生图标
- **Hosts 编辑器** — 一键打开系统 hosts 文件
- **Material Design 3** — 完整的 M3 色彩 Token 系统、组件样式、深色/浅色切换动画
- **单文件 exe** — `dotnet publish -p:PublishSingleFile=true` 打包为独立可执行文件

---

## 截图

| 亮色主题 | 暗色主题 |
|:---:|:---:|
| *(运行截图)* | *(运行截图)* |

---

## 系统要求

| 项目 | 说明 |
|------|------|
| 操作系统 | Windows 10 / 11 (64-bit) |
| 运行时 | .NET 8 (已自包含在 exe 中，无需安装) |
| 权限 | **管理员权限**（防火墙操作 + WMI 查询需要） |

---

## 快速开始

### 下载运行

从 `publish/` 目录获取 `WindowsNetworkManager.exe`（约 44MB），右键 **以管理员身份运行**。

### 编译

```bash
# Linux（交叉编译为 Windows exe）
./build.sh

# Windows
BuildAndPublish.bat

# 手动
dotnet publish src/WindowsNetworkManager.csproj \
    -c Release -r win-x64 --self-contained true \
    -p:PublishSingleFile=true -o publish
```

---

## 技术栈

| 层 | 技术 |
|----|------|
| UI | Avalonia UI 11.1 + FluentTheme + 自定义 M3 样式 |
| MVVM | 手动实现 INotifyPropertyChanged + RelayCommand |
| 进程枚举 | WMI `Win32_Process` + `System.Diagnostics.Process` |
| 网络监控 | `NetworkInterface.GetIPv4Statistics()` + `GetExtendedTcpTable` (IPv4/IPv6) |
| 防火墙 | Windows Firewall COM API (`INetFwRule`) |
| 图标提取 | `System.Drawing.Common` `Icon.ExtractAssociatedIcon` |
| 打包 | `dotnet publish` Single File + SelfContained |

---

## 项目结构

```
WindowsNetworkManager/
├── build.sh / BuildAndPublish.bat
├── README.md / DEVLOG.md
├── publish/
│   └── WindowsNetworkManager.exe       # 单文件输出
└── src/
    ├── WindowsNetworkManager.csproj     # .NET 8 + Avalonia
    ├── app.manifest                     # requireAdministrator
    ├── Program.cs                       # 入口
    ├── App.axaml / .axaml.cs            # M3 色彩 Token + 主题切换
    ├── MainWindow.axaml / .axaml.cs     # M3 主界面 + 动画
    ├── Models/
    │   └── Models.cs                    # AppProcessInfo, NetworkPermission, SortMode
    ├── Native/
    │   ├── IpHelper.cs                  # IP Helper P/Invoke (TCP/UDP IPv4/IPv6)
    │   └── FirewallApi.cs               # INetFwRule COM 接口
    ├── Services/
    │   ├── ProcessService.cs            # WMI 进程树构建
    │   ├── NetworkMonitorService.cs     # 网络带宽监控
    │   ├── FirewallService.cs           # 防火墙规则管理（临时/永久）
    │   ├── HostsFileService.cs          # Hosts 文件读写
    │   └── IconService.cs               # exe 图标提取
    ├── ViewModels/
    │   ├── MainViewModel.cs             # MVVM 主逻辑
    │   └── ProcessNodeViewModel.cs      # 单进程 ViewModel
    └── Converters/
        └── Converters.cs                # IValueConverter
```

---

## M3 色彩 Token

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `M3_Primary` | `#6750A4` | `#D0BCFF` | 主色调（Filled Button） |
| `M3_Surface` | `#FEF7FF` | `#141218` | 列表背景 |
| `M3_SurfaceLow` | `#F7F2FA` | `#1D1B20` | 工具栏 / App Bar |
| `M3_SurfaceContainer` | `#F3EDF7` | `#211F26` | Chip / 搜索框背景 |
| `M3_OnSurface` | `#1C1B1F` | `#E6E1E5` | 正文 |
| `M3_OnSurfaceVariant` | `#49454F` | `#CAC4D0` | 辅助文字 |
| `M3_Outline` | `#79747E` | `#938F99` | 边框 |

---

## 组件样式

| Class | 规格 | 用途 |
|-------|------|------|
| `M3Filled` | H=36, R=20, Primary 填充 | 主题切换按钮 |
| `M3Tonal` | H=36, R=20, PrimaryContainer 填充 | Hosts 按钮 |
| `M3Chip` | H=32, R=8, Outline 边框 | 联网控制（🚫♾⬆⬇✅） |
| `M3Segmented` | H=36, R=20, Outline 边框 | 排序模式 |
| `M3Icon` | 36×36, R=18（正圆） | 标题栏按钮 |

---

## 权限控制说明

| 权限 | 图标 | 防火墙规则 | 关闭程序后 |
|------|:---:|-----------|:----------:|
| 允许全部 | ✅ | 无 | — |
| 临时禁止 | 🚫 | 出站+入站 Block | **自动清理** |
| 永久禁止 | ♾ | 出站+入站 Block（`Permanent_` 前缀） | **保留** |
| 仅上传 | ⬆ | 入站 Block | 自动清理 |
| 仅下载 | ⬇ | 出站 Block | 自动清理 |

---

## 已知局限

| 局限 | 说明 |
|------|------|
| 速度是估算值 | 全局带宽按进程连接数比例分配，非精确 per-socket 统计 |
| 需要管理员 | 非管理员运行时防火墙操作静默失败 |
| WMI 依赖 | 某些系统进程可能因权限问题无法获取信息 |

---

# 开发日志

> 完整记录从 WPF 原型到 Material Design 3 交付的全部开发历程。
# Windows Network Manager — 开发日志

## 项目概述

一个基于 Avalonia UI + .NET 8 的 Windows 网络管理器，使用 Windows Filtering Platform 和 IP Helper API 实现进程级网络流量监控与联网权限控制。支持 Material Design 3 风格界面、深色/浅色主题切换，可编译为单文件 exe。

---

## Phase 1: 初始架构 (WPF)

**目标**: 搭建项目骨架，实现核心功能

| 文件 | 说明 |
|------|------|
| `WindowsNetworkManager.csproj` | .NET 8 WPF 项目，引用 `CommunityToolkit.Mvvm` + `System.Management` |
| `app.manifest` | `requireAdministrator` — 防火墙操作需要管理员权限 |
| `Models/Models.cs` | `AppProcessInfo`（进程树节点）、`NetworkPermission`（Blocked/UploadOnly/DownloadOnly/AllowAll）、`SortMode`（四种排行） |
| `Native/IpHelper.cs` | P/Invoke 封装 IP Helper API：`GetExtendedTcpTable`、`GetExtendedUdpTable`、`GetPerTcpConnectionEStats`、`MIB_TCPROW_OWNER_PID` 等结构体 |
| `Native/FirewallApi.cs` | COM 接口定义 `INetFwRule`，用于操作 Windows 防火墙规则 |
| `Services/ProcessService.cs` | WMI 查询 `Win32_Process` 获取进程树（ParentProcessId），构建 flat list 树 |
| `Services/NetworkMonitorService.cs` | 每秒轮询 TCP ESTATS 获取每个连接的收发字节，按 PID 聚合计算速度 |
| `Services/FirewallService.cs` | 动态创建/删除出站/入站防火墙阻止规则，按 `NetworkPermission` 控制联网 |
| `ViewModels/MainViewModel.cs` | MVVM 核心：进程刷新、网络统计更新、排序过滤、权限切换命令 |
| `ViewModels/ProcessNodeViewModel.cs` | 单进程 ViewModel：速度/总量文本格式化、展开折叠状态 |
| `Converters/Converters.cs` | `BoolToVisibilityConverter`、`PermissionToColorConverter`、`ExpandCollapseConverter` 等 |
| `MainWindow.xaml` | 自定义窗口边框、搜索栏、排序按钮、主题切换、TreeView 进程列表、状态栏 |

**问题**: WPF 无法在 Linux 上编译。

---

## Phase 2: 迁移到 Avalonia UI

**目标**: 支持 Linux 编译 + Windows 单文件发布

### 2.1 框架切换

| 变更 | WPF | Avalonia |
|------|-----|----------|
| 目标框架 | `net8.0-windows` | `net8.0` |
| UI 框架 | `UseWPF=true` | `Avalonia` + `Avalonia.Desktop` |
| 主题 | 手动 ResourceDictionary | `FluentTheme` |
| 入口 | `App.xaml` → `App.xaml.cs` | `Program.cs` → `App.axaml` → `App.axaml.cs` |
| XAML 命名空间 | `http://schemas.microsoft.com/winfx/2006/xaml/presentation` | `https://github.com/avaloniaui` |

### 2.2 修改

- `Program.cs`: 新增 Avalonia 应用启动入口
- `App.axaml/.axaml.cs`: `FluentTheme` 代替自定义主题，`RequestedThemeVariant` 切换暗色/亮色
- `MainWindow.axaml/.axaml.cs`: 重写 XAML（Avalonia 语法），自定义窗口边框、列表控件
- `Converters/Converters.cs`: 改用 `Avalonia.Data.Converters.IValueConverter` 接口
- `ViewModels/MainViewModel.cs`: `Dispatcher.UIThread.InvokeAsync` 替代 WPF Dispatcher
- **移除 Themes 目录** — FluentTheme 内置暗色/亮色

### 2.3 编译错误修复

| 错误 | 原因 | 修复 |
|------|------|------|
| 61 个 `CS0246` 类型未找到 | 缺少 `<ImplicitUsings>enable</ImplicitUsings>` | 添加 ImplicitUsings |
| `FluentTheme.Mode` 不存在 | Avalonia 11 改用 `RequestedThemeVariant` | 使用 `ThemeVariant.Dark/Light` |
| `PixelPoint` 未找到 | 缺少 `using Avalonia;` | 添加 using |
| `Action` 委托参数不匹配 | lambda 用了 2 参数但 Action 是 0 参数 | 改为 `() =>` |
| `Grid.BorderBrush` 不存在 | Avalonia Grid 无此属性 | 用 `Border` 包裹 Grid |
| `ListBox.VirtualizationMode` 不存在 | Avalonia API 差异 | 移除该属性 |

---

## Phase 3: Bug 修复 — 网络统计全部为 0

### 根因分析

`GetPerTcpConnectionEStats` 需要通过 `SetPerTcpConnectionEStats` 先启用 TCP 扩展统计（ESTATS）数据收集，否则返回总是 0。

### 第一版修复（ESTATS 启用方案）

- `Native/IpHelper.cs`:
  - 新增 `TCP_ESTATS_DATA_RW_v0` 结构体（`EnableCollection` 字段）
  - 新增 `SetPerTcpConnectionEStats` P/Invoke
  - 新增 `EnableTcpEstats()` 方法：为指定连接启用数据统计
- `Services/NetworkMonitorService.cs`:
  - 新增 `_enabledEndpoints` HashSet 跟踪已启用的连接
  - `CollectCurrentStats()` 中首次遇到新连接时调用 `EnableTcpEstats()`

### 第二版修复（放弃 ESTATS，换用 NetworkInterface）

**原因**: ESTATS 在不同 Windows 版本/配置下兼容性差，即使启用也可能失败。

**新方案**:
- 使用 `System.Net.NetworkInformation.NetworkInterface.GetIPv4Statistics()` 获取全局网络流量
- 比较前后两次 poll 的差值得到每秒全局带宽
- 通过 `GetExtendedTcpTable` 获取各进程的活跃 TCP 连接数
- 按连接数比例将全局带宽分配到各进程

```csharp
double ratio = (double)procConnections / totalConnections;
long upBps = (long)(globalUploadBps * ratio);
long dnBps = (long)(globalDownloadBps * ratio);
```

**优点**: 可靠、跨版本兼容、无需启用 ESTATS。

---

## Phase 4: 功能增强

### 4.1 永久禁用联网

- `Models/Models.cs`: 新增 `NetworkPermission.PermanentBlocked` 枚举值
- `Services/FirewallService.cs`:
  - 新增 `PermanentPrefix = "WNetMgr_Permanent_"` 
  - `SetProcessPermission()`: PermanentBlocked 使用永久前缀创建防火墙规则
  - `CleanupAllRules()`: 只清理临时规则（`WNetMgr_*`），跳过永久规则（`WNetMgr_Permanent_*`）
  - 新增 `CleanupPermanentRules()`: 清理所有永久规则
- `ViewModels/MainViewModel.cs`: 新增 `PermanentBlockCommand`（♾ 按钮）
- `ViewModels/ProcessNodeViewModel.cs`: `PermanentBlocked` → "永久禁止" 文本
- `Converters/Converters.cs`: `PermanentBlocked` → 紫色 `#6750A4`
- `MainWindow.axaml`: 新增 ♾ 永久禁止按钮

### 4.2 Hosts 文件编辑器

- `Services/HostsFileService.cs` (新文件):
  - `ReadHosts()` / `WriteHosts()`: 读写系统 hosts 文件
  - `OpenInExternalEditor()`: 用记事本打开 hosts 文件
  - `BlockDomain()` / `UnblockDomain()`: 添加/移除 `127.0.0.1 domain #WNetMgr` 条目
- `ViewModels/MainViewModel.cs`: 新增 `OpenHostsEditorCommand`
- `MainWindow.axaml`: 工具栏新增 📝Hosts 按钮

---

## Phase 5: UI 问题修复

### 5.1 ListBox 选择阴影乱跳

**根因**: `ApplySortAndFilter()` 中 `Processes.Clear()` + `Add()` 重建集合，导致 ListBox 选择状态 lost → 随机重映射。

**修复**: 将 `ListBox` 替换为 `ItemsControl`（无选择行为），禁用所有 selection 样式。

### 5.2 按钮尺寸不一致

**根因**: 工具栏按钮和权限按钮使用不同的 Width/Height/Padding。

**修复**: 定义 `Button.ActionBtn` 样式（28x28 + CornerRadius=8），所有联网控制按钮使用统一样式类。

---

## Phase 6: Material Design 3 全面改版

### 6.1 设计参考

基于 [m3.material.io](https://m3.material.io) 规范实现。

### 6.2 Color Token 系统

定义 13 个 M3 颜色 token，在 `App.SetTheme()` 中按亮色/暗色分别设置：

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `M3_Primary` | `#6750A4` | `#D0BCFF` | 主色调 |
| `M3_Surface` | `#FEF7FF` | `#141218` | 背景 |
| `M3_SurfaceLow` | `#F7F2FA` | `#1D1B20` | 工具栏/AppBar |
| `M3_SurfaceHigh` | `#ECE6F0` | `#2B2930` | Hover 态 |
| `M3_SurfaceContainer` | `#F3EDF7` | `#211F26` | 搜索框/Chip 背景 |
| `M3_OnSurface` | `#1C1B1F` | `#E6E1E5` | 正文文字 |
| `M3_OnSurfaceVariant` | `#49454F` | `#CAC4D0` | 辅助文字 |
| `M3_Outline` | `#79747E` | `#938F99` | 边框 |
| `M3_OutlineVariant` | `#CAC4D0` | `#49454F` | 分割线 |
| `M3_Error` | `#B3261E` | `#F2B8B5` | 错误色 |

### 6.3 组件样式

| 类 | 规格 | 用途 |
|----|------|------|
| `M3Filled` | H=36, CornerRadius=20, Primary 背景, OnPrimary 文字 | 主题切换按钮 |
| `M3Tonal` | H=36, CornerRadius=20, PrimaryContainer 背景 | Hosts 按钮 |
| `M3Chip` | H=32, CornerRadius=8, Outline 边框 | 联网控制按钮（🚫禁止/♾永久/⬆上传/⬇下载/✅允许） |
| `M3Segmented` | H=36, CornerRadius=20, Outline 边框 | 排序模式切换 |
| `M3Icon` | 36x36, CornerRadius=18（正圆） | 窗口标题栏按钮 |

### 6.4 Surface 层次

```
窗口 → M3_Surface (CornerRadius=16)
├── Top App Bar → M3_SurfaceLow
├── Toolbar → M3_SurfaceLow
├── Column Headers → M3_SurfaceLow
├── Process List → M3_Surface
└── Bottom Bar → M3_SurfaceLow
```

### 6.5 布局规范

- 行高: 48px（单行列表）
- 内边距: 16px（Toolbar/Headers）、12px（Button padding）
- 间距: 8px（组件间距）、12px（大间距）
- 圆角: 8px（Chip）、16px（窗口）、20px（按钮）、28px（搜索框）

---

## Phase 7: 窗口交互与 UI 抖动修复

### 7.1 无法调整窗口大小 / 最大化 / 最小化

**根因**:
1. `ExtendClientAreaChromeHints="NoChrome"` 完全禁用了系统级 resize 边框
2. 标题栏上存在一个透明的 `Panel` 覆盖层捕获 `PointerPressed`，阻挡了下层 Button 的点击事件

**修复**:
- `NoChrome` → `SystemChrome`，启用系统绘制的 resize handles
- 去掉独立 Panel 层，将 `PointerPressed="OnTitleBarPressed"` 直接放到 Top App Bar 的 `Border` 上
- 标题 `TextBlock` 添加 `IsHitTestVisible="False"`，避免拦截拖拽手势

### 7.2 按钮文本偏上

**根因**: M3 按钮样式（`M3Filled`/`M3Tonal`/`M3Chip`/`M3Segmented`）缺少 `VerticalContentAlignment`。

**修复**: 所有 M3 按钮 Style 统一添加 `VerticalContentAlignment="Center"`。

### 7.3 联网控制按钮右侧被截断

**根因**: Chip 按钮带文字标签（"🚫 禁止"/"♾ 永久"等）总宽度远超列宽 250px。

**修复**:
- Chip 按钮改回纯图标（🚫/♾/⬆/⬇/✅），由 ToolTip 说明功能
- 窗口宽度: 1100px → 1200px
- 联网控制列宽: 250px → 380px

### 7.4 进程列表数据乱跳

**根因**:
1. `OnNetworkStatsUpdated` 每秒调用 `ApplySortAndFilter()` → `Processes.Clear()` + `Add()` 重建整个列表
2. 排序值变化时，同一进程可能在不同轮次处于不同位置，导致视觉抖动

**修复**:

| 变更 | 效果 |
|------|------|
| 从 `OnNetworkStatsUpdated` 移除 `ApplySortAndFilter()` 调用 | 每秒 stats 更新仅原地刷新 ViewModel 属性值（`INotifyPropertyChanged`），不重排列表 |
| `ApplySortAndFilter()` 改用 `Move()`/`Insert()`/`RemoveAt()` | 不再 `Clear()`→`Add()`，避免列表瞬间变空导致的闪烁 |

```csharp
// 旧：全量重建
Processes.Clear();
foreach (var item in sortedList)
    Processes.Add(item);

// 新：增量更新
for (int i = Processes.Count - 1; i >= 0; i--)
    if (!targetList.Contains(Processes[i]))
        Processes.RemoveAt(i);

for (int i = 0; i < targetList.Count; i++)
{
    int curIdx = Processes.IndexOf(targetList[i]);
    if (curIdx < 0)
        Processes.Insert(i, targetList[i]);
    else if (curIdx != i)
        Processes.Move(curIdx, i);
}
```

---

## 文件清单

```
WindowsNetworkManager/
├── build.sh                        # Linux 构建脚本
├── BuildAndPublish.bat             # Windows 构建脚本
├── README.md
├── publish/
│   └── WindowsNetworkManager.exe   # 单文件输出 (44MB)
└── src/
    ├── WindowsNetworkManager.csproj
    ├── app.manifest
    ├── Program.cs                  # 入口
    ├── App.axaml                   # 应用 XAML + M3 默认资源
    ├── App.axaml.cs                # 主题切换 + M3 Token 管理
    ├── MainWindow.axaml            # Material 3 主界面
    ├── MainWindow.axaml.cs         # 窗口控制（拖动、最大化、关闭）
    ├── Models/
    │   └── Models.cs               # AppProcessInfo, NetworkPermission, SortMode
    ├── Native/
    │   ├── IpHelper.cs             # IP Helper API P/Invoke（TCP/UDP 连接 + ESTATS）
    │   └── FirewallApi.cs          # INetFwRule COM 接口
    ├── Services/
    │   ├── ProcessService.cs       # WMI 进程树构建
    │   ├── NetworkMonitorService.cs# NetworkInterface 全局带宽 + 按比例分配
    │   ├── FirewallService.cs      # 防火墙规则管理（临时/永久）
    │   ├── HostsFileService.cs     # Hosts 文件读写/编辑
    │   └── IconService.cs          # exe 图标提取 + AvaloniaBitmap 转换
    ├── ViewModels/
    │   ├── MainViewModel.cs        # MVVM 主逻辑 + RelayCommand
    │   └── ProcessNodeViewModel.cs # 单进程 ViewModel
    └── Converters/
        └── Converters.cs           # IValueConverter 实现
```

---

## 构建命令

```bash
# Linux 编译 + 发布 Windows exe
./build.sh

# Windows 上
BuildAndPublish.bat

# 手动
dotnet publish src/WindowsNetworkManager.csproj \
    -c Release -r win-x64 --self-contained true \
    -p:PublishSingleFile=true -o publish
```

---

## 已知局限

| 局限性 | 说明 |
|------|------|
| 网络速度是估算值 | 全局带宽按连接数比例分配，非精确 per-socket 统计 |
| 防火墙规则需要管理员 | 非管理员运行时防火墙操作静默失败 |
| WMI 进程枚举 | 某些系统进程可能因权限问题无法获取信息 |

---

## Phase 8: 数据显示修复与视觉增强

### 8.1 网络数据再次全部为 0

**根因**: 只枚举 IPv4 TCP 连接，现代 Windows 大部分流量走 IPv6。当 `pidConns` 为空时，无任何进程能分配到全局带宽。

**修复** (`Services/NetworkMonitorService.cs`, `Native/IpHelper.cs`):

| 变更 | 说明 |
|------|------|
| 新增 `GetAllTcp6Connections()` | 枚举 IPv6 TCP 连接（AF_INET6），转换为统一的 `MIB_TCPROW_OWNER_PID` |
| 合并 IPv4 + IPv6 + UDP | `CollectStats()` 同时统计三种协议的连接数 |
| Fallback 机制 | P/Invoke 全部失败时，降级用 `IPGlobalProperties.GetActiveTcpConnections()` 获取连接数，按所有运行中进程均匀分配 |

### 8.2 速度/总量列文字参差不齐

**根因**: 列内文本 `HorizontalAlignment="Center"`，不同数字宽度不一致（"0 B/s" vs "123.4 KB/s"）导致列间不对齐。

**修复**: 上传速度、下载速度、上传总量、下载总量四列改为 `HorizontalAlignment="Right"` + `Margin="0,0,12,0"`，表头同步右对齐。

### 8.3 进程图标 → 提取 exe 原生图标

**实现** (`Services/IconService.cs`):

- 新增 `System.Drawing.Common` 依赖
- `Icon.ExtractAssociatedIcon(path)` → `Bitmap` → `MemoryStream(PNG)` → `AvaloniaBitmap`
- `ConcurrentDictionary` 缓存已提取图标，Null 时降级为权限色圆圈
- `ProcessNodeViewModel.Icon` 绑定到 XAML `<Image Source="{Binding Icon}"/>`

### 8.4 深色/浅色切换动画

**实现** (`MainWindow.axaml` + `.axaml.cs`):

- 窗口顶层添加 `ThemeOverlay` Border（`IsHitTestVisible="False"`, ZIndex=999）
- 切换时 Opacity 0→0.2 (120ms) → 0.0 (180ms)，`CancellationTokenSource` 防止重复动画
- 覆盖层 `Background="{DynamicResource M3_OnSurface}"` 产生短暂暗/亮闪烁感

### 8.5 子进程默认折叠 + 展开按钮修复

| 问题 | 修复 |
|------|------|
| 子进程默认展开 | `ProcessService` 中 `IsExpanded` 默认值 `true` → `false` |
| 展开按钮不生效 | 新增 `SetProcessExpanded(pid, expanded)` 方法，`ToggleExpand` 时同步更新 `_processCache` |
| 按钮位置偏左上 | `DockPanel` → `StackPanel Orientation="Horizontal"`，按钮显式设 `HorizontalContentAlignment="Center"` + `VerticalContentAlignment="Center"` |

### 8.6 搜索框布局修复

**根因**: `DockPanel` 在 Avalonia 中子元素布局异常，TextBox 被压缩到左上角。

**修复**: 改为 `Grid` 三列（🔍 | TextBox | ✕），`Border` 显式设 `Height="40"` 对齐工具栏行高。

### 8.7 hover 闪烁

**修复**: `M3Filled`/`M3Tonal` 按钮 `ContentPresenter` 添加 `DoubleTransition(Opacity, 0.12s)` 平滑过渡。

---

*最后更新: 2026-07-31 (Phase 8)*
