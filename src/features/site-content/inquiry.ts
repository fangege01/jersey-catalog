type Labels = readonly [en: string, zh: string];

export const inquiryOptions = {
  businessType: {
    wholesaler: ['Wholesaler', '批发商'], retailer: ['Retailer', '零售商'],
    distributor: ['Distributor', '经销商'], team_club: ['Team / Club', '球队 / 俱乐部'],
    brand: ['Brand', '品牌商'], individual: ['Individual Buyer', '个人买家'], other: ['Other', '其他'],
  },
  interest: {
    football_jerseys: ['Football / Soccer Jerseys', '足球球衣'],
    basketball_jerseys: ['Basketball Jerseys', '篮球球衣'],
    baseball_jerseys: ['Baseball Jerseys', '棒球球衣'],
    training_kits: ['Training Kits', '训练服'],
    goalkeeper_jerseys: ['Goalkeeper Jerseys', '守门员球衣'],
    custom_teamwear: ['Custom Teamwear', '定制队服'],
    wholesale_bulk: ['Wholesale / Bulk Purchase', '批发 / 批量采购'],
    customization: ['Customization Options', '个性化定制'],
  },
  estimatedQuantity: {
    '1_19': ['1–19 pieces', '1–19 件'],
    '20_49': ['20–49 pieces', '20–49 件'],
    '50_99': ['50–99 pieces', '50–99 件'],
    '100_499': ['100–499 pieces', '100–499 件'],
    '500_plus': ['500+ pieces', '500 件及以上'],
  },
  orderType: {
    retail: ['Retail', '零售'], wholesale: ['Wholesale', '批发'], custom: ['Custom', '定制'],
  },
} satisfies Record<string, Record<string, Labels>>;

export const inquiryTextFields = {
  name: { label: ['Your Name', '姓名'], max: 100, type: 'text', autocomplete: 'name', required: true },
  company: { label: ['Your Company', '公司'], max: 160, type: 'text', autocomplete: 'organization', required: false },
  email: { label: ['Email', '邮箱'], max: 254, type: 'email', autocomplete: 'email', required: false },
  whatsapp: { label: ['WhatsApp / Phone', 'WhatsApp / 电话'], max: 32, type: 'tel', autocomplete: 'tel', required: false },
  country: { label: ['Country / Region', '国家 / 地区'], max: 100, type: 'text', autocomplete: 'country-name', required: true },
} satisfies Record<string, { label: Labels; max: number; type: 'text' | 'email' | 'tel'; autocomplete: string; required: boolean }>;

export const inquirySelectLabels = {
  businessType: ['Business Type', '客户类型'],
  interest: ['Product of Interest', '意向产品'],
  estimatedQuantity: ['Estimated Order Quantity', '预计采购数量'],
  orderType: ['Order Type', '订单类型'],
} satisfies Record<keyof typeof inquiryOptions, Labels>;

export const MAX_INQUIRY_MESSAGE = 2000;

export function validContactEmail(email: string): boolean {
  return email.length <= 254 && /^[\w.!#$%&'*+/=?^{}~+\x60|\x2D]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email);
}

export function inquiryLabel(field: keyof typeof inquiryOptions, value: string): string {
  const options: Record<string, Labels> = inquiryOptions[field];
  return Object.hasOwn(options, value) ? options[value][1] : '未知';
}

export function readInquiry(params: URLSearchParams) {
  const read = (key: string) => params.get(key)?.trim() ?? '';
  const name = read('name');
  const company = read('company');
  const email = read('email');
  const whatsapp = read('whatsapp');
  const country = read('country');
  const businessType = read('businessType');
  const interest = read('interest');
  const estimatedQuantity = read('estimatedQuantity');
  const orderType = read('orderType');
  const message = read('message');
  const locale = read('locale') === 'zh-CN' ? 'zh-CN' : 'en';

  if (params.has('website') && params.get('website') !== '') return null;
  for (const [key, field] of Object.entries(inquiryTextFields)) {
    const value = read(key);
    if ((field.required && !value) || value.length > field.max || /[\u0000-\u001f\u007f]/.test(value)) return null;
  }
  if ((!email && !whatsapp) || (email && !validContactEmail(email))) return null;
  if (whatsapp && (!/^\+?[\d ().-]+$/.test(whatsapp) || !/^\d{7,15}$/.test(whatsapp.replace(/\D/g, '')))) return null;
  if (!Object.hasOwn(inquiryOptions.businessType, businessType) || !Object.hasOwn(inquiryOptions.interest, interest) ||
      !Object.hasOwn(inquiryOptions.estimatedQuantity, estimatedQuantity) || !Object.hasOwn(inquiryOptions.orderType, orderType) ||
      message.length > MAX_INQUIRY_MESSAGE || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message)) return null;

  return { name, company, email, whatsapp, country, businessType, interest, estimatedQuantity, orderType, message, locale };
}

export const inquiryStatuses = { new: '待处理', handled: '已处理' } as const;
export type InquiryStatus = keyof typeof inquiryStatuses;
export type ContactInquiry = NonNullable<ReturnType<typeof readInquiry>> & {
  id: string;
  status: InquiryStatus;
  receivedAt: number;
};
