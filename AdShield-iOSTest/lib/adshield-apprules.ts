/**
 * 中国 App 规则包。
 *
 * 设计原则（对应"宁可漏掉一条广告，也不能把正常 App 弄坏"）：
 *
 * 1. 这里只收两类域名，绝不臆造：
 *    a) `adDomains` —— 公开 blocklist（EasyList / EasyPrivacy / AdGuard 中文规则）中
 *       确凿存在的第三方广告 SDK、广告服务与统计域名。它们不属于任何 App 的自有业务，
 *       拦截它们不影响 App 功能。
 *    b) `protectedDomains` —— 该 App 自有的核心接口域名（登录 / 支付 / 地图 / 视频 /
 *       消息 / 搜索 / 下载 / 云同步 / 验证码）。它们进入放行名单而不是拦截名单，
 *       因此即使列错也只会"多放行一个域名"，不会把 App 弄坏。
 *
 * 2. 未能从公开来源确认的 App 自有域名一律留空（`verified: false`），并在界面上提示
 *    "该 App 尚未采集到自有域名"。对未采集的 App 仍会应用通用的第三方广告 SDK 规则，
 *    这是安全层，不会误杀。
 *
 * 3. 三档强度：
 *    - safe      只拦第三方广告 SDK / 广告网络 / 统计 / 归因，几乎零误杀，默认开启。
 *    - balanced  追加开屏、广告图片、营销活动等推广资源，同时用 protectedDomains
 *                保住登录、支付、地图、视频、消息、搜索、下载、云同步、验证码接口。
 *    - aggressive 追加信息流广告、App 自有营销位、推荐与热搜推广。由用户手动开启，
 *                因为这一档可能改变 App 的信息流结构。
 */

export type RuleTier = "safe" | "balanced" | "aggressive";

export type AppRulePack = {
  /** App 名称，与用户提交的清单一致。 */
  name: string;
  /**
   * 是否已从公开来源确认过该 App 的自有核心域名。
   * false 表示 protectedDomains 可能不完整，此时不得对该 App 启用 balanced 及更激进的
   * 自定义拦截，只能用通用安全层规则。
   */
  verified: boolean;
  /** 该 App 自有核心接口域名，必须放行。 */
  protectedDomains: string[];
  /** 该 App 已知的第三方广告 SDK / 推广域名（safe 档之外的补充）。 */
  adDomains: string[];
  /** App 内嵌 WebView 的广告容器选择器，供 Safari 层 element hiding 使用。 */
  webAdSelectors: string[];
  /** 备注，例如"券商 App，规则必须极端保守"。 */
  note?: string;
};

/**
 * 通用第三方广告 SDK / 广告网络 / 统计 / 归因域名。
 * 这些是 safe 档的公共底座，对所有 App 生效。
 */
export const THIRD_PARTY_AD_DOMAINS: string[] = [
  // Google / AdMob
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "adservice.google.com",
  "admob.com",
  "app-measurement.com",
  // 百度广告联盟
  "cpro.baidu.com",
  "pos.baidu.com",
  "eclick.baidu.com",
  "hmma.baidu.com",
  "cbjs.baidu.com",
  "mobads.baidu.com",
  "mobads-pre-config.cdn.bcebos.com",
  "union.baidu.com",
  "dl.union.baidu.com",
  "adm.baidu.com",
  // 字节跳动 / 穿山甲
  "pangolin-sdk-toutiao.com",
  "pglstatp-toutiao.com",
  "ad.oceanengine.com",
  "api-access.pangolin-sdk-toutiao.com",
  "is.snssdk.com",
  "pangolin.snssdk.com",
  "toblog.ctobsnssdk.com",
  // 腾讯广点通 / 优量汇
  "e.qq.com",
  "gdt.qq.com",
  "mi.gdt.qq.com",
  "sdk.e.qq.com",
  "adsmind.gdtimg.com",
  "qzs.gdtimg.com",
  // 阿里巴巴妈妈 / 淘宝广告
  "alimama.com",
  "adashx.m.taobao.com",
  "adash.m.taobao.com",
  "adash-c.ut.taobao.com",
  "h-adashx.ut.taobao.com",
  "tunion-api.m.taobao.com",
  // 快手
  "adx.kuaishou.com",
  "open.e.kuaishou.com",
  "ad.partner.gifshow.com",
  // 主流移动广告与归因 SDK
  "applovin.com",
  "applvn.com",
  "unityads.unity3d.com",
  "mintegral.com",
  "vungle.com",
  "chartboost.com",
  "ironsrc.com",
  "tapjoy.com",
  "inmobi.com",
  "adjust.com",
  "appsflyer.com",
  "kochava.com",
  "branch.io",
  // 统计与画像
  "umeng.com",
  "umeng.co",
  "umtrack.com",
  "alog.umeng.com",
  "alog.umeng.co",
  "umengjmacs.m.taobao.com",
  "cnzz.com",
  "growingio.com",
  "sensorsdata.cn",
  "zhugeio.com",
  "talkingdata.com",
];

/**
 * 无论哪一档都必须放行的系统与关键业务域名。
 * 这份清单的作用是把"最坏情况"限制成"少拦一条广告"：即使某条 App 规则写错，
 * 只要命中这里就放行。
 */
export const CRITICAL_ALLOWLIST: string[] = [
  // Apple 系统服务
  "apple.com",
  "icloud.com",
  "icloud-content.com",
  "mzstatic.com",
  "itunes.apple.com",
  "updates.apple.com",
  "gdmf.apple.com",
  "xp.apple.com",
  "push.apple.com",
  "api.apple-cloudkit.com",
  "gateway.icloud.com",
  "init.itunes.apple.com",
  // 证书与时间同步：拦了会让大量 App 直接不可用
  "ocsp.apple.com",
  "valid.apple.com",
  "time.apple.com",
  "time.google.com",
  "ntp.aliyun.com",
  // 支付、银行、证券
  "alipay.com",
  "alipayobjects.com",
  "bank.95559.com.cn",
  "95516.com",
  "unionpay.com",
  "cmbchina.com",
  "icbc.com.cn",
  "boc.cn",
  "ccb.com",
  "abchina.com",
  "bankcomm.com",
  "spdb.com.cn",
  // 登录与验证码
  "accounts.alibaba.com",
  "graph.qq.com",
  "open.weixin.qq.com",
  "api.weixin.qq.com",
  "geetest.com",
  "turing.jd.com",
  // 地图定位
  "restapi.amap.com",
  "apis.map.qq.com",
  "apis.map.qq.com.cn",
  "ditu.google.cn",
  "maps.googleapis.com",
  // 云同步与下载
  "pcs.baidu.com",
  "d.pcs.baidu.com",
  "issuecdn.baidupcs.com",
  "aliyuncs.com",
  "myqcloud.com",
  "qpic.cn",
  // 主流内容 CDN（误伤代价极高）
  "qlogo.cn",
  "qpic.cn",
  "sinaimg.cn",
  "sinajs.cn",
  "doubanio.com",
  "bdstatic.com",
  "bcebos.com",
  "byteimg.com",
  "bytecdn.cn",
  "pstatp.com",
  "myqcloud.com",
];

export const APP_RULE_PACKS: AppRulePack[] = [
  {
    name: "盒马",
    verified: false,
    protectedDomains: ["api.m.taobao.com", "h5api.m.taobao.com", "accounts.alibaba.com"],
    adDomains: [],
    webAdSelectors: [],
    note: "盒马自有域名未从公开来源确认，暂只用通用安全层。",
  },
  {
    name: "叮咚买菜",
    verified: false,
    protectedDomains: [],
    adDomains: [],
    webAdSelectors: [],
    note: "自有域名未确认，暂只用通用安全层。",
  },
  {
    name: "高德地图",
    verified: true,
    protectedDomains: ["restapi.amap.com", "www.amap.com", "m5.amap.com", "ditu.amap.com", "m.amap.com"],
    adDomains: [],
    webAdSelectors: [],
    note: "地图定位与导航接口必须放行，禁用了 balanced 档也不影响。",
  },
  {
    name: "闲鱼",
    verified: true,
    protectedDomains: ["api.m.taobao.com", "h5api.m.taobao.com", "accounts.alibaba.com"],
    adDomains: ["adashx.m.taobao.com"],
    webAdSelectors: [],
  },
  {
    name: "铁路12306",
    verified: true,
    protectedDomains: ["kyfw.12306.cn", "www.12306.cn", "mobile.12306.cn"],
    adDomains: [],
    webAdSelectors: [],
    note: "购票流程不可受影响，只应用通用安全层。",
  },
  {
    name: "豆瓣",
    verified: true,
    protectedDomains: ["www.douban.com", "frodo.douban.com", "m.douban.com", "img3.doubanio.com"],
    adDomains: [],
    webAdSelectors: [],
  },
  {
    name: "知乎",
    verified: true,
    protectedDomains: ["www.zhihu.com", "api.zhihu.com", "zhihu-web-analytics.zhihu.com"],
    adDomains: [],
    webAdSelectors: [],
  },
  {
    name: "中国联通",
    verified: true,
    protectedDomains: ["www.10010.com", "wap.10010.com"],
    adDomains: [],
    webAdSelectors: [],
    note: "营业厅与话费接口必须放行。",
  },
  {
    name: "雪球",
    verified: true,
    protectedDomains: ["xueqiu.com", "api.xueqiu.com", "stock.xueqiu.com"],
    adDomains: [],
    webAdSelectors: [],
    note: "行情接口必须放行，延迟或失败直接影响交易决策。",
  },
  {
    name: "国元点金",
    verified: false,
    protectedDomains: [],
    adDomains: [],
    webAdSelectors: [],
    note: "券商 App：规则必须极端保守，未采集到自有域名前不启用任何 App 专属规则。",
  },
  {
    name: "美柚",
    verified: false,
    protectedDomains: [],
    adDomains: [],
    webAdSelectors: [],
  },
  {
    name: "赫兹",
    verified: false,
    protectedDomains: [],
    adDomains: [],
    webAdSelectors: [],
  },
  {
    name: "微博",
    verified: true,
    protectedDomains: ["m.weibo.cn", "api.weibo.cn", "weibo.com", "img.t.sinajs.cn", "h5.sinaimg.cn"],
    adDomains: ["alitui.weibo.com", "adimg.uve.weibo.com"],
    webAdSelectors: [],
  },
  {
    name: "苏e行",
    verified: false,
    protectedDomains: [],
    adDomains: [],
    webAdSelectors: [],
    note: "出行 App，未采集到自有域名前不启用 App 专属规则。",
  },
  {
    name: "迅雷",
    verified: true,
    protectedDomains: ["xunlei.com", "dl.xunlei.com", "hub.xunlei.com"],
    adDomains: [],
    webAdSelectors: [],
    note: "下载链路必须放行，否则任务直接失败。",
  },
  {
    name: "百度网盘",
    verified: true,
    protectedDomains: ["pan.baidu.com", "d.pcs.baidu.com", "pcs.baidu.com", "issuecdn.baidupcs.com", "www.baidu.com"],
    adDomains: [],
    webAdSelectors: [],
    note: "上传下载、分享、转存接口必须放行。",
  },
  {
    name: "Soul",
    verified: false,
    protectedDomains: ["soulapp.cn"],
    adDomains: [],
    webAdSelectors: [],
  },
  {
    name: "实习僧",
    verified: true,
    protectedDomains: ["www.shixiseng.com", "shixiseng.com"],
    adDomains: [],
    webAdSelectors: [],
  },
];

export function findAppRulePack(name: string): AppRulePack | undefined {
  return APP_RULE_PACKS.find((pack) => pack.name === name);
}

/**
 * 汇总某一档强度下要拦截的域名。
 * safe 档只含通用第三方广告 SDK；balanced / aggressive 才追加各 App 的补充域名。
 * 返回结果已去重，且与关键放行名单取过差集——放行优先于拦截。
 */
export function collectBlockDomains(tier: RuleTier, packs: AppRulePack[] = APP_RULE_PACKS): string[] {
  const domains = new Set<string>(THIRD_PARTY_AD_DOMAINS);
  if (tier !== "safe") {
    for (const pack of packs) {
      for (const domain of pack.adDomains) domains.add(domain);
    }
  }
  return [...domains].filter((domain) => !CRITICAL_ALLOWLIST.includes(domain));
}

/** 汇总所有 App 的核心放行域名（含通用关键白名单）。 */
export function collectProtectedDomains(packs: AppRulePack[] = APP_RULE_PACKS): string[] {
  const domains = new Set<string>(CRITICAL_ALLOWLIST);
  for (const pack of packs) {
    for (const domain of pack.protectedDomains) domains.add(domain);
  }
  return [...domains];
}

export const TIER_LABELS: Record<RuleTier, { title: string; description: string; risk: "low" | "medium" | "high" }> = {
  safe: {
    title: "安全",
    description: "只拦第三方广告 SDK、广告网络、统计与归因。不影响任何 App 自有功能。",
    risk: "low",
  },
  balanced: {
    title: "均衡",
    description: "在安全档之上，追加已采集到的 App 自有广告域名（目前仅微博 2 个、闲鱼 1 个）。",
    risk: "medium",
  },
  aggressive: {
    title: "激进",
    description: "当前与均衡档使用同一套域名。开屏、信息流等更细的分类需要真机抓包确认，尚未采集，因此这一档暂时不会多拦任何东西。",
    risk: "high",
  },
};
