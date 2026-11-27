# 果冻章鱼 AI 助手

`AIAssistant` 是独立的角色组件。算事页负责摆放它，姿态由调用方通过 `pose` 控制。省略姿态时，角色正面睁眼微笑。

助手以正面为默认姿势，轻轻向左、向右游动后回正。用 `peekDirection` 让助手在屏幕边缘朝聊天区域侧身探头，`1` 朝右，`-1` 朝左。出场的第一帧显示果冻，WebGL 不可用时显示静帧。

```tsx
import { AIAssistant, type AssistantPose } from '../../../ui/ai-assistant';

const wink: AssistantPose = {
  head: { rotation: [0, 0, 0.06] },
  headphones: { translation: [0, 0.02, 0] },
  legs: { legOuterLeft: { rotation: [0, 0, -0.22] } },
  expression: { blinkLeft: 1, blinkRight: 0, smile: 1 },
};

<AIAssistant size={200} pose={wink} />
```

| 控制项 | 节点或参数 | 行为 |
| --- | --- | --- |
| 四条腿 | `legOuterLeft`、`legInnerLeft`、`legInnerRight`、`legOuterRight` | 从正面观察，由左到右排列。每条腿围绕自己的腿根旋转。 |
| 头 | `head` | 脸和耳机跟随头部的变换。 |
| 耳机 | `headphones` | 在头部坐标系中移动整副耳机，头梁和耳罩随动。 |
| 眼睛 | `expression.blinkLeft`、`expression.blinkRight` | 各自从 0（睁眼）连续过渡到 1（闭眼），高光跟随。 |
| 嘴 | `expression.smile` | 从 0（放松）连续过渡到 1（参考图中的微笑）。 |

`rotation` 是相对静止姿势的 XYZ 弧度，`translation` 使用模型单位，`scale` 是局部缩放比例。模型坐标向右为 +X、向上为 +Y、朝镜头为 +Z。更新 `pose` 可以逐帧驱动这些部件。

算事页由停靠手柄接管聊天中的长按和拖动。长按生效后传入 `held`，助手保持惊恐表情，四条腿缓慢左右摆动，直到释放或取消。输入框聚焦且有文字时传入 `listening`，助手保持倾听表情并轻轻游动。减少动态效果模式下保留对应的静止姿态。

`animate` 开启轻晃和待机表情，`playIntro` 让新对话开头额外播放一次 4 秒的出场。出场期间开始输入时，等出场结束再切到倾听。助手进入待机后，每 15 秒随机做一个约 5.5 秒的表情，配合独立的四脚动作，再回到微笑。`paused` 可暂停待机时间轴。表情预设也可以通过 `pose.expression.preset` 单独设置。

出场结束后，算事页通过 `tapCount` 传入轻点手势。每次轻点显示一秒大小眼的生气表情，随后回到当前的待机或倾听状态。

身体与耳机的网格在 `model.ts`，眼睛、高光和嘴在 `face.ts`，参数到节点的映射在 `pose.ts`。网页和手机使用同一套本地场景；无法开启 WebGL 时显示该模型的透明静帧。
