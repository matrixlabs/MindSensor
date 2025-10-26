# Solana Mindsensor Web 应用

这是一个基于 Web Bluetooth API 的 Mindsensor 脑电波监测应用，可以实时采集、显示和分析脑电波数据。

## 技术栈

- **前端框架**: Vite + React 19 + TypeScript
- **样式**: Tailwind CSS v4
- **状态管理**: Zustand
- **路由**: React Router v7
- **图表**: ECharts + echarts-for-react
- **时间处理**: Day.js
- **蓝牙**: Web Bluetooth API

## 功能特性

### 1. 蓝牙连接
- 支持扫描 Mindsensor_ 前缀的设备（10秒超时）
- 手动选择设备（浏览器原生选择框）
- 实时连接状态指示
- 掉线检测（超过3秒未收到数据）
- 支持"连接其他"设备

### 2. 数据采集
- 实时接收两段合包数据（SensorData1 + SensorData2）
- 佩戴状态检测（sq 信号质量）
- 专注度（focus）和放松度（relax）实时显示
- 8个脑电波频段数据（delta、theta、lowAlpha、highAlpha、lowBeta、highBeta、lowGamma、highGamma）

### 3. 数据可视化
- 实时图表展示专注度和放松度曲线
- 时间轴格式化（HH:mm:ss）
- 数据点数实时统计
- 结果页面展示训练总览

### 4. 录制控制
- 开始/结束录制
- 清空数据
- 本地临时存储（不上传服务器）
- 训练时长、平均值、最大/最小值统计

## 安装与运行

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm run dev

# 构建生产版本
pnpm run build

# 预览生产版本
pnpm run preview
```

## 使用说明

### 环境要求
- **浏览器**: 桌面版 Chrome/Edge（支持 Web Bluetooth API）
- **协议**: localhost 或 HTTPS
- **设备**: Mindsensor 蓝牙设备

### 使用流程

1. **进入应用**
   - 访问首页，点击"进入监测页面"

2. **连接设备**
   - 点击"扫描设备"自动扫描（10秒）
   - 或点击"选择设备"手动选择
   - 点击设备列表项进行连接

3. **开始监测**
   - 确保佩戴状态为"正常"
   - 点击"开始记录"开始采集数据
   - 实时查看专注度和放松度曲线

4. **查看结果**
   - 点击"结束记录"进入结果页面
   - 查看训练时长、平均值等统计数据
   - 可返回继续监测

### 蓝牙状态指示器
- 右上角显示实时连接状态
- 点击可查看详细信息
- 支持快速断开连接或连接其他设备

## 项目结构

```
src/
├── bluetooth/
│   └── mindsensor.ts         # 蓝牙封装（扫描/连接/订阅）
├── components/
│   ├── BluetoothStatus.tsx   # 蓝牙状态指示组件
│   ├── DeviceList.tsx        # 设备列表组件
│   └── RealtimeChart.tsx     # 实时图表组件
├── pages/
│   ├── Home.tsx              # 首页
│   ├── Monitor.tsx           # 监测页面
│   └── Result.tsx            # 结果页面
├── store/
│   └── monitorStore.ts       # Zustand 全局状态
├── types/
│   └── bluetooth.ts          # 类型定义
├── utils/
│   └── sensorParser.ts       # 数据解析工具
├── App.tsx                   # 应用根组件
├── main.tsx                  # 入口文件
├── routes.tsx                # 路由配置
└── index.css                 # 全局样式
```

## 蓝牙协议

### Service UUID
`039AFFF0-2C94-11E3-9E06-0002A5D5C51B`

### Characteristics

- **Write**: `039AFFA0-2C94-11E3-9E06-0002A5D5C51B`
  - 启动命令: `[77, 71, 1]`

- **Notify**: `039AFFF4-2C94-11E3-9E06-0002A5D5C51B`
  - 接收数据（两段合包）

### 数据格式

**第一段 (aa01010f)**:
- sq: 信号质量（0=正常）
- focus: 专注度
- relax: 放松度
- delta, theta, lowAlpha, highAlpha

**第二段 (aa01020c)**:
- lowBeta, highBeta, lowGamma, highGamma

## 注意事项

1. **浏览器兼容性**: 仅支持桌面 Chrome/Edge，Safari 和 Firefox 暂不支持 Web Bluetooth
2. **HTTPS 要求**: 生产环境必须使用 HTTPS，开发环境可使用 localhost
3. **佩戴检测**: 请确保 sq=0 时再开始记录，否则数据不准确
4. **掉线处理**: 超过3秒未收到数据会提示可能掉线
5. **数据存储**: 当前仅本地临时存储，刷新页面会丢失数据

## 开发计划

- [x] 基础脚手架与依赖安装
- [x] Tailwind v4 配置
- [x] 路由与页面骨架
- [x] Zustand store
- [x] BLE 封装
- [x] 传感器数据解析
- [x] Monitor 页面
- [x] 实时图表
- [x] Result 页面
- [x] 蓝牙状态指示组件
- [x] 掉线检测

## License

MIT
