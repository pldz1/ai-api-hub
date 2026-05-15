import markdownIt from "./md-config";
import { buildCodeBlock, deepCloneAndUpdate } from "./code-block";

/**
 * Render markdown into an existing element while preserving DOM nodes that did
 * not change. This keeps streaming chat output from flickering on every chunk.
 */
export function renderBlock(className: string, el: HTMLElement, data: string): void {
  const tmpDiv = document.createElement("div");
  tmpDiv.className = className;
  // Render only the current block.
  tmpDiv.innerHTML = markdownIt.render(data);
  buildCodeBlock(tmpDiv);
  // Keep each render independent instead of appending previous HTML.
  deepCloneAndUpdate(el, tmpDiv);
}
