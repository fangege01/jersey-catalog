import { Extension, type CommandProps } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode, ResolvedPos } from '@tiptap/pm/model';
import { checklistPrefixLength } from './richFormat';

function containingList(position: ResolvedPos) {
  for (let depth = position.depth; depth > 0; depth--) {
    const node = position.node(depth);
    if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
      return { node, from: position.before(depth), to: position.after(depth) };
    }
  }
}

export const Checklist = Extension.create({
  name: 'productChecklist',
  addGlobalAttributes() {
    return [{
      types: ['bulletList'],
      attributes: {
        checklist: {
          default: false,
          parseHTML: el => el.classList.contains('fxf-checklist'),
          renderHTML: attrs => attrs.checklist ? { class: 'fxf-checklist' } : {},
        },
      },
    }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _old, state) {
        if (!transactions.some(transaction => transaction.docChanged)) return null;
        const cuts: Array<[number, number]> = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name !== 'paragraph' || !containingList(state.doc.resolve(pos + 1))?.node.attrs.checklist) return;
          let start = pos + 1;
          let text = '';
          let atStart = true;
          const flush = () => {
            const count = checklistPrefixLength(text);
            if (count) cuts.push([start, start + count]);
            text = '';
          };
          node.forEach((inline, offset) => {
            if (inline.type.name === 'hardBreak') {
              flush();
              start = pos + 1 + offset + inline.nodeSize;
              atStart = true;
            } else if (atStart && inline.isText) text += inline.text;
            else if (atStart) { flush(); atStart = false; }
          });
          flush();
        });
        if (!cuts.length) return null;
        const transaction = state.tr;
        for (const [from, to] of cuts.reverse()) transaction.delete(from, to);
        return transaction;
      },
    })];
  },
});

export function toggleChecklist({ tr, state, dispatch }: CommandProps): boolean {
  const { bulletList, listItem, paragraph } = state.schema.nodes;
  const { from, to, $from, $to } = tr.selection;
  const list = containingList($from);
  if (list && containingList($to)?.from === list.from) {
    if (!dispatch) return true;
    if (list.node.attrs.checklist) tr.replaceWith(list.from, list.to, listBlocks(list.node));
    else tr.setNodeMarkup(list.from, bulletList, { checklist: true });
    return true;
  }

  const selected: Array<{ block: ProseMirrorNode; pos: number }> = [];
  tr.doc.forEach((block, pos) => {
    if (pos < to && pos + block.nodeSize > from) selected.push({ block, pos });
  });
  const first = selected[0];
  const last = selected.at(-1);
  if (!first || !last) return false;
  const isChecklist = (block: ProseMirrorNode) => block.type === bulletList && block.attrs.checklist;
  const canWrap = (block: ProseMirrorNode) =>
    block.type === paragraph || block.type.name === 'orderedList' || (block.type === bulletList && !isChecklist(block));
  const end = last.pos + last.block.nodeSize;
  if (!selected.some(({ block }) => canWrap(block))) {
    if (!selected.some(({ block }) => isChecklist(block))) return false;
    if (dispatch) tr.replaceWith(first.pos, end, selected.flatMap(({ block }) => isChecklist(block) ? listBlocks(block) : [block]));
    return true;
  }

  const blocks: ProseMirrorNode[] = [];
  let items: ProseMirrorNode[] = [];
  const finishList = () => {
    if (items.length) blocks.push(bulletList.create({ checklist: true }, items));
    items = [];
  };
  for (const { block } of selected) {
    if (block.type === paragraph) {
      let line: ProseMirrorNode[] = [];
      const addLine = () => {
        items.push(listItem.create(null, paragraph.create(block.attrs, line)));
        line = [];
      };
      block.forEach(inline => {
        if (inline.type.name === 'hardBreak') addLine();
        else line.push(inline);
      });
      addLine();
    } else {
      finishList();
      blocks.push(canWrap(block) ? bulletList.create({ checklist: true }, block.content) : block);
    }
  }
  finishList();
  if (dispatch) tr.replaceWith(first.pos, end, blocks);
  return true;
}

function listBlocks(list: ProseMirrorNode): ProseMirrorNode[] {
  const blocks: ProseMirrorNode[] = [];
  list.forEach(item => item.forEach(block => blocks.push(block)));
  return blocks;
}
