import type { StoreLocale } from '../i18n/locale';

export const siteSections = {
  global: {
    label: "菜单与页脚", url: "/",
    fields: {
      navHome: { label: "首页菜单", en: "Home", zh: "首页", max: 120 },
      navProducts: { label: "产品菜单", en: "Products", zh: "产品", max: 120 },
      navFactory: { label: "供应与质量菜单", en: "Supply & Quality", zh: "供应与质量", max: 120 },
      navAbout: { label: "关于我们菜单", en: "About Us", zh: "关于我们", max: 120 },
      navContact: { label: "联系我们菜单", en: "Contact", zh: "联系我们", max: 120 },
      footer: { label: "页脚介绍", en: "Browse football jerseys for personal orders, teams, and wholesale inquiries.", zh: "浏览足球球衣，咨询个人购买、球队采购与批量报价。", max: 600 },
    },
  },
  home: {
    label: "首页", url: "/", image: "首页首屏图",
    fields: {
      seoTitle: { label: "SEO 标题", en: "Football Jerseys for Retail, Teams and Wholesale", zh: "足球球衣 · 零售、球队与批量采购", max: 120 },
      seoDescription: { label: "SEO 描述", en: "Browse football jerseys for individuals, teams, and wholesale orders. Request a quote on WhatsApp.", zh: "浏览足球球衣，咨询个人购买、球队采购、批量报价和定制。", max: 160 },
      eyebrow: { label: "首屏小标题", en: "Football jerseys", zh: "足球球衣", max: 120 },
      heroTitle: { label: "首屏标题上行", en: "Football kits for", zh: "为个人与球队", max: 120 },
      heroAccent: { label: "首屏标题下行", en: "players and teams", zh: "挑选足球球衣", max: 120 },
      heroIntro: { label: "首屏介绍", en: "Browse jerseys for individual orders, teamwear, and wholesale inquiries. Send us the styles and sizes you need.", zh: "浏览个人购买、球队用服和批量采购款式，告诉我们你需要的款式与尺码。", max: 600 },
      heroAlt: { label: "首屏图片 Alt", en: "Teal and white football jersey design samples", zh: "青绿与白色足球球衣设计样品", max: 120 },
      browseCta: { label: "浏览按钮", en: "Browse jerseys", zh: "浏览球衣", max: 120 },
      quoteCta: { label: "询价按钮", en: "Ask on WhatsApp", zh: "WhatsApp 询价", max: 120 },
      featuredTitle: { label: "精选球衣标题", en: "Featured jerseys", zh: "精选球衣", max: 120 },
      featuredLink: { label: "精选球衣按钮", en: "View the catalog", zh: "查看目录", max: 120 },
      categoryTitle: { label: "分类区标题", en: "Shop by category", zh: "按分类浏览", max: 120 },
      categoryLink: { label: "分类区按钮", en: "View all jerseys", zh: "全部球衣", max: 120 },
      optionsTitle: { label: "采购方式标题", en: "Find the right order option", zh: "选择适合你的采购方式", max: 120 },
      retailTitle: { label: "个人购买标题", en: "Individual orders", zh: "个人购买", max: 120 },
      retailText: { label: "个人购买说明", en: "Explore the catalog and tell us which styles and sizes interest you.", zh: "浏览球衣目录，告诉我们你想了解的款式和尺码。", max: 600 },
      teamTitle: { label: "球队采购标题", en: "Team orders", zh: "球队采购", max: 120 },
      teamText: { label: "球队采购说明", en: "Share your team’s size mix, quantities, and delivery destination.", zh: "提供球队需要的尺码组合、数量和收货地区。", max: 600 },
      wholesaleTitle: { label: "批量采购标题", en: "Wholesale", zh: "批量采购", max: 120 },
      wholesaleText: { label: "批量采购说明", en: "Ask for current availability and a quote for your selected products.", zh: "咨询所选款式的当前供应情况和批量报价。", max: 600 },
      customTitle: { label: "定制服务标题", en: "Customization", zh: "球衣定制", max: 120 },
      customText: { label: "定制服务说明", en: "Send your requirements for names, numbers, or other customization.", zh: "发送姓名、号码等印制需求，确认可选方案。", max: 600 },
      teamCalloutTitle: { label: "球队采购区标题", en: "Plan a team or custom order", zh: "安排球队采购与定制", max: 120 },
      teamCalloutText: { label: "球队采购区说明", en: "Start with the styles you like. Send the sizes, quantities, delivery location, and any printing requirements so we can confirm the options for your team.", zh: "先选好款式，再发来尺码、数量、收货地区和印制要求，我们会与你确认可选方案。", max: 600 },
      teamCalloutLink: { label: "球队采购区按钮", en: "Discuss a team order", zh: "咨询球队采购", max: 120 },
      supplyTitle: { label: "供应与质量区标题", en: "Supply & quality", zh: "供应与质量", max: 120 },
      supplyText: { label: "供应与质量区说明", en: "Confirm specifications, availability, and delivery details before placing your order.", zh: "下单前确认商品规格、供应情况和运输细节。", max: 600 },
      supplyLink: { label: "供应与质量区按钮", en: "Explore supply and quality", zh: "了解供应与质量", max: 120 },
      processTitle: { label: "询价流程标题", en: "How to order", zh: "询价流程", max: 120 },
      step1Title: { label: "步骤一标题", en: "Choose your styles", zh: "选择款式", max: 120 },
      step1Text: { label: "步骤一说明", en: "Open the product page and check the gallery and specifications.", zh: "打开商品详情，查看相册和规格。", max: 600 },
      step2Title: { label: "步骤二标题", en: "Send your requirements", zh: "发送需求", max: 120 },
      step2Text: { label: "步骤二说明", en: "Share the product, sizes, quantity, and destination on WhatsApp.", zh: "通过 WhatsApp 告知商品、尺码、数量及收货地。", max: 600 },
      step3Title: { label: "步骤三标题", en: "Confirm the details", zh: "确认报价与安排", max: 120 },
      step3Text: { label: "步骤三说明", en: "Confirm availability, customization, and shipping before ordering.", zh: "下单前确认供应情况、定制方案和运输安排。", max: 600 },
      faqTitle: { label: "常见问题区标题", en: "Frequently asked questions", zh: "常见问题", max: 120 },
      question1: { label: "问题一", en: "What should I include in a quote request?", zh: "询价时需要提供哪些资料？", max: 120 },
      answer1: { label: "回答一", en: "Send the product link, sizes, quantity, and delivery destination.", zh: "发送商品链接、尺码、数量及收货地区。", max: 600 },
      question2: { label: "问题二", en: "Can I ask about customization?", zh: "可以咨询定制吗？", max: 120 },
      answer2: { label: "回答二", en: "Tell us which names or numbers you want and share a reference if you have one.", zh: "告诉我们需要印制的姓名和号码，有参考图也可发给我们。", max: 600 },
      question3: { label: "问题三", en: "How do I confirm shipping?", zh: "如何确认运输方案？", max: 120 },
      answer3: { label: "回答三", en: "Share your delivery country or postcode to discuss available shipping arrangements.", zh: "提供收货国家或邮编，方便确认可选的运输安排。", max: 600 },
      closingTitle: { label: "底部询价标题", en: "Have a jersey in mind?", zh: "已经选好球衣？", max: 120 },
      closingLink: { label: "底部询价按钮", en: "Get a quote on WhatsApp", zh: "通过 WhatsApp 询价", max: 120 },
      teamTag1: { label: "定制卡片标签一", en: "Names & numbers", zh: "姓名与号码", max: 60 },
      teamTag2: { label: "定制卡片标签二", en: "Size mix", zh: "尺码组合", max: 60 },
      teamTag3: { label: "定制卡片标签三", en: "Team quantities", zh: "球队采购数量", max: 60 },
      emptyFeatured: { label: "精选区暂无商品提示", en: "Jerseys will appear here when published.", zh: "商品上架后会在这里显示。", max: 120 },
    },
  },
  products: {
    label: "产品目录", url: "/products",
    fields: {
      title: { label: "目录标题", en: "Football jersey catalog", zh: "足球球衣目录", max: 120 },
      intro: { label: "目录简介", en: "Browse jersey collections, photos, and specifications.", zh: "浏览球衣款式和分类，进入详情查看图片与规格。", max: 600 },
      seoTitle: { label: "SEO 标题", en: "FXF Football Jersey Catalog", zh: "足球球衣目录", max: 120 },
      seoDescription: { label: "SEO 描述", en: "Browse the football jersey catalog and explore product photos, collections, and specifications.", zh: "浏览足球球衣目录，查看分类、商品照片和规格。", max: 160 },
      allLabel: { label: "全部分类按钮", en: "All jerseys", zh: "全部球衣", max: 120 },
      emptyText: { label: "暂无商品提示", en: "No products yet.", zh: "暂无商品。", max: 600 },
    },
  },
  factory: {
    label: "供应与质量", url: "/factory", image: "供应与质量页配图",
    fields: {
      title: { label: "页面标题", en: "Supply & Quality", zh: "供应与质量", max: 120 },
      intro: { label: "首屏介绍", en: "Discuss product specifications, sourcing, and quality-check requirements before you order.", zh: "下单前与我们确认商品规格、供应和品质检查要求。", max: 600 },
      body: { label: "页面正文", en: "Share the styles and quantities you need, so we can verify availability and discuss how your order will be prepared.", zh: "告诉我们你需要的款式和数量，方便核对供应情况并沟通备货安排。", max: 1600 },
      imageAlt: { label: "配图 Alt", en: "Football jersey supply and preparation", zh: "足球球衣供应和备货", max: 120 },
      panelTitle: { label: "说明区标题", en: "What we confirm with you", zh: "我们与你确认的事项", max: 120 },
      point1Title: { label: "卡片一标题", en: "Supply availability", zh: "供货情况", max: 120 },
      point1Text: { label: "卡片一说明", en: "Confirm the style, size mix, and quantities before quoting.", zh: "报价前确认款式、尺码组合和数量。", max: 600 },
      point2Title: { label: "卡片二标题", en: "Quality requirements", zh: "质量要求", max: 120 },
      point2Text: { label: "卡片二说明", en: "Share any requirements for materials, finish, or customization.", zh: "说明面料、工艺或定制方面的具体要求。", max: 600 },
      point3Title: { label: "卡片三标题", en: "Packing and delivery", zh: "包装与运输", max: 120 },
      point3Text: { label: "卡片三说明", en: "Confirm delivery destination and any packing requirements.", zh: "确认收货地点及包装要求。", max: 600 },
      seoTitle: { label: "SEO 标题", en: "Jersey Supply and Quality", zh: "球衣供应与质量", max: 120 },
      seoDescription: { label: "SEO 描述", en: "Learn how to confirm availability, specifications, quality requirements, and delivery for a jersey order.", zh: "了解球衣供货、规格、品质和运输安排如何确认。", max: 160 },
      cta: { label: "WhatsApp 按钮", en: "Discuss your requirements", zh: "通过 WhatsApp 沟通需求", max: 120 },
    },
  },
  about: {
    label: "关于我们", url: "/about", image: "关于我们页配图",
    fields: {
      title: { label: "页面标题", en: "About Us", zh: "关于我们", max: 120 },
      intro: { label: "首屏介绍", en: "A football jersey catalog for individual buyers, teams, and wholesale inquiries.", zh: "面向个人买家、球队和批量采购客户的足球球衣目录。", max: 600 },
      body: { label: "页面正文", en: "Use the catalog to compare styles and share your requirements with us. We can then discuss which options are available for your order.", zh: "你可以先在目录中对比款式，再把采购要求发给我们，一起确认可选方案。", max: 1600 },
      imageAlt: { label: "配图 Alt", en: "Football jersey collection", zh: "足球球衣款式展示", max: 120 },
      panelTitle: { label: "说明区标题", en: "Who we work with", zh: "适合哪些客户", max: 120 },
      point1Title: { label: "卡片一标题", en: "Individual buyers", zh: "个人买家", max: 120 },
      point1Text: { label: "卡片一说明", en: "Browse individual styles and ask about sizing.", zh: "浏览单件款式并询问尺码。", max: 600 },
      point2Title: { label: "卡片二标题", en: "Clubs and teams", zh: "俱乐部与球队", max: 120 },
      point2Text: { label: "卡片二说明", en: "Discuss matching kits and printing requirements.", zh: "沟通成套球衣、混合尺码和印制需求。", max: 600 },
      point3Title: { label: "卡片三标题", en: "Wholesale buyers", zh: "批量采购客户", max: 120 },
      point3Text: { label: "卡片三说明", en: "Share your size mix and total quantities to request a quote.", zh: "提供尺码组合和总数量以获取报价。", max: 600 },
      seoTitle: { label: "SEO 标题", en: "About FXF", zh: "关于我们的足球球衣目录", max: 120 },
      seoDescription: { label: "SEO 描述", en: "Explore how individual buyers, football teams, and wholesale customers can request jersey information.", zh: "了解个人买家、足球队和批量采购客户如何咨询球衣。", max: 160 },
      cta: { label: "WhatsApp 按钮", en: "Talk to us on WhatsApp", zh: "WhatsApp 联系我们", max: 120 },
    },
  },
  contact: {
    label: "联系我们", url: "/contact", image: "联系页配图",
    fields: {
      title: { label: "页面标题", en: "Contact Us", zh: "联系我们", max: 120 },
      intro: { label: "首屏介绍", en: "Tell us which products, quantities, or custom options you need. We’ll get back to you as soon as possible.", zh: "告诉我们你想采购的球衣、数量或定制需求，我们会尽快回复。", max: 600 },
      formTitle: { label: "询价表单标题", en: "Request a Quote", zh: "提交询价", max: 120 },
      formSubmit: { label: "提交按钮", en: "Send Inquiry", zh: "发送询盘", max: 60 },
      infoTitle: { label: "联系信息标题", en: "Contact Information", zh: "联系信息", max: 120 },
      contactEmail: { label: "联系邮箱（选填）", en: "", zh: "", max: 254, optional: true },
      contactAddress: { label: "联系地址", en: "Guangzhou, Guangdong, China", zh: "中国广东省广州市", max: 160 },
      shippingMethods: { label: "运输方式（逗号分隔）", en: "DHL, FedEx, UPS, Sea Freight, Air Freight", zh: "DHL，FedEx，UPS，海运，空运", max: 160 },
      shippingNote: { label: "运输说明", en: "Shipping method, cost, and estimated delivery time depend on order quantity, destination, and requirements.", zh: "运输方式、费用和预计时效会根据订单数量、目的地和具体要求确认。", max: 600 },
      body: { label: "页面正文", en: "Send us the product link or name and describe what you need. Include your destination so we can discuss delivery options.", zh: "发送商品链接或名称，并说明所需款式和数量。请附上收货地区，方便沟通运输方案。", max: 1600 },
      imageAlt: { label: "配图 Alt", en: "Football jerseys", zh: "足球球衣", max: 120 },
      panelTitle: { label: "说明区标题", en: "What to include in your message", zh: "询价时请提供", max: 120 },
      point1Title: { label: "卡片一标题", en: "Product reference", zh: "商品信息", max: 120 },
      point1Text: { label: "卡片一说明", en: "Include the jersey link or product name.", zh: "附上球衣链接或商品名称。", max: 600 },
      point2Title: { label: "卡片二标题", en: "Sizes and quantities", zh: "尺码与数量", max: 120 },
      point2Text: { label: "卡片二说明", en: "Tell us your sizes, quantity, and any printing requirements.", zh: "说明尺码、数量和印制要求。", max: 600 },
      point3Title: { label: "卡片三标题", en: "Delivery destination", zh: "收货地区", max: 120 },
      point3Text: { label: "卡片三说明", en: "Include your destination country and postcode when available.", zh: "请提供收货国家，有邮编也可一并发来。", max: 600 },
      seoTitle: { label: "SEO 标题", en: "Contact Us on WhatsApp", zh: "联系我们 · WhatsApp 询价", max: 120 },
      seoDescription: { label: "SEO 描述", en: "Contact the football jersey catalog on WhatsApp to ask for product details and a quote.", zh: "通过 WhatsApp 咨询球衣产品信息并获取报价。", max: 160 },
      cta: { label: "WhatsApp 按钮", en: "Start a WhatsApp inquiry", zh: "发起 WhatsApp 询价", max: 120 },
    },
  },
} as const;
export type SiteSection = keyof typeof siteSections;
export type SiteCopy<T extends SiteSection> = Record<keyof typeof siteSections[T]['fields'], string>;
export type SiteCopyKey = `site_content:${SiteSection}:${StoreLocale}`;
export const informationPages = ['factory', 'about', 'contact'] as const;
export type InformationPage = (typeof informationPages)[number];
export const imageSections = ['home', 'factory', 'about', 'contact'] as const;
export type ImageSection = (typeof imageSections)[number];
export type SiteImageKey = `site_image:${ImageSection}`;
export type SiteContentSettings = Partial<Record<SiteCopyKey, string>>;
export type SiteImages = Partial<Record<SiteImageKey, string>>;

export function siteCopyKey(section: SiteSection, locale: StoreLocale): SiteCopyKey {
  return `site_content:${section}:${locale}`;
}

export function siteImageKey(section: ImageSection): SiteImageKey {
  return `site_image:${section}`;
}

export function readSiteCopy<T extends SiteSection>(
  values: SiteContentSettings | undefined, section: T, locale: StoreLocale,
): SiteCopy<T> {
  let saved: Record<string, unknown> = {};
  try {
    const value = JSON.parse(values?.[siteCopyKey(section, locale)] ?? '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
  } catch {
    // A legacy or invalid setting falls back to the theme defaults.
  }
  return Object.fromEntries(Object.entries(siteSections[section].fields).map(([key, field]) => {
    const value = saved[key];
    return [key, typeof value === 'string' && value.trim() && value.length <= field.max
      ? value : locale === 'zh-CN' ? field.zh : field.en];
  })) as SiteCopy<T>;
}

export function isInformationPath(path: string): boolean {
  return informationPages.some(section => path === siteSections[section].url || path === siteSections[section].url + '/');
}
