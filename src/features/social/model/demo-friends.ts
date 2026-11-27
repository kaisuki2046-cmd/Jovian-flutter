import type { DemoFriendSeed } from './conversations';

// Sample contacts and message history from the supplied V11 HTML.
export const demoFriendSeeds = [
  {
    "id": "ping_a",
    "name": "束",
    "online": true,
    "bio": "分享日常，也分享小小好运",
    "colors": [
      "#e8e8e8",
      "#f2f2f2",
      "#919191"
    ],
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "周二 11:08",
        "text": "今天也要开开心心喔！ 🌷"
      },
      {
        "side": "me",
        "kind": "text",
        "time": "周二 11:08",
        "text": "束束爱老虎油🤟\n"
      },
      {
        "side": "other",
        "kind": "text",
        "time": "周二 11:08",
        "text": "么么哒！"
      }
    ]
  },
  {
    "id": "mimi_planet",
    "name": "佳木斯男性",
    "online": false,
    "bio": "今天也有好运呀",
    "colors": [
      "#454545",
      "#b2b2b2",
      "#f1f1f1"
    ],
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "周一 19:03",
        "text": "这个事业建议好实用，我准备试试看～"
      }
    ]
  },
  {
    "id": "qingzi_11",
    "name": "殷",
    "online": false,
    "bio": "最近在看感情主题",
    "colors": [
      "#666666",
      "#b1b1b1",
      "#e6e6e6"
    ],
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "周日 11:28",
        "text": "谢谢分享！我感觉思路清晰多了。"
      }
    ]
  },
  {
    "id": "sora_c",
    "name": "罗",
    "online": false,
    "bio": "有空一起看星星",
    "colors": [
      "#e6e6e6",
      "#f4f4f4",
      "#828282"
    ],
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "昨天 20:15",
        "text": "下次我们可以一起研究一下星盘！"
      },
      {
        "side": "me",
        "kind": "text",
        "time": "昨天 20:18",
        "text": "可以呀～ 等报告功能做好了我分享给你。"
      }
    ]
  },
  {
    "id": "demo_avatar_yu",
    "name": "于",
    "online": false,
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "周日 10:26",
        "text": "你好，很高兴认识你！"
      }
    ]
  },
  {
    "id": "deer_joy",
    "name": "黄",
    "online": false,
    "bio": "喜欢研究星盘",
    "colors": [
      "#3d3d3d",
      "#7f7f7f",
      "#dedede"
    ],
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "昨天 22:47",
        "text": "我也在研究八字耶！你上次说的流年可以继续聊聊吗？"
      }
    ]
  },
  {
    "id": "demo_avatar_zhang",
    "name": "张",
    "online": false,
    "unread": 0,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "周日 10:12",
        "text": "有空再聊呀。"
      }
    ]
  },
  {
    "id": "spring_h",
    "name": "刘",
    "online": true,
    "bio": "春天到了，一起探索新的可能 🌿",
    "colors": [
      "#e8e8e8",
      "#ebebeb",
      "#848484"
    ],
    "unread": 2,
    "thread": [
      {
        "side": "other",
        "kind": "text",
        "time": "09:30",
        "text": "嗨！最近怎么样？想跟你聊聊新计划～"
      },
      {
        "side": "me",
        "kind": "text",
        "time": "09:32",
        "text": "好呀，我最近正在试着整理自己的方向。"
      },
      {
        "side": "other",
        "kind": "text",
        "time": "09:34",
        "text": "对了，之前说的测算报告可以分享给我看看吗？ ✨"
      },
      {
        "side": "me",
        "kind": "text",
        "time": "09:36",
        "text": "刚好！我用玄玄整理了一份小结，想分享给你看看～"
      },
      {
        "side": "other",
        "kind": "text",
        "time": "09:37",
        "text": "好呀，我也很想看看这种报告是什么样子。"
      },
      {
        "side": "me",
        "kind": "text",
        "time": "09:39",
        "text": "我先把演示报告卡片发给你。"
      },
      {
        "side": "me",
        "kind": "report",
        "time": "09:39",
        "report": "all"
      },
      {
        "side": "other",
        "kind": "text",
        "time": "09:41",
        "text": "哇，这样在聊天里直接打开很方便耶 ✨"
      },
      {
        "side": "me",
        "kind": "text",
        "time": "09:42",
        "text": "等正式报告上线，我们再一起研究！"
      },
      {
        "side": "other",
        "kind": "text",
        "time": "09:45",
        "text": "好！你今天忙吗？晚上要不要聊聊别的～"
      }
    ]
  }
] as const satisfies readonly DemoFriendSeed[];
