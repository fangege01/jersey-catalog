import { enableHandleReorder } from '../admin/handleReorder';

const form = document.querySelector<HTMLFormElement>('#product-form');
const error = document.querySelector<HTMLElement>('[data-product-save-error]');
const gallery = document.querySelector<HTMLOListElement>('[data-draft-gallery]');
const template = document.querySelector<HTMLTemplateElement>('[data-draft-card]');
const fileInput = document.querySelector<HTMLInputElement>('[data-draft-files]');
const addButton = document.querySelector<HTMLButtonElement>('[data-draft-add]');
const imageMessage = document.querySelector<HTMLElement>('[data-draft-error]');
type Photo = { id: string; url: string; name: string; file?: File; mediaId?: string };
const photos = new Map<string, Photo>();
const cards = () => Array.from(gallery?.querySelectorAll<HTMLLIElement>('li[data-draft-id]') ?? []);

if (gallery && fileInput && addButton && template && imageMessage) {
  const update = () => {
    cards().forEach((card, index) => {
      const badge = card.querySelector('[data-image-order]');
      if (badge) badge.textContent = String(index + 1);
    });
  };
  const add = (photo: Photo) => {
    if (photos.size >= 30) {
      imageMessage.textContent = '新增商品时最多可选 30 张图片。';
      if (photo.file) URL.revokeObjectURL(photo.url);
      return;
    }
    const card = template.content.firstElementChild?.cloneNode(true) as HTMLLIElement;
    card.dataset.draftId = photo.id;
    const img = card.querySelector('img')!;
    img.src = photo.url;
    img.alt = photo.name;
    photos.set(photo.id, photo);
    gallery.appendChild(card);
    update();
  };
  enableHandleReorder(gallery, update, 'grid');
  const stageFiles = () => {
    imageMessage.textContent = '';
    for (const file of fileInput.files ?? []) {
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        imageMessage.textContent = '部分图片未添加。请选择 5 MB 以内的 JPEG、PNG、WebP 或 GIF。';
        continue;
      }
      add({ id: crypto.randomUUID(), url: URL.createObjectURL(file), name: file.name, file });
    }
    fileInput.value = '';
  };
  addButton.hidden = false;
  addButton.addEventListener('click', stageFiles);
  form?.addEventListener('submit', () => {
    if (fileInput.files?.length) stageFiles();
  });
  document.addEventListener('media:selected', (event) => {
    if (!(event.target instanceof Element) || !event.target.closest('[data-media-picker="product-gallery"]')) return;
    const media = (event as CustomEvent<{ id: string; url: string; originalName: string }>).detail;
    if ([...photos.values()].some((photo) => photo.mediaId === media.id)) {
      imageMessage.textContent = '该图片已在商品相册中。';
      return;
    }
    imageMessage.textContent = '';
    add({ id: crypto.randomUUID(), url: media.url, name: media.originalName, mediaId: media.id });
  });
  gallery.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const card = button?.closest<HTMLLIElement>('li[data-draft-id]');
    if (!card) return;
    if (button?.matches('[data-up]') && card.previousElementSibling) {
      gallery.insertBefore(card, card.previousElementSibling);
    } else if (button?.matches('[data-down]') && card.nextElementSibling) {
      gallery.insertBefore(card.nextElementSibling, card);
    } else if (button?.matches('[data-make-primary]')) {
      gallery.insertBefore(card, gallery.firstChild);
    } else if (button?.matches('[data-draft-remove]')) {
      const id = card.dataset.draftId!;
      const photo = photos.get(id);
      document.querySelectorAll<HTMLInputElement>('[data-image-input]').forEach((input) => {
        if (input.value !== id) return;
        const row = input.closest('[data-variant-row]');
        row?.querySelector<HTMLButtonElement>('[data-thumb=""]')?.click();
      });
      if (photo?.file) URL.revokeObjectURL(photo.url);
      photos.delete(id);
      card.remove();
    }
    update();
  });
  form?.addEventListener('formdata', (event) => {
    for (const card of cards()) {
      const id = card.dataset.draftId!;
      const photo = photos.get(id)!;
      event.formData.append('gallery_order', id);
      if (photo.file) event.formData.append('gallery_file_' + id, photo.file);
      if (photo.mediaId) event.formData.append('gallery_media_' + id, photo.mediaId);
      event.formData.append('gallery_filename_' + id, card.querySelector<HTMLTextAreaElement>('[name="image_filename"]')!.value);
      event.formData.append('gallery_alt_' + id, card.querySelector<HTMLTextAreaElement>('[name="alt"]')!.value);
    }
  });
}

document.addEventListener('product:photo-palette', (event) => {
  const palette = (event as CustomEvent<HTMLElement>).detail;
  const choices = palette.firstElementChild;
  const input = palette.parentElement?.querySelector<HTMLInputElement>('[data-image-input]');
  if (!choices || !input) return;
  const currentPhotos = gallery
    ? cards().flatMap((card) => photos.get(card.dataset.draftId!) ?? [])
    : Array.from(document.querySelectorAll<HTMLLIElement>('[data-gallery][data-action] > li')).flatMap((card) => {
        const image = card.querySelector('img');
        const id = card.dataset.imageId;
        return image && id ? [{ id, name: image.alt, url: image.src }] : [];
      });
  choices.querySelectorAll('[data-thumb]:not([data-thumb=""]), [data-photo-placeholder]').forEach((button) => button.remove());
  const main = choices.querySelector<HTMLButtonElement>('[data-thumb=""]');
  if (main) main.dataset.src = currentPhotos[0]?.url ?? '';
  for (const photo of currentPhotos) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.thumb = photo.id;
    button.dataset.src = photo.url;
    button.setAttribute('aria-label', photo.name || '选择图片');
    button.className = 'h-12 w-12 overflow-hidden rounded border border-line hover:border-brand';
    const selected = input.value === photo.id;
    button.setAttribute('aria-pressed', String(selected));
    if (selected) button.classList.add('ring-2', 'ring-brand');
    const image = document.createElement('img');
    image.src = photo.url;
    image.alt = photo.name;
    image.className = 'h-full w-full object-cover';
    button.appendChild(image);
    choices.appendChild(button);
  }
});

if (form && error) {
  let saving = false;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (saving) return;
    saving = true;
    error.hidden = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new FormData(form),
      });
      const result = await response.json() as { location?: string; error?: string };
      if (response.ok && typeof result.location === 'string') {
        location.assign(result.location);
        return;
      }
      throw new Error(result.error || '商品保存失败，请重试。');
    } catch (failure) {
      error.textContent = failure instanceof Error && failure.name !== 'SyntaxError'
        ? failure.message : '商品保存失败，请重试。';
      error.hidden = false;
      error.scrollIntoView({ block: 'center' });
    } finally {
      saving = false;
      form.removeAttribute('aria-busy');
    }
  });
}
