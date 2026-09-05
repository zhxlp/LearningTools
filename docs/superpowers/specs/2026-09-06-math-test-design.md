# 计算测试（Math Test）功能设计

日期：2026-09-06
状态：已与需求方确认

## 背景与目标

在现有「字母听力测试」之外新增一个「计算测试」学习模块。它与听力测试共用页面骨架（设置/报表入口、`本次答题: 正确/错误/连续` 统计条、报表风格），但引入四个新能力：

1. 四种四则运算题（加、减、乘、除），题型与每型难度可配置；
2. 主界面左右分屏：左侧题目 + 手写草稿区（笔 / 橡皮 / 清空），右侧答案栏 + 虚拟键盘；
3. 基于「轮次」的报告：轮次 = 一次进入页面的连续练习，退出即结算；
4. 进入各模块设置前需通过家长验证：默认 4 位加减，题型/位数难度/答错行为由首页「全局设置」统一配置，听力与计算共用同一验证层。

## 关键决策（已确认）

- **轮次定义**：进入页面即开始一轮，题量不限，按返回/离开才结算保存；0 次提交的空轮不保存。
- **除法**：只出整除题（被除数是除数的整数倍），不出现小数/余数。
- **手写方案**：新增依赖 `react-native-svg`（Expo Go 可用），笔迹平滑。
- **设置入口验证层（全局）**：全屏盖层 + 虚拟键盘/答案栏；验证用的题型、位数难度、答错行为由首页「全局设置」统一配置，听力测试与计算测试的设置入口共用同一 `ParentalGateOverlay`。

---

## 一、页面与路由结构

```
app/
  _layout.tsx              注册 settings、math-test/index、math-test/settings、math-test/report 四个新路由
  index.tsx                首页新增「计算测试」🧮 卡片 + 右上角 ⚙️ 全局设置入口
  settings.tsx             全局设置（仅家长验证参数，页面式）
  math-test/
    index.tsx              计算测试主界面（headerShown:false，锁横屏）
    settings.tsx           计算测试设置页（页面式，非弹窗）
    report.tsx             学习报表（近3个月）
lib/
  math-types.ts            OpType / MathSettings / ParentalGateSettings / 轮次 / 题目 类型与守卫
  math-question.ts         题目生成器（含整除除法；家长验证与主界面共用规则）
  math-settings.ts         计算测试设置读写 + 默认值（AsyncStorage）
  parental-gate.ts         家长验证全局设置读写 + 默认值（AsyncStorage）
  math-storage.ts          轮次按 key 写读、前缀扫描、近3个月聚合
components/
  DrawingPad.tsx           手写白板（笔/橡皮/清空，react-native-svg）
  NumberKeypad.tsx         虚拟数字键盘（家长验证层 + 主界面答案区复用）
  ColumnarLayout.tsx       竖式列式印刷（位数对齐网格，字号/间距可调）
  ParentalGateOverlay.tsx  家长验证全屏盖层（全局可配置；听力页/计算页共用）
```

> 说明：`math-question` 等逻辑模块放 `lib/`（不放 `app/` 下，避免被 expo-router 当作路由）。

新增依赖：`react-native-svg`（通过 `npx expo install react-native-svg`）。

## 二、主界面布局（横屏）

```
┌───────────────────────────────────────────────┬────────────────────────────────┐
│  ⚙️(设置)  📊(报表)                            │                                │
│  本次答题: 正确 12  错误 3  连续 5              │        ┌────────────────┐      │
├───────────────────────────────────────────────┤        │   ?  显示答案    │      │
│ ┌───────────────────────────────────────────┐ │        └────────────────┘      │
│ │  题目横式   ·  23 + 45 = __                │ │        1  2  3                 │
│ │ ───────────────────────────────────────── │ │        4  5  6                 │
│ │  竖式(列式印刷，供参照对齐)                │ │        7  8  9                 │
│ │     23                                    │ │          0   ⌫                │
│ │   + 45                                    │ │      ┌────────────┐            │
│ │  ────                                    │ │      │    确定     │            │
│ │           （空白手写区）                  │ │      └────────────┘            │
│ │  ✏️笔  🧽橡皮  🗑️清空                    │ │                                │
│ └───────────────────────────────────────────┘ │                                │
└───────────────────────────────────────────────┴────────────────────────────────┘
```

- **左屏**
  - 顶部一行题**横式**：`a ○ b = ?`。
  - 下方大块白板（`DrawingPad`）：**中央印刷**该题的竖式列式，其余区域可自由手写（竖式为画布下层内容，不被橡皮擦除）。
  - 工具栏 `✏️笔 / 🧽橡皮 / 🗑️清空` + `🅰️排版`（就地调节，见「竖式印刷与就地排版调节」）。
  - 切换题目时清空手写笔迹并重新印刷该题竖式。
- **右屏**
  - 上方**答案栏**：大号显示已输入数字；右侧 ⌫ 删最后一位；已答状态用绿/红反馈。
  - 下方**虚拟键盘** `NumberKeypad`：0–9、⌫、整行 **确定**。
  - 答案栏只接受数字；结果最大 9 位（输入上限 9）。
- **顶部**：设置⚙ / 报表📊 圆钮 + 统计条 `本次答题: 正确X 错误Y 连续Z`（配色沿用听力页，连续为橙 #ff9800）。
- 方向锁定横屏，方式与听力页一致（`ScreenOrientation.lockAsync(LANDSCAPE)`，卸载时解锁）；`headerShown:false`。

### 竖式印刷与就地排版调节（ColumnarLayout）

竖式按**位数对齐网格**印刷在白板中上部，作为列式参照；同列数字严格上下对齐（个位对个位、十位对十位、…，右对齐）。示意：

```
       2 3
   +   4 5
  ─────────
    （线下方留空手写结果）
```

- 每个数字占一个单元格（cell）；运算符占最左格；上操作数上方留空写进位/借位，两操作数行间留行距，横线之下留空写结果。
- **就地调节**：白板工具栏 `🅰️排版` 展开紧凑面板，含三个步进器：
  - `字号`（单元格大小）、`行距`（上下行间留白）、`列距`（左右相邻数字间隙）；
  - 改动**即时生效**于当前题与后续题，并**持久化**到 `mathTestSettings.columnarStyle`（见 §6）；默认值字号 44 / 行距 20 / 列距 6（像素，实现时微调）。
- 竖式渲染独立成组件 `ColumnarLayout({ a, b, op, style })`，白板在其上叠放手写层。

## 三、答题流程与「轮次」

- 进入页面开始一轮；题量不限，按返回离开时结算保存。0 次提交 → 不保存。
- 出题循环：启用题型中等概率抽取一种，按该题型难度生成题。
- 提交答案（按确定）：
  - **答对**：该题 `correct+1`；绿色反馈；约 0.8s 后出下一题。
  - **答错**：该题 `incorrect+1`；红色反馈 + 播错误提示音（复用听力页 `game_wrong_choice.mp3`）；输入清空；此后行为由设置「答错后」决定（默认 `继续此题`）：
    - **换新题**：本题作废不再出现（无答对记录，`correct` 保持 0），直接出下一道全新题；
    - **继续此题**：本题保留，重新展示同一题让儿童再答，答对后 `correct+1` 才进入下一题。
- 统计口径（对齐听力页）：
  - `正确` = 答对事件数（每题最终答对记 1；`换新题` 模式下被放弃的错题不计）；
  - `错误` = 错误提交次数；
  - `连续` = 自上次答错以来，**首答即对**的题数（答错过的题其后续答对不增加连续数）。
- 顶部统计条为该轮实时值。

### 详情澄清（实现为准）
- `换新题`：错题被放弃，`answeredAtISO` 为空、`correct` 为 0，仅累计 `incorrect`。
- `继续此题`：同一题反复答错持续累计其 `incorrect`，答对后该题 `correct=1`。
- 每题首次展示时记 `startedAtISO`；最终答对提交时记 `answeredAtISO`；`继续此题` 反复作答不覆盖 `startedAt`（时间口径 = 首次看到到最终答对的耗时）。
- 轮次/题目 id 均取开始时间戳(ms)，不用随机数。
- 一轮中途切走再回来（不卸载路由，仅切后台）不结算；离开页面（unmount/返回）才结算。

## 四、设置页（页面式，三组）

路径 `/math-test/settings`，经家长验证后进入。风格沿用现有蓝色系组件（白卡片、圆角、#1976d2 高亮）。

**第一组「题目类型」**（多选）：
- 选项：`加法` `减法` `乘法` `除法`；点击高亮切换（选中 = 开启）。
- 默认：加法、减法开启；乘法、除法关闭。
- 至少保留一种开启（最后一个不可取消，或取消时提示）。

**第二组「难度 · 数字位数」**：每个题型一行：
- 含**最少位数**与**最多位数**两个 −/+ 步进器；范围 1–4，强制 最少 ≤ 最多。
- 语义：2–3 位 ⇒ 数字落在 `10^1`~`10^3-1`（10 ~ 999）。
- 已禁用的题型行灰显不可改（或仍可改但仅当其启用后生效 —— 实现取**灰显不可改**）。

**第三组「答题行为」**：
- 「答错后」单选二选一：`继续此题`（默认）/ `换新题`；点击高亮切换。
- 语义：`换新题` = 答错即弃并出下一道全新题；`继续此题` = 停留在当前题直到答对。

**保存**：底部「完成」按钮 → 写 `mathTestSettings`（AsyncStorage）→ `router.back()`。未点完成直接返回则丢弃修改。

默认值：全部题型 1–2 位；答错后 = 继续此题；竖式排版 = 字号44/行距20/列距6。

## 五、出题规则

每题两个数。操作数从启用的题型中等概率抽取。

- 通用取数：位数 `d ∈ [minDigits, maxDigits]` 均匀随机取整，最高位非 0。
- **加法**：两操作数各自取数；答案可为 `maxDigits+1` 位。
- **减法**：两操作数各自取数，若 `a < b` 则交换 ⇒ 答案非负（含 0 不做题，重试）。
- **乘法**：两操作数各自取数；结果可达约 `2×maxDigits` 位（受答案栏 9 位上限约束，maxDigits ≤ 4 时安全）。
- **除法（整除）**：
  1. 随机取除数 `b`（位数在范围内）；
  2. 随机取目标被除数位数 `da ∈ [minDigits, maxDigits]`；
  3. 在 `[10^(da-1), 10^da-1]` 内随机尝试一个被除数 `a`，要求 `a % b === 0`；尝试上限（如 50 次）内未命中则重抽 `b` / `da`；兜底退化为「取 `b` 的某倍数落入区间」。
  4. 呈现 `a ÷ b = ?`，商必为整数。

表达式字符串统一 `expr = "a ○ b"`（分隔符为空格），符号 `+ - × ÷`。

## 六、数据模型与存储（AsyncStorage）

```ts
// lib/math-types.ts
type OpType = '+' | '-' | '*' | '÷';

interface MathDifficulty { minDigits: number; maxDigits: number; }

interface ColumnarStyle {
  digitSize: number;   // 字号 = 单元格大小，默认 44
  rowGap: number;      // 上下行间留白，默认 20
  colGap: number;      // 左右相邻数字间隙，默认 6
}

type WrongAnswerMode = 'new' | 'retry';  // 答错后：换新题 / 继续此题

interface MathSettings {
  enabledOps: OpType[];                          // 默认 ['+','-']
  difficulty: Record<OpType, MathDifficulty>;    // 默认全部 {1,2}
  wrongAnswerMode: WrongAnswerMode;              // 默认 'retry'（继续此题）
  columnarStyle: ColumnarStyle;                  // 白板就地排版调节，持久化于此
}

interface ParentalGateSettings {
  enabledOps: OpType[];                       // 默认 ['+','-']
  digits: { min: number; max: number };       // 默认 {4,4}
  wrongAnswerMode: WrongAnswerMode;           // 默认 'new'（换新题）
}

interface MathQuestionRecord {
  a: number; b: number;
  op: OpType;
  expr: string;          // 如 "23 + 45"
  correct: number;       // 答对事件数（最终每题为 1）
  incorrect: number;     // 错误提交次数
  startedAtISO: string;  // 该题首次展示时间
  answeredAtISO?: string; // 最终答对提交时间（本轮结束仍未答对则省略）
}

interface MathRound {
  id: string;                 // 轮次开始时间戳(ms)即 id，天然唯一，无随机数
  startedAtISO: string;       // = 轮次开始时间，与 id 同源
  firstAnswerAtISO: string;   // 展示的“轮次时间” = 首次提交答案时间
  correct: number;            // = sum(questions.correct)
  incorrect: number;          // = sum(questions.incorrect)
  questions: MathQuestionRecord[];
}
```

Key 约定（不按天分桶）：
- 计算测试设置：`mathTestSettings`
- 家长验证全局设置：`parentalGateSettings`
- 每轮一 key：`calcRound_${round.id}`（id 为开始时间戳 ms）→ `MathRound` JSON
- 保存轮次 = 只写该轮 key（无需读改写历史）；“近 3 个月” = `AsyncStorage.getAllKeys` 过滤 `calcRound_` 前缀并解析时间戳筛选，无需知道具体日期。

## 七、报表页（/math-test/report）

风格贴齐听力 `report.tsx`（白卡片分区、圆角、同样灰阶/蓝配色）。锁定近 3 个月（`now` 往前 90 天）。

**总体统计（近 3 个月）**：三卡 `正确 | 错误 | 准确率`（正确率 = 正确/(正确+错误)，无数据为 0%）。

**类型详情（近 3 个月）**：4 行表 `题型 | 正确 | 错误 | 正确率`，行内小字 `+ - × ÷` 便于阅读；无数据该行 0。

**轮次记录（近 3 个月）**：
- 列表按 `firstAnswerAtISO` 倒序；每行：
  `轮次时间（MM-DD HH:mm，取 firstAnswerAt）   正确 X    错误 Y`
- 点击行 → 展开显示：
  - 该轮 `正确/错误/准确率` 三小卡（同听力 daily 详情的 statBox 样式）；
  - **题目明细列表**：每行 `题目 expr | 正确次数 | 错误次数`。
- 右上角垃圾桶图标：确认弹窗后删除近 3 个月窗口内的全部 `calcRound_*`（窗口外历史保留），成功后刷新。

数据加载：`getAllKeys` 过滤 `calcRound_` 前缀 → 按 id 时间戳筛近 3 个月 → 批量读取并合并 questions 聚合。

## 八、家长验证层（ParentalGateOverlay，全局共用）

**入口统一**：听力测试与计算测试的点 ⚙️ 都打开**同一个验证盖层**，答对后才进入各自设置（听力 → 其设置弹窗；计算 → push `/math-test/settings`）。报表入口无需验证（维持现状）。

**全局设置（首页 ⚙️ → `/settings`，页面式，只管控家长验证）**：
- 计算类型（多选）：`加法` `减法` `乘法` `除法`；默认 加 + 减。
- 位数难度：`最少位数 / 最多位数` 两个 −/+ 步进器（1–4，最少 ≤ 最多）；默认 4–4（即 1000–9999）。
- 「答错后」单选：`换新题` / `继续此题`；默认 `换新题`（沿用现听力页验证行为）。
- 「完成」→ 写 `parentalGateSettings`（AsyncStorage）→ `router.back()`；未点完成返回则丢弃。

**组件行为（ParentalGateOverlay）**：
- 打开时读 `parentalGateSettings`，按启用题型等概率出题；出题规则同 §5（除法整出、减法非负）。
- 全屏盖层布局：题目横式 + 答案栏 + `NumberKeypad`（复用虚拟键盘）。
- 答对 → 回调 `onSuccess()`，由调用方负责跳转/开设置。
- 答错 → 红字「答案错误」+ 清空输入；按 `wrongAnswerMode`：`换新题`=换一道新题，`继续此题`=同题重答。
- ✕ / Android 返回 → 回调 `onClose()`，不进入设置。
- **此组件替换听力测试当前内嵌的固定 4 位加减弹窗**（其本地方案作废，读取同一全局配置）。

## 九、手写板技术方案（DrawingPad）

- 基于 `react-native-svg`：一个 `<Svg>` + 若干 `<Polyline>`（每根代表一次落笔/移动片段，点集合自 PanResponder 采集）。
- 工具模式 `pen | eraser`：pen 用深蓝/黑粗线；eraser 用白板底色、更粗的线在顶层绘制（经典做法，层序使先前笔迹被"盖掉"，视觉上即擦除）。
- `clear()`：清空笔迹数组。
- 笔迹可含 `strokeColor`、`strokeWidth`，缩放在不同设备上用相对尺寸。
- 竖式印刷层 = 组件 `ColumnarLayout` 以普通 RN 视图渲染为白板底部内容（非 SVG 笔迹层），居中印刷、按样式参数排布；清空与橡皮不影响它。

## 十、涉及文件与改动点（实现阶段执行顺序）

1. `npx expo install react-native-svg`
2. 新建 `lib/math-types.ts`、`lib/math-question.ts`、`lib/math-settings.ts`、`lib/parental-gate.ts`、`lib/math-storage.ts`
3. 新建 `components/DrawingPad.tsx`、`components/NumberKeypad.tsx`、`components/ColumnarLayout.tsx`、`components/ParentalGateOverlay.tsx`
4. 新建 `app/math-test/index.tsx`（主界面）、`app/math-test/settings.tsx`、`app/math-test/report.tsx`
5. 新建 `app/settings.tsx`（家长验证全局设置）；`app/_layout.tsx` 注册 4 个新路由；`app/index.tsx` 加 🧮 卡片与右上角 ⚙️
6. 听力测试改造：移除内嵌固定 4 位加减验证，改用 `ParentalGateOverlay`（读取同一全局配置）
7. 计算测试主界面内部接线：统计条、出题/判题（含 `wrongAnswerMode`）、轮次结算（离开页面时）、竖式印刷/手写/键盘
8. 验证层 / 手写 / 键盘联调；横屏锁定；音效

## 十一、验收清单（概要）

- 主界面可连续答题；答错行为按全局/模块设置（继续此题 默认）；统计条正确/错误/连续实时正确。
- 手写板可写、可擦、可清空；题目切换重置草稿并刷新竖式；竖式字号/行距/列距就地可调并持久化。
- 四种题型按难度出题；除整除、减非负；设置修改生效且持久化。
- 家长验证由全局设置驱动：听力页与计算页共用同一验证层；改题型/位数/答错行为后两页验证一致；答对进设置，✕/返回放弃。
- 报表：近 3 个月总体/类型详情正确；轮次列表可展开，题目明细正确；清除记录可用。
- `tsc --noEmit` 与 `eslint` 对本模块零 error。
