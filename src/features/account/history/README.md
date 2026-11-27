# 命理解读归档

## 合盘与运势解读

`/account/reading-history` 提供 `POST` 保存与 `GET` 分页列表，`/latest` 可按 `kind`、`contextKey` 查询最近结果，`/:id` 查询详情。所有操作必须携带当前会话和 `expectedOwnerId`，由账户检查归属；两个板块分别按 `kind=fortune|synastry` 隔离。客户端公开入口为 `saveReadingArchive`、`requestLatestReadingArchive`、`requestReadingArchive`、`listReadingHistory` 和 `useReadingHistory`。

会员结果保存在账户 SQLite，退出再登录后仍可读取；访客结果随访客会话保留，退出或过期后不可用。相同报告重复保存返回同一存档，不覆盖原文；按保存时间和记录顺序分页。运势保留周期、时区、日期范围及关联命盘/报告编号；合盘只存四段解读和生成时间，不附加双方出生资料。

账户使用公共 `ReportText` 渲染命理报告的标题、段落和重点文字。命理归档将正文统一保存在 `overview`。读取旧版 `sections` 时，账户按原顺序将章节标题和段落合入正文后返回，保留原档案 ID 和原存档。

正文和快照使用[公共内容上限](../../../shared/README.md)：报告正文最多 100,000 字符、单段 20,000 字符、依据和盘面详情各 10,000 字符，归档 JSON 请求体最多 16 MiB。前端回读与服务端入库复用同一校验，完整保存通过校验的原文。

命理从账户公开入口 [index.ts](../index.ts) 取得当前归档身份及接口。账户保存 V1 报告、三个盘面的展示摘要和可选的完整盘面快照。命理继续管理解读内容、盘面转换、是否重新测算及自己的展示。

| 公开接口 | 参数及结果 |
| --- | --- |
| `useAccountSession()` | `archiveIdentity` 为 `{ kind: 'member' \| 'guest', id: string }` 或 `null`。同时检查 `archiveIdentityStatus`，其值为 `loading`、`ready`、`none` 或 `unavailable`。 |
| `requestBirthWheelDefaults(signal?)` | 仅对会员本人返回 `{ birthDate, birthTime }`。未知值为空字符串。命理用它设置滚轮默认值，用户仍须确认。 |
| `archiveDestinyReport(expectedOwnerId, report, signal?)` | 保存 V1 报告并返回 `DestinyArchiveReceipt`。快照已持久化时回执增加 `chartSnapshotSaved: true`。同一身份重试同一报告返回同一条记录，保留第一次保存时间。 |
| `requestLatestDestinyArchive(expectedOwnerId, signal?)` | 返回当前身份最近保存的 `HistoryRecord`。没有记录时返回 `null`。 |
| `listDestinyHistory(expectedOwnerId, before?, signal?)` | 返回最多 20 条及 `nextCursor`。下一页把该游标作为 `before` 传入。 |
| `requestDestinyHistoryRecord(expectedOwnerId, id, signal?)` | 按 ID 返回当前身份的完整 `HistoryRecord`。 |

`HistoryEntry` 包含 `id`、毫秒时间戳 `savedAt`、`calculatedAt` 和 `title`。详情与最近报告另有 `report: DestinyArchive`，保留展示摘要、章节及已保存的 `chartSnapshot`。快照随报告保存在同一条 SQLite 记录里，原始候选盘和数值精度随档保留。归档 POST 的 JSON 请求上限为 512 KiB。缺少快照的旧报告和客户端仍可正常读写。

命理发起读写时传当前身份 ID 和 AbortSignal。身份变化或页面离开时中止在途请求，并按 `kind + ':' + id` 清理旧显示状态。渲染结果前再次确认结果仍对应发起请求时的身份。服务端按凭证确认归属，`expectedOwnerId` 用来拒绝与当前凭证身份不符的请求。读取最近报告只读数据库。

| 结果 | 调用方处理 |
| --- | --- |
| `200` 且最新记录为 `null` | 显示开始解读入口 |
| `401` 或客户端 `RequestError.kind === 'auth'` | 凭证缺失、已退出或到期，清除旧报告并重新检查归档身份 |
| `403` | 预期身份与凭证不符，清除旧报告并重新检查会话 |
| `404` | 当前身份下没有该记录或游标 |
| `400` 或 `413` | 参数、报告格式或载荷长度不符合约定 |
| `network`、`timeout` 等请求错误 | 显示读取失败，保存失败时保留当前报告供重试 |

游客明确进入后签发固定 7 天的临时凭证。网页使用 HttpOnly Cookie，原生端使用 SecureStore；同一设备能恢复凭证时可重新读取归档。离线仍可游客浏览，归档状态显示不可用。游客在「个人中心」确认结束体验，或成功登录、注册转为会员时，服务端销毁该游客凭证和对应档案。到期档案立即失去访问权限，账户服务启动、新建游客时以及运行中每小时清理。会员归档随账户保存，连接同一账户服务时可跨设备读取。

「个人中心 → 我的报告」可用当前会员或游客身份查看命理解读历史。「个人中心 → 命理档案」显示最新一次归档的八字、紫微斗数和西方星盘基础数据。命理首页自动恢复最近一次报告、保存失败重试和主动重算入口由命理侧接入。

## 读取完整命盘

从账户公开入口调用 `requestLatestAccountChartSnapshot(expectedOwnerId, signal?)` 或 `requestAccountChartSnapshot(expectedOwnerId, archiveId, signal?)`。使用 `useAccountSession()` 返回的 `archiveIdentity.id`。服务端按当前会员或有效访客会话确定记录归属。无有效会话返回 401，身份不匹配返回 403，指定档案在当前身份下不存在时返回 404。调用方在身份变化时中止请求并清除旧数据。

- `available` 返回 `archiveId`、测算时间 `calculatedAt` 以及 `chartSnapshot`。快照包含八字 `bazi`、紫微 `ziwei` 和西占 `western` 的结构化结果、引擎与规则版本。响应省略解读正文。快照含候选时刻等私人数据，仅用于当前用户授权的业务流程。合盘继续使用下方按比较用途裁剪的接口。
- `missing_snapshot` 表示选中或最近一次档案只有展示摘要，同时返回可供定位的 `archiveId` 和 `calculatedAt`。最近一次档案就是返回对象对应的档案，即使更早的档案有快照。
- `no_archive` 表示当前身份还没有归档。各业务可引导用户先在命理完成一次测算并保存。紫微、西占或八字某套盘面未生成时，该套快照的 `rawResult` 为空。时刻不完整时，`timeKnown` 为 `false`，调用方须把多份结果作为候选处理。

## 合盘读取本人盘面

从账户公开入口调用 `requestLatestSynastrySnapshot(expectedOwnerId, signal?)` 或 `requestSynastrySnapshot(expectedOwnerId, snapshotId, signal?)`。两者分别读取 `GET /account/synastry-chart-snapshots/latest` 和 `GET /account/synastry-chart-snapshots/{snapshotId}`。会员会话决定归属，`expectedOwnerId` 用于检测身份切换。

- `no_archive` 表示当前会员没有归档。最近一次归档只有展示摘要时返回 `missing_snapshot`，同时返回该归档 ID 和测算时间。
- `available` 返回 `snapshot`。`snapshotId` 与不可变的 `archiveId` 相同，可用来固定合盘所用版本。每套盘面给出引擎和规则版本，以及 `complete`、`partial` 或 `unavailable`。
- 时刻不全时，八字只返回候选间一致的柱位字段和神煞，未知字段为 `null`。西占只返回稳定星座，`signIndex` 从白羊座的 0 到双鱼座的 11。紫微只有候选投影一致时才返回单一盘面。
- 新快照可带星曜亮度及其表版本，以及经命理确认的生年四化来源。旧快照缺少来源时保留原有星名和四化标记。
- 上述函数的最后一个可选参数 `includeCalculationContext` 默认关闭。设为 `true` 会携带 `calculationContext=1`，允许读取本人新快照中已确认的分钟级出生 UTC、坐标、IANA 时区及转换口径，以及八字起运规则、顺逆和各运柱的 UTC 半开区间。旧档、时刻未知或输入不足时省略对应字段。
- 默认响应仅返回可比较的盘面和版本。完整候选、儒略日和报告正文仍从各自的原归档入口读取。失效会话返回 `401`，访客或身份不匹配返回 `403`，本人名下没有指定版本时返回 `404`。

> **跨板块协作**　其他板块的代码可以阅读和参考，可通过对方明确开放的入口或公共 UI 复用能力。需要修改认领范围外的文件时，包括其他板块的代码、业务页面和说明文档，须先向用户说明具体文件、原因和影响，取得明确授权后再修改。
