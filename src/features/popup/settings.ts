export const defaultPopup = {
  enabled: false,
  delays: [60, 240, 500, 900],
  title: 'Get a jersey quote',
  body: 'Ask us about styles, sizes, and wholesale pricing.',
  button: 'Chat on WhatsApp',
  dismiss: 'Maybe later',
  titleZh: '咨询球衣报价',
  bodyZh: '欢迎咨询款式、尺码和批发价格。',
  buttonZh: '通过 WhatsApp 询价',
  dismissZh: '暂时不用',
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
