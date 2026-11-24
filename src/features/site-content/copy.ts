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
      processKicker: { label: "流程小标题", en: "Order Process", zh: "订单流程", max: 60 },
      processTitle: { label: "流程主标题", en: "How to Order", zh: "如何订购", max: 120,
        legacyDefault: { en: "How to order", "zh-CN": "询价流程" } },
      processIntro: { label: "流程简介", en: "A simple inquiry process for retail, wholesale and custom jersey orders.", zh: "零售、批发和定制球衣订单的询价流程简单便捷。", max: 400 },
      step1Title: { label: "步骤一标题", en: "Share and Confirm Your Requirements", zh: "分享并确认您的需求", max: 120,
        legacyDefault: { en: "Choose your styles", "zh-CN": "选择款式" } },
      step1Text: { label: "步骤一说明", en: "Tell us which products, sizes, quantities, customization and delivery destination you need.", zh: "请告诉我们您需要的产品、尺码、数量、定制要求和交货地点。", max: 600,
        legacyDefault: { en: "Open the product page and check the gallery and specifications.", "zh-CN": "打开商品详情，查看相册和规格。" } },
      step2Title: { label: "步骤二标题", en: "Review the Quote and Order Details", zh: "查看报价和订单详情", max: 120,
        legacyDefault: { en: "Send your requirements", "zh-CN": "发送需求" } },
      step2Text: { label: "步骤二说明", en: "Review the quote and agree on the specifications and options before proceeding.", zh: "继续之前，请仔细核对报价，并就规格和可选方案达成一致。", max: 600,
        legacyDefault: { en: "Share the product, sizes, quantity, and destination on WhatsApp.", "zh-CN": "通过 WhatsApp 告知商品、尺码、数量及收货地。" } },
      step3Title: { label: "步骤三标题", en: "Production or Stock Preparation", zh: "生产或库存准备", max: 120,
        legacyDefault: { en: "Confirm the details", "zh-CN": "确认报价与安排" } },
      step3Text: { label: "步骤三说明", en: "We prepare in-stock items based on confirmed availability and produce custom orders to the agreed requirements.", zh: "现货按确认的库存安排备货，定制订单则按约定要求安排生产。", max: 600,
        legacyDefault: { en: "Confirm availability, customization, and shipping before ordering.", "zh-CN": "下单前确认供应情况、定制方案和运输安排。" } },
      step4Title: { label: "步骤四标题", en: "Quality Check, Packing and Shipping", zh: "质量检查、包装和运输", max: 120 },
      step4Text: { label: "步骤四说明", en: "We check and pack the order, then confirm shipping options, costs and estimated delivery based on quantity, destination and requirements.", zh: "订单经检查和包装后安排发运。我们会根据数量、目的地和具体要求确认运输方式、费用和预计送达时间。", max: 600 },
      faqTitle: { label: "常见问题区标题", en: "Frequently asked questions", zh: "常见问题", max: 120 },
      question1: { label: "问题一", en: "What should I include in a quote request?", zh: "询价时需要提供哪些资料？", max: 120 },
      answer1: { label: "回答一", en: "Send the product link, sizes, quantity, and delivery destination.", zh: "发送商品链接、尺码、数量及收货地区。", max: 600 },
      question2: { label: "问题二", en: "Can I ask about customization?", zh: "可以咨询定制吗？", max: 120 },
      answer2: { label: "回答二", en: "Tell us which names or numbers you want and share a reference if you have one.", zh: "告诉我们需要印制的姓名和号码，有参考图也可发给我们。", max: 600 },
      question3: { label: "问题三", en: "How do I confirm shipping?", zh: "如何确认运输方案？", max: 120 },
      answer3: { label: "回答三", en: "Share your delivery country or postcode to discuss available shipping arrangements.", zh: "提供收货国家或邮编，方便确认可选的运输安排。", max: 600 },
      closingTitle: { label: "底部询盘标题", en: "Ready to discuss your jersey needs?", zh: "想聊聊你的球衣需求？", max: 120 },
      closingBody: { label: "底部询盘说明", en: "Tell us the products, quantities, or customization requirements you need, and our team will help you understand the available options.", zh: "告诉我们你需要的商品、数量或定制要求，我们会帮你了解可选方案。", max: 500 },
      closingBrowse: { label: "查看产品按钮", en: "View Products", zh: "查看产品", max: 80 },
      closingLink: { label: "底部 WhatsApp 按钮", en: "Inquire via WhatsApp", zh: "通过 WhatsApp 询价", max: 120 },
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
    label: "供应与质量", url: "/factory", image: "供应与质量首图",
    fields: {
      title: { label: "页面标题", en: "Supply & Quality", zh: "供应与质量", max: 120 },
      intro: { label: "首屏介绍", en: "Discuss product specifications, sourcing, and quality-check requirements before you order.", zh: "下单前与我们确认商品规格、供应和品质检查要求。", max: 600 },
      body: { label: "供应概览说明", en: "Share the styles and quantities you need, so we can verify availability and discuss how your order will be prepared.", zh: "告诉我们你需要的款式和数量，方便核对供应情况并沟通备货安排。", max: 1600 },
      imageAlt: { label: "首图替代文字", en: "Football jersey supply and preparation", zh: "足球球衣供应和备货", max: 120 },
      panelTitle: { label: "供应概览标题", en: "Supply Overview", zh: "供应概览", max: 120 },
      productionTitle: { label: "生产流程标题", en: "Production Process", zh: "生产流程", max: 120 },
      productionText: { label: "生产流程说明", en: "We confirm specifications, prepare fabric, print and cut, sew, then check and pack the order. The sequence depends on the approved design.", zh: "确认规格并准备面料后，按已确认的设计安排印制、裁剪、缝制、检查和打包。实际流程以确认的设计为准。", max: 600 },
      customizationTitle: { label: "定制选项标题", en: "Customization Options", zh: "定制选项", max: 120 },
      customizationText: { label: "定制选项说明", en: "Share your artwork, reference images or requirements to discuss printing and customization options.", zh: "提供设计稿、参考图片或具体要求，方便沟通印制和定制选项。", max: 600 },
      point1Title: { label: "备货区标题", en: "Stock Preparation", zh: "备货安排", max: 120 },
      point1Text: { label: "备货区说明", en: "We confirm styles, sizes and quantities before arranging stock. Availability is confirmed for each order.", zh: "备货前会核对款式、尺码和数量。具体供应情况以逐单确认为准。", max: 600 },
      warehouseAlt: { label: "备货图替代文字", en: "Individually packed football jerseys grouped by style", zh: "按款式归类的独立包装球衣", max: 120 },
      point2Title: { label: "质量区标题", en: "Quality Requirements", zh: "质量要求", max: 120 },
      point2Text: { label: "质量区说明", en: "We confirm the product specifications, materials and quality-check requirements for each order.", zh: "每笔订单会核对产品规格、面料及品质检查要求。", max: 600 },
      point3Title: { label: "包装与发运标题", en: "Packing and Shipping", zh: "包装与发运", max: 120 },
      point3Text: { label: "包装与发运说明", en: "Packing requirements, shipping methods, costs and estimated timing are agreed according to quantity and destination.", zh: "根据订单数量和目的地确认包装要求、运输方式、费用及预计时效。", max: 600 },
      galleryTitle: { label: "供应实拍标题", en: "Supply in Pictures", zh: "供应实拍", max: 120 },
      galleryText: { label: "供应实拍说明", en: "See how jersey preparation and packing are organized.", zh: "查看球衣准备和分拣包装的照片。", max: 600 },
      audienceTitle: { label: "服务对象标题", en: "Who We Support", zh: "服务对象", max: 120 },
      audienceText: { label: "服务对象说明", en: "We welcome inquiries from individual buyers, clubs, teams, retailers and wholesale customers.", zh: "欢迎个人买家、俱乐部、球队、零售商及批发客户咨询。", max: 600 },
      closingTitle: { label: "底部询盘标题", en: "Let’s discuss your jersey requirements", zh: "一起确认你的球衣采购需求", max: 120 },
      closingText: { label: "底部询盘说明", en: "Share the style, quantity and delivery country so we can discuss your supply options.", zh: "发给我们所需款式、数量和收货国家，我们会和你确认可选的供货方案。", max: 600 },
      quoteLabel: { label: "联系表单按钮", en: "Request a Quote", zh: "提交询盘", max: 80 },
      browseLabel: { label: "商品目录按钮", en: "Browse Jerseys", zh: "查看球衣目录", max: 80 },
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
      kicker: { label: "首屏小标题", en: "Get a quick quote", zh: "快速获取报价", max: 80 },
      intro: { label: "首屏介绍", en: "Tell us which products, quantities, or custom options you need. We’ll get back to you as soon as possible.", zh: "告诉我们你想采购的球衣、数量或定制需求，我们会尽快回复。", max: 600 },
      formTitle: { label: "询价表单标题", en: "Request a Quote", zh: "提交询价", max: 120 },
      formSubmit: { label: "提交按钮", en: "Send Inquiry", zh: "发送询盘", max: 60 },
      fieldName: { label: "姓名字段", en: "Your Name", zh: "姓名", max: 60 },
      fieldCompany: { label: "公司字段", en: "Your Company", zh: "公司", max: 60 },
      fieldEmail: { label: "邮箱字段", en: "Email", zh: "邮箱", max: 60 },
      fieldWhatsapp: { label: "WhatsApp / 电话字段", en: "WhatsApp / Phone", zh: "WhatsApp / 电话", max: 60 },
      fieldCountry: { label: "国家 / 地区字段", en: "Country / Region", zh: "国家 / 地区", max: 60 },
      fieldBusinessType: { label: "企业类型字段", en: "Business Type", zh: "企业类型", max: 60 },
      fieldInterest: { label: "意向产品字段", en: "Product of Interest", zh: "意向产品", max: 60 },
      fieldEstimatedQuantity: { label: "预计采购数量字段", en: "Estimated Order Quantity", zh: "预计采购数量", max: 60 },
      fieldOrderType: { label: "订单类型字段", en: "Order Type", zh: "订单类型", max: 60 },
      fieldMessage: { label: "留言字段", en: "Message", zh: "留言", max: 60 },
      messagePlaceholder: { label: "留言框提示", en: "Message", zh: "留言", max: 100 },
      chooseOption: { label: "下拉框提示", en: "Please select", zh: "请选择", max: 60 },
      floatingSupport: { label: "悬浮 WhatsApp 文字", en: "Online Support", zh: "在线支持", max: 40 },
      floatingEmail: { label: "悬浮邮件入口文字", en: "Email Us", zh: "给我们发邮件", max: 40 },
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
export const imageSections = ['home', 'factory', 'factoryWarehouse', 'about', 'contact'] as const;
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

export function siteImageEditor(section: ImageSection) {
  return section === 'factoryWarehouse' ? 'factory' : section;
}

export function siteImageLabel(section: ImageSection) {
  return section === 'factoryWarehouse' ? '供应与质量备货图' : siteSections[section].image;
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
  const hasFourStepWorkflow = typeof saved.step4Title === 'string' && saved.step4Title.trim() !== '';
  return Object.fromEntries(Object.entries(siteSections[section].fields).map(([key, field]) => {
    const value = saved[key];
    return [key, typeof value === 'string' && value.trim() && value.length <= field.max &&
        (hasFourStepWorkflow || !('legacyDefault' in field) || value !== field.legacyDefault[locale])
      ? value : locale === 'zh-CN' ? field.zh : field.en];
  })) as SiteCopy<T>;
}

export function isInformationPath(path: string): boolean {
  return informationPages.some(section => path === siteSections[section].url || path === siteSections[section].url + '/');
}
