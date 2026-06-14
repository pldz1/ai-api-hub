// @ts-nocheck
import hljs from "highlight.js/lib/common";
import { tr } from "@/i18n";
hljs.configure({ ignoreUnescapedHTML: true });

const rootMdDivClassName = "markdown-content";

/**
 * Highlight rendered code blocks.
 */
function highlightCode(element: Element): void {
  const codeEls = element.querySelectorAll("pre code");
  codeEls.forEach((el) => {
    hljs.highlightElement(el);
  });
}

// Global copy handler used by rendered markdown buttons.
window.copyHandler = function (e: MouseEvent): void {
  const btn = e.target as HTMLElement;
  const codeElement = btn.closest(".markdown-content-copy").nextElementSibling;
  if (codeElement?.tagName.toLowerCase() === "code") {
    // Text inside the code block.
    const codeText = codeElement.textContent;
    navigator.clipboard
      .writeText(codeText)
      .then(() => {
        btn.textContent = tr("markdown.copied");

        // Restore the original button text after a short delay.
        setTimeout(() => {
          btn.textContent = tr("markdown.copy");
        }, 2000); // Restore after 2 seconds.
      })
      .catch((err: unknown) => {
        console.error(tr("markdown.copyFailed"), err);
      });
  } else {
    console.error(tr("markdown.codeElementNotFound"));
  }
};

/**
 * Add copy buttons to rendered code blocks.
 */
function buildCopyButton(element: Element): void {
  const pres = element.querySelectorAll("pre");
  if (!pres.length) return;

  pres.forEach((pre) => {
    const codeElem = pre.querySelector("code");
    if (!codeElem) return;

    // Create the copy button.
    const btn = document.createElement("span");
    btn.id = String(Math.random());
    btn.className = "markdown-content-copy";
    btn.textContent = tr("markdown.copy");

    // Attach the inline click handler used by markdown output.
    btn.setAttribute("onclick", "copyHandler(event)");

    // Place the button at the start of the pre element.
    pre.insertBefore(btn, pre.firstChild);
  });
}

/** Prepare rendered markdown content. */
export function buildCodeBlock(element: Element): void {
  highlightCode(element);
  buildCopyButton(element);
}

/** Update markdown DOM nodes without replacing the whole container. */
export function deepCloneAndUpdate(div1: HTMLElement, div2: HTMLElement): void {
  if (div2.innerHTML == "") return;
  // Recursively compare and update child nodes.
  function compareAndUpdate(node1: ChildNode | null, node2: ChildNode): void {
    // Update matching text nodes in place.
    if (node1 && node1.nodeType === Node.TEXT_NODE && node2.nodeType === Node.TEXT_NODE) {
      if (node1.nodeValue !== node2.nodeValue) {
        node1.nodeValue = node2.nodeValue;
      }
      return;
    }

    // Replace missing nodes or nodes with different tags.
    if (!node1 || node1.tagName !== node2.tagName) {
      const newNode = node2.cloneNode(true);
      if (node1) {
        node1.parentNode.replaceChild(newNode, node1);
      } else {
        node2.parentNode.appendChild(newNode);
      }
      return;
    }

    // Update attributes while preserving the root markdown container.
    if (node1.className !== rootMdDivClassName && node1.className !== node2.className) {
      node1.className = node2.className;
    }

    if (node1.id !== rootMdDivClassName && node1.id !== node2.id) {
      node1.id = node2.id;
    }

    if (node1.style.cssText !== node2.style.cssText) {
      node1.style.cssText = node2.style.cssText;
    }

    const children1 = Array.from(node1.childNodes);
    const children2 = Array.from(node2.childNodes);

    // Compare each new child against the current child in the same position.
    children2.forEach((child2, index) => {
      const child1 = children1[index];
      if (!child1) {
        const newChild = child2.cloneNode(true);
        node1.appendChild(newChild);
      } else {
        compareAndUpdate(child1, child2);
      }
    });

    // Remove stale children from the current DOM.
    if (children1.length > children2.length) {
      for (let i = children2.length; i < children1.length; i++) {
        node1.removeChild(children1[i]);
      }
    }
  }

  // Start comparison from the new root.
  compareAndUpdate(div1, div2);
}
