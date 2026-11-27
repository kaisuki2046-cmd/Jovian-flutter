export default {
  "version": "structured-report-fixture",
  "sources": [
    {
      "id": "SOURCE-L0",
      "type": "product_derived",
      "title": "玄玄合盘三术计算",
      "locator": "src/features/synastry/control/compare.ts 与同目录的三术事实规则 · synastry-facts-v2/v3",
      "rights": "project_original",
      "usage": "derived_rule"
    },
    {
      "id": "SOURCE-PRODUCT",
      "type": "product_derived",
      "title": "玄玄合盘解读层建设规范",
      "locator": "第 2 节与第 5–7 节，场景和边界参考；示例待审核",
      "rights": "citation_only",
      "usage": "metadata_only"
    },
    {
      "id": "SOURCE-IZTRO-TERMS",
      "type": "website",
      "title": "iztro 紫微研习社",
      "locator": "Palaces 与 The four transformations in Zi Wei Dou Shu · https://www.iztro.com/en_US/learn/mutagen",
      "rights": "citation_only",
      "usage": "metadata_only",
      "author": "紫微研习社",
      "url": "https://www.iztro.com/en_US/learn/mutagen"
    }
  ],
  "entries": [
    {
      "id": "BAZI-DAY-BRANCH-UNION",
      "system": "bazi",
      "factRule": "branch-union",
      "ruleVersions": [
        "synastry-facts-v2",
        "synastry-facts-v3"
      ],
      "schoolId": "xuanxuan-bazi-product-draft",
      "chartRulesets": [
        "utc8-jie-local-civil-late-zi-next-v1"
      ],
      "theme": "daily_rhythm",
      "polarity": "supportive",
      "coreMeaning": "双方日支形成六合。",
      "rationale": "按引擎确认的双日支六合，独立考察伴侣日常安排是否容易衔接。",
      "scenes": {
        "romance": {
          "interpretation": "相处时，可以观察双方在哪些生活习惯上容易互相配合。",
          "manifestations": [
            "安排共同作息时，双方较容易找到都能接受的时段。"
          ]
        }
      },
      "conditions": [
        {
          "id": "facts-aPosition",
          "field": "facts.aPosition",
          "operator": "eq",
          "expected": "day",
          "description": "A 方发生于日支",
          "required": true
        },
        {
          "id": "facts-bPosition",
          "field": "facts.bPosition",
          "operator": "eq",
          "expected": "day",
          "description": "B 方发生于日支",
          "required": true
        }
      ],
      "exclusions": [],
      "mitigatingFactors": [],
      "aggravatingFactors": [],
      "limitations": [
        "仅适用于双日支，仍需核对同主题的其他依据。"
      ],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-PRODUCT"
      ],
      "reasoning": [
        {
          "conditionIds": [
            "facts-aPosition",
            "facts-bPosition"
          ],
          "meaning": "先确认结构化盘面关系和双方位置，再按条目声明的关系语境解释。",
          "sourceIds": [
            "SOURCE-L0",
            "SOURCE-PRODUCT"
          ]
        }
      ],
      "reviewStatus": "draft",
      "version": "1.0.0",
      "createdAt": "2026-11-16",
      "updatedAt": "2026-11-16",
      "aliases": [
        "日支六合",
        "六合"
      ]
    },
    {
      "id": "WEST-MERCURY-SQUARE",
      "system": "western",
      "factRule": "western-cross-aspect",
      "ruleVersions": [
        "synastry-facts-v2",
        "synastry-facts-v3"
      ],
      "schoolId": "xuanxuan-western-product-draft",
      "chartRulesets": [
        "tropical-whole-sign-v1"
      ],
      "theme": "communication",
      "polarity": "challenging",
      "coreMeaning": "双方Mercury与Mercury的跨盘相位为 90°。",
      "rationale": "按双盘黄经最短弧得到的实际角距、偏差和容许度确认相位。",
      "scenes": {
        "friendship": {
          "interpretation": "聊到有分歧的话题时，可以先复述对方的观点，确认彼此理解一致。",
          "manifestations": [
            "朋友聊天时，同一个说法可能被听成不同的意思。"
          ]
        },
        "collaboration": {
          "interpretation": "项目讨论中，重要决定可以用书面结论和下一步责任人复核。",
          "manifestations": [
            "讨论结束后，双方可能对同一句承诺有不同理解。"
          ]
        }
      },
      "conditions": [
        {
          "id": "facts-aPlanet",
          "field": "facts.aPlanet",
          "operator": "eq",
          "expected": "Mercury",
          "description": "A 方天体匹配",
          "required": true
        },
        {
          "id": "facts-bPlanet",
          "field": "facts.bPlanet",
          "operator": "eq",
          "expected": "Mercury",
          "description": "B 方天体匹配",
          "required": true
        },
        {
          "id": "facts-angle",
          "field": "facts.angle",
          "operator": "eq",
          "expected": 90,
          "description": "相位角匹配",
          "required": true
        },
        {
          "id": "degrees-min",
          "field": "facts.degrees",
          "operator": "gte",
          "expected": 0,
          "description": "角距至少为零",
          "required": true
        },
        {
          "id": "degrees-max",
          "field": "facts.degrees",
          "operator": "lte",
          "expected": 180,
          "description": "角距不超过半圆",
          "required": true
        },
        {
          "id": "deviation-min",
          "field": "facts.deviation",
          "operator": "gte",
          "expected": 0,
          "description": "相位偏差至少为零",
          "required": true
        },
        {
          "id": "orb-limit",
          "field": "facts.deviation",
          "operator": "lte",
          "expectedField": "facts.orb",
          "description": "实际偏差落在当前计算容许度内",
          "required": true
        }
      ],
      "exclusions": [],
      "mitigatingFactors": [],
      "aggravatingFactors": [],
      "limitations": [
        "仅适用于热带黄道整宫制的本期盘面；没有入相或出相结论。"
      ],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-PRODUCT"
      ],
      "reasoning": [
        {
          "conditionIds": [
            "facts-aPlanet",
            "facts-bPlanet",
            "facts-angle",
            "degrees-min",
            "degrees-max",
            "deviation-min",
            "orb-limit"
          ],
          "meaning": "先确认结构化盘面关系和双方位置，再按条目声明的关系语境解释。",
          "sourceIds": [
            "SOURCE-L0",
            "SOURCE-PRODUCT"
          ]
        }
      ],
      "reviewStatus": "draft",
      "version": "1.0.0",
      "createdAt": "2026-11-16",
      "updatedAt": "2026-11-16",
      "aliases": [
        "水星四分相",
        "Mercury square Mercury",
        "四分相"
      ],
      "factPatternId": "western:western-cross-aspect:Mercury:Mercury:90"
    },
    {
      "id": "WEST-VENUS-MARS-SEXTILE",
      "system": "western",
      "factRule": "western-cross-aspect",
      "ruleVersions": [
        "synastry-facts-v2",
        "synastry-facts-v3"
      ],
      "schoolId": "xuanxuan-western-product-draft",
      "chartRulesets": [
        "tropical-whole-sign-v1"
      ],
      "theme": "attraction",
      "polarity": "supportive",
      "coreMeaning": "双方Venus与Mars的跨盘相位为 60°。",
      "rationale": "按双盘黄经最短弧得到的实际角距、偏差和容许度确认相位。",
      "scenes": {
        "romance": {
          "interpretation": "可以观察一方主动表达好感时，另一方是否容易理解并作出回应。",
          "manifestations": [
            "日常相处中，主动邀约与回应的节奏可能较容易协调。"
          ]
        }
      },
      "conditions": [
        {
          "id": "facts-aPlanet",
          "field": "facts.aPlanet",
          "operator": "eq",
          "expected": "Venus",
          "description": "A 方天体匹配",
          "required": true
        },
        {
          "id": "facts-bPlanet",
          "field": "facts.bPlanet",
          "operator": "eq",
          "expected": "Mars",
          "description": "B 方天体匹配",
          "required": true
        },
        {
          "id": "facts-angle",
          "field": "facts.angle",
          "operator": "eq",
          "expected": 60,
          "description": "相位角匹配",
          "required": true
        },
        {
          "id": "degrees-min",
          "field": "facts.degrees",
          "operator": "gte",
          "expected": 0,
          "description": "角距至少为零",
          "required": true
        },
        {
          "id": "degrees-max",
          "field": "facts.degrees",
          "operator": "lte",
          "expected": 180,
          "description": "角距不超过半圆",
          "required": true
        },
        {
          "id": "deviation-min",
          "field": "facts.deviation",
          "operator": "gte",
          "expected": 0,
          "description": "相位偏差至少为零",
          "required": true
        },
        {
          "id": "orb-limit",
          "field": "facts.deviation",
          "operator": "lte",
          "expectedField": "facts.orb",
          "description": "实际偏差落在当前计算容许度内",
          "required": true
        }
      ],
      "exclusions": [],
      "mitigatingFactors": [],
      "aggravatingFactors": [],
      "limitations": [
        "仅适用于热带黄道整宫制的本期盘面；没有入相或出相结论。"
      ],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-PRODUCT"
      ],
      "reasoning": [
        {
          "conditionIds": [
            "facts-aPlanet",
            "facts-bPlanet",
            "facts-angle",
            "degrees-min",
            "degrees-max",
            "deviation-min",
            "orb-limit"
          ],
          "meaning": "先确认结构化盘面关系和双方位置，再按条目声明的关系语境解释。",
          "sourceIds": [
            "SOURCE-L0",
            "SOURCE-PRODUCT"
          ]
        }
      ],
      "reviewStatus": "draft",
      "version": "1.0.0",
      "createdAt": "2026-11-16",
      "updatedAt": "2026-11-16",
      "aliases": [
        "金火六合相",
        "Venus sextile Mars"
      ],
      "factPatternId": "western:western-cross-aspect:Venus:Mars:60"
    },
    {
      "id": "WEST-MOON-OPPOSITION",
      "system": "western",
      "factRule": "western-cross-aspect",
      "ruleVersions": [
        "synastry-facts-v2",
        "synastry-facts-v3"
      ],
      "schoolId": "xuanxuan-western-product-draft",
      "chartRulesets": [
        "tropical-whole-sign-v1"
      ],
      "theme": "emotional_exchange",
      "polarity": "challenging",
      "coreMeaning": "双方Moon与Moon的跨盘相位为 180°。",
      "rationale": "按双盘黄经最短弧得到的实际角距、偏差和容许度确认相位。",
      "scenes": {
        "family": {
          "interpretation": "遇到家中压力时，可以先确认对方需要陪伴、安静还是实际帮助。",
          "manifestations": [
            "家人遇到困扰时，双方可能给出不同类型的回应。"
          ]
        },
        "romance": {
          "interpretation": "发生分歧时，可以分别说清自己需要的情绪回应。",
          "manifestations": [
            "伴侣中一方可能希望立即交流，另一方可能需要缓冲时间。"
          ]
        }
      },
      "conditions": [
        {
          "id": "facts-aPlanet",
          "field": "facts.aPlanet",
          "operator": "eq",
          "expected": "Moon",
          "description": "A 方天体匹配",
          "required": true
        },
        {
          "id": "facts-bPlanet",
          "field": "facts.bPlanet",
          "operator": "eq",
          "expected": "Moon",
          "description": "B 方天体匹配",
          "required": true
        },
        {
          "id": "facts-angle",
          "field": "facts.angle",
          "operator": "eq",
          "expected": 180,
          "description": "相位角匹配",
          "required": true
        },
        {
          "id": "degrees-min",
          "field": "facts.degrees",
          "operator": "gte",
          "expected": 0,
          "description": "角距至少为零",
          "required": true
        },
        {
          "id": "degrees-max",
          "field": "facts.degrees",
          "operator": "lte",
          "expected": 180,
          "description": "角距不超过半圆",
          "required": true
        },
        {
          "id": "deviation-min",
          "field": "facts.deviation",
          "operator": "gte",
          "expected": 0,
          "description": "相位偏差至少为零",
          "required": true
        },
        {
          "id": "orb-limit",
          "field": "facts.deviation",
          "operator": "lte",
          "expectedField": "facts.orb",
          "description": "实际偏差落在当前计算容许度内",
          "required": true
        }
      ],
      "exclusions": [],
      "mitigatingFactors": [],
      "aggravatingFactors": [],
      "limitations": [
        "仅适用于热带黄道整宫制的本期盘面；没有入相或出相结论。"
      ],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-PRODUCT"
      ],
      "reasoning": [
        {
          "conditionIds": [
            "facts-aPlanet",
            "facts-bPlanet",
            "facts-angle",
            "degrees-min",
            "degrees-max",
            "deviation-min",
            "orb-limit"
          ],
          "meaning": "先确认结构化盘面关系和双方位置，再按条目声明的关系语境解释。",
          "sourceIds": [
            "SOURCE-L0",
            "SOURCE-PRODUCT"
          ]
        }
      ],
      "reviewStatus": "draft",
      "version": "1.0.0",
      "createdAt": "2026-11-16",
      "updatedAt": "2026-11-16",
      "factPatternId": "western:western-cross-aspect:Moon:Moon:180"
    },
    {
      "id": "ZIWEI-PALACE-STEM-CAREER-FLIGHT",
      "system": "ziwei",
      "factRule": "ziwei-palace-stem-flight-overlay",
      "ruleVersions": [
        "synastry-facts-v3"
      ],
      "schoolId": "iztro-branch-overlay-v1",
      "chartRulesets": [
        "standard-new-year-leap-split-late-zi-current-v1"
      ],
      "version": "1.0.0",
      "reviewStatus": "draft",
      "theme": "responsibility",
      "polarity": "neutral",
      "coreMeaning": "一方命宫宫干引动的星曜在本盘有明确落点，该落点在对方盘对应官禄宫。",
      "rationale": "此条由带盘位与版本的结构化事实触发，场景文案另行核对。",
      "scenes": {
        "collaboration": {
          "interpretation": "可核对责任边界中最容易产生重复投入或反复确认的地方。",
          "manifestations": [
            "同一项任务是否被双方同时认领或都以为由对方负责。"
          ]
        }
      },
      "conditions": [
        {
          "id": "ZIWEI-PALACE-STEM-CAREER-FLIGHT-C1",
          "field": "facts.source",
          "operator": "eq",
          "expected": "命宫",
          "description": "由原盘命宫宫干发起",
          "required": true
        },
        {
          "id": "ZIWEI-PALACE-STEM-CAREER-FLIGHT-C2",
          "field": "facts.marker",
          "operator": "eq",
          "expected": "忌",
          "description": "为该宫干化忌",
          "required": true
        },
        {
          "id": "ZIWEI-PALACE-STEM-CAREER-FLIGHT-C3",
          "field": "facts.target",
          "operator": "in",
          "expected": [
            "官禄",
            "官禄宫"
          ],
          "description": "投影到对方官禄宫",
          "required": true
        }
      ],
      "exclusions": [],
      "reasoning": [
        {
          "meaning": "一方命宫宫干引动的星曜在本盘有明确落点，该落点在对方盘对应官禄宫。",
          "conditionIds": [
            "ZIWEI-PALACE-STEM-CAREER-FLIGHT-C1",
            "ZIWEI-PALACE-STEM-CAREER-FLIGHT-C2",
            "ZIWEI-PALACE-STEM-CAREER-FLIGHT-C3"
          ],
          "sourceIds": [
            "SOURCE-L0",
            "SOURCE-IZTRO-TERMS"
          ]
        }
      ],
      "mitigatingFactors": [],
      "aggravatingFactors": [],
      "limitations": [
        "飞化先在原盘定位，跨盘只对照该落点地支。须使用原盘配置的宫干和四化表。"
      ],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-IZTRO-TERMS"
      ],
      "createdAt": "2026-11-16",
      "updatedAt": "2026-11-16",
      "aliases": [
        "宫干飞化"
      ]
    },
    {
      "id": "WEST-VENUS-DSC-CONJUNCTION",
      "system": "western",
      "factRule": "western-planet-to-axis",
      "ruleVersions": [
        "synastry-facts-v3"
      ],
      "schoolId": "western-traditional-domicile-v1",
      "chartRulesets": [
        "tropical-whole-sign-v1"
      ],
      "version": "1.0.0",
      "reviewStatus": "draft",
      "theme": "attraction",
      "polarity": "neutral",
      "coreMeaning": "一方金星与另一方下降点黄经成合相。",
      "rationale": "此条由带盘位与版本的结构化事实触发，场景文案另行核对。",
      "scenes": {
        "romance": {
          "interpretation": "可观察双方怎样表达欣赏，以及对伴侣互动有什么具体期待。",
          "manifestations": [
            "表达好感的方式是否能被对方识别和接受。"
          ]
        }
      },
      "conditions": [
        {
          "id": "WEST-VENUS-DSC-CONJUNCTION-C1",
          "field": "facts.planet",
          "operator": "eq",
          "expected": "Venus",
          "description": "取金星",
          "required": true
        },
        {
          "id": "WEST-VENUS-DSC-CONJUNCTION-C2",
          "field": "facts.axis",
          "operator": "eq",
          "expected": "DSC",
          "description": "目标为下降点",
          "required": true
        },
        {
          "id": "WEST-VENUS-DSC-CONJUNCTION-C3",
          "field": "facts.angle",
          "operator": "eq",
          "expected": 0,
          "description": "目标相位角为 0°",
          "required": true
        },
        {
          "id": "WEST-VENUS-DSC-CONJUNCTION-C4",
          "field": "facts.deviation",
          "operator": "lte",
          "expectedField": "facts.orb",
          "description": "相位偏差在容许度以内",
          "required": true
        }
      ],
      "exclusions": [],
      "reasoning": [
        {
          "meaning": "一方金星与另一方下降点黄经成合相。",
          "conditionIds": [
            "WEST-VENUS-DSC-CONJUNCTION-C1",
            "WEST-VENUS-DSC-CONJUNCTION-C2",
            "WEST-VENUS-DSC-CONJUNCTION-C3",
            "WEST-VENUS-DSC-CONJUNCTION-C4"
          ],
          "sourceIds": [
            "SOURCE-L0"
          ]
        }
      ],
      "mitigatingFactors": [],
      "aggravatingFactors": [],
      "limitations": [
        "相位依赖双方出生时间、实际度数和本规则容许度，关系结果仍需结合实际互动。"
      ],
      "sourceIds": [
        "SOURCE-L0"
      ],
      "createdAt": "2026-11-16",
      "updatedAt": "2026-11-16"
    }
  ],
  "variants": [
    {
      "id": "WEST-MERCURY-SQUARE:friendship",
      "knowledgeId": "WEST-MERCURY-SQUARE",
      "relationshipType": "friendship",
      "theme": "communication",
      "polarity": "challenging",
      "interpretation": "聊到有分歧的话题时，可以先复述对方的观点，确认彼此理解一致。",
      "manifestations": [
        "朋友聊天时，同一个说法可能被听成不同的意思。"
      ],
      "practicalGuidance": [],
      "limitations": [],
      "conditions": [],
      "exclusions": [],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-PRODUCT"
      ],
      "reviewStatus": "draft",
      "version": "1.0.0"
    },
    {
      "id": "WEST-MERCURY-SQUARE:collaboration",
      "knowledgeId": "WEST-MERCURY-SQUARE",
      "relationshipType": "collaboration",
      "theme": "communication",
      "polarity": "challenging",
      "interpretation": "项目讨论中，重要决定可以用书面结论和下一步责任人复核。",
      "manifestations": [
        "讨论结束后，双方可能对同一句承诺有不同理解。"
      ],
      "practicalGuidance": [],
      "limitations": [],
      "conditions": [],
      "exclusions": [],
      "sourceIds": [
        "SOURCE-L0",
        "SOURCE-PRODUCT"
      ],
      "reviewStatus": "draft",
      "version": "1.0.0"
    }
  ],
  "combinations": {
    "version": "fixture",
    "rules": [
      {
        "id": "CROSS-BRANCH-UNION-MOON-OPPOSITION",
        "systemScope": "cross_system",
        "interaction": "contradicts",
        "requiredKnowledgeIds": [
          "BAZI-DAY-BRANCH-UNION",
          "WEST-MOON-OPPOSITION"
        ],
        "relationshipTypes": [
          "romance"
        ],
        "themeIds": [
          "daily_rhythm"
        ],
        "conditions": [],
        "explanation": "八字日支配合与月亮对分的情绪节奏信号并存。报告应分别说明各自适用的互动情境。",
        "limitations": [
          "两种术数含义各有适用范围。"
        ],
        "sourceIds": [
          "SOURCE-L0",
          "SOURCE-PRODUCT"
        ],
        "reviewStatus": "draft",
        "version": "1.0.0"
      }
    ]
  }
};
