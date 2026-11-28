/** Native drag sorting. Only the grip is draggable, so editing or selecting
 * text anywhere else in a row never starts a reorder. */
export function enableHandleReorder(list: HTMLElement, onReorder: () => void | Promise<unknown>) {
  const rows = () => Array.from(list.children).filter((row): row is HTMLElement => row instanceof HTMLElement);
  let dragging: HTMLElement | null = null;

  for (const row of rows()) {
    const handle = row.querySelector<HTMLElement>('[data-handle]');
    if (!handle) continue;
    handle.draggable = true;
    handle.addEventListener('dragstart', event => {
      if (event.target !== handle || !event.dataTransfer) return;
      dragging = row;
      row.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-fxf-admin-sort', '1');
      const bounds = row.getBoundingClientRect();
      event.dataTransfer.setDragImage(row, event.clientX - bounds.left, event.clientY - bounds.top);
    });
    handle.addEventListener('dragend', () => {
      if (dragging !== row) return;
      row.classList.remove('dragging');
      dragging = null;
    });
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
    const next = rows().find(row => {
      if (row === rowToMove) return false;
      const bounds = row.getBoundingClientRect();
      return event.clientY <= bounds.top + bounds.height / 2;
    }) ?? null;
    if (rowToMove.nextElementSibling === next) return;
    list.insertBefore(rowToMove, next);
    void onReorder();
  });
}
