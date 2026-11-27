# Flutter 工作树框架

`src/` 按原 Jovian 的业务分工组织。五个底栏入口为命理、合盘、算事、消息和个人中心。运势从命理进入，并保留直接访问路由。

```text
app-flutter/
├── Start-web.cmd
├── package.json / package-lock.json    Node 服务和计算工具依赖
├── pubspec.yaml / pubspec.lock         Flutter 依赖
├── src/
│   ├── app/                            路由与应用入口
│   ├── bootstrap/                      服务、请求客户端和模块装配
│   ├── features/
│   │   ├── account/                    账户、权限、资料与归档
│   │   ├── compliance/                 协议与发布合规
│   │   ├── destiny/                    命理
│   │   ├── divination/                 算事
│   │   ├── fortune/                    运势
│   │   ├── recommendation/            推荐契约
│   │   ├── social/                     消息与关注关系
│   │   └── synastry/                   合盘
│   ├── shared/                         HTTP 与共享契约
│   └── ui/                             公共主题、组件和素材
├── test/                              Flutter 界面和流程测试
├── tool/                              构建与对照工具
└── .local/                            本地服务数据与日志
```

各功能采用小型 MVC。按业务需要设置目录，账户保留身份、资料、设置、归档等子功能内各自的分层。

| 目录 | 职责 |
| --- | --- |
| `model/` | 数据结构、运行状态与资料库 |
| `view/` | Flutter 页面与业务专用组件 |
| `control/` | 业务流程、校验和计算 |
| `requests/` | 对外接口调用与响应适配 |
| `server/` | 归属业务的 Node 服务与 HTTP 契约 |
| `storage/` | 持久化适配、数据库与索引 |

`src/app/` 组合页面，`src/bootstrap/` 从配置创建请求客户端。前端通过各模块的公开 API 访问 Node 服务。命理、合盘和运势的本机计算从同仓的 TypeScript 实现生成 Web Worker 与原生计算资源。共用的报告上限与 HTTP 传输放在 `src/shared/`。

默认启动位置、端口和配置见[模块装配](src/bootstrap/README.md)。业务边界、公共 UI 和提交范围见[协作协议](COLLABORATION.md)。
