import markdownIt from "./md-config";
import { buildCodeBlock, deepCloneAndUpdate } from "./code-block";

let _tmpDiv: HTMLDivElement | null = null;

/**
 * Render markdown into an existing element while preserving DOM nodes that did
 * not change. This keeps streaming chat output from flickering on every chunk.
 */
export function renderBlock(className: string, el: HTMLElement, data: string): void {
  if (!_tmpDiv) {
    _tmpDiv = document.createElement("div");
    _tmpDiv.className = className;
  }
  // Render only the current block.
  _tmpDiv.innerHTML = markdownIt.render(data);
  buildCodeBlock(_tmpDiv);
  // Keep each render independent instead of appending previous HTML.
  deepCloneAndUpdate(el, _tmpDiv);
}
