// 强制加载 @types/jest 全局声明。
// exgo 的 tsconfig.base 设置了 customConditions: ["react-native"]，
// 在 TS 6.0 下会使 @types/* 的"按 exports 自动加载"对该条件失效（`npm run typecheck`
// 报 Cannot find name 'test'/'expect' 等）。用显式 reference 走 typeRoots 目录加载，
// 绕过自动加载路径，且不修改 customConditions（删掉会破坏 RN 包的 react-native 条件解析）。
/// <reference types="jest" />