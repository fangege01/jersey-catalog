/** Native drag sorting. Only the grip is draggable, so editing or selecting
 * text anywhere else in a row never starts a reorder. */
export function enableHandleReorder(
  list: HTMLElement, onReorder: () => void | Promise<unknown>, layout: 'list' | 'grid' = 'list',
) {
  const rows = () => Array.from(list.children).filter((row): row is HTMLElement => row instanceof HTMLElement);
  let dragging: HTMLElement | null = null;

  list.addEventListener('dragstart', event => {
      const handle = event.target;
      if (!(handle instanceof HTMLElement) || !handle.matches('[data-handle]') || !event.dataTransfer) return;
      const row = handle.closest<HTMLElement>('li');
      if (!row || row.parentElement !== list) return;
      dragging = row;
      row.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-fxf-admin-sort', '1');
      const bounds = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(row, event.clientX - bounds.left, event.clientY - bounds.top);
  });
  list.addEventListener('dragend', () => {
      dragging?.classList.remove('dragging');
      dragging = null;
  });
  for (const row of rows()) {
    const handle = row.querySelector<HTMLElement>('[data-handle]');
    if (handle) handle.draggable = true;
  }

  list.addEventListener('dragover', event => {
    if (!dragging) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });
  list.addEventListener('drop', event => {
    if (!dragging) return;
    event.preventDefault();
    // Keep the drop target stable while hovering. Changing the row underneath
    // the pointer during dragover can make the browser cancel a valid drop.
    const rowToMove = dragging;
    rowToMove.classList.remove('dragging');
    dragging = null;
    let next: Element | null;
    if (layout === 'grid') {
      const target = event.target instanceof Element ? event.target.closest('li') : null;
      if (!target || target.parentElement !== list || target === rowToMove) return;
      const bounds = target.getBoundingClientRect();
      next = event.clientX <= bounds.left + bounds.width / 2 ? target : target.nextElementSibling;
    } else {
      next = rows().find(row => {
        if (row === rowToMove) return false;
        const bounds = row.getBoundingClientRect();
        return event.clientY <= bounds.top + bounds.height / 2;
      }) ?? null;
    }
    if (rowToMove === next || rowToMove.nextElementSibling === next) return;
    list.insertBefore(rowToMove, next);
    void onReorder();
  });
}
