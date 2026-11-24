export const defaultPopup = {
  enabled: false,
  delays: [60, 240, 500, 900],
  title: 'Get the Jersey Catalog on WhatsApp',
  body: 'Chat with us to request the latest jersey catalog and a quote.',
  button: 'Chat on WhatsApp Now',
  dismiss: 'No thanks, I’m just looking',
  titleZh: '添加商家 WhatsApp 获取球衣目录',
  bodyZh: '点击下方按钮，通过 WhatsApp 获取最新球衣目录与报价。',
  buttonZh: '立即 WhatsApp 咨询',
  dismissZh: '暂不需要',
};

export function popupDelays(input: unknown): number[] | null {
  if (!Array.isArray(input) || input.length !== 4 ||
      !input.every((value, index) => Number.isInteger(value) && value >= 5 && value <= 3600 &&
        (index === 0 || value > input[index - 1]))) return null;
  return input;
}

export function readPopup(value?: string) {
  if (!value) return defaultPopup;
  try {
    const data = JSON.parse(value);
    const delays = popupDelays(data?.delays);
    if (!delays) return defaultPopup;
    return {
      enabled: data?.enabled === true,
      delays,
      title: typeof data.title === 'string' ? data.title.slice(0, 100) || defaultPopup.title : defaultPopup.title,
      body: typeof data.body === 'string' ? data.body.slice(0, 400) : '',
      button: typeof data.button === 'string' ? data.button.slice(0, 60) || defaultPopup.button : defaultPopup.button,
      titleZh: typeof data.titleZh === 'string' ? data.titleZh.slice(0, 100) || defaultPopup.titleZh : defaultPopup.titleZh,
      bodyZh: typeof data.bodyZh === 'string' ? data.bodyZh.slice(0, 400) : defaultPopup.bodyZh,
      buttonZh: typeof data.buttonZh === 'string' ? data.buttonZh.slice(0, 60) || defaultPopup.buttonZh : defaultPopup.buttonZh,
      dismissZh: typeof data.dismissZh === 'string' ? data.dismissZh.slice(0, 60) || defaultPopup.dismissZh : defaultPopup.dismissZh,
      dismiss: typeof data.dismiss === 'string' ? data.dismiss.slice(0, 60) || defaultPopup.dismiss : defaultPopup.dismiss,
    };
  } catch {
    return defaultPopup;
  }
}
