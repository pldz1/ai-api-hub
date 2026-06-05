import MarkdownIt from "markdown-it";
import emoji from "markdown-it-emoji";
import deflist from "markdown-it-deflist";
import footnote from "markdown-it-footnote";
import ins from "markdown-it-ins";
import mark from "markdown-it-mark";
import taskLists from "markdown-it-task-lists";
import container from "markdown-it-container";
import toc from "markdown-it-toc-done-right";

type MarkdownToken = {
  attrIndex(name: string): number;
  attrPush(attrData: [string, string]): void;
  attrs: [string, string][];
};

/**
 * Add external-link behavior to rendered markdown links.
 */
function addTargetBlankToLinks(markdownIt: MarkdownIt): void {
  const defaultRender =
    markdownIt.renderer.rules.link_open ||
    function (tokens: MarkdownToken[], idx: number, options: MarkdownIt.Options, env: unknown, self: MarkdownIt.Renderer) {
      return self.renderToken(tokens, idx, options);
    };

  markdownIt.renderer.rules.link_open = function (tokens: MarkdownToken[], idx: number, options: MarkdownIt.Options, env: unknown, self: MarkdownIt.Renderer) {
    // Add target="_blank" to every rendered link.
    const aIndex = tokens[idx].attrIndex("target");
    if (aIndex < 0) {
      tokens[idx].attrPush(["target", "_blank"]);
    } else {
      tokens[idx].attrs[aIndex][1] = "_blank";
    }
    return defaultRender(tokens, idx, options, env, self);
  };
}

var config = {
  html: true,
  xhtmlOut: true,
  breaks: true,
  langPrefix: "lang-",
  linkify: false,
  typographer: true,
  quotes: "“”‘’",
};

let markdownIt = new MarkdownIt(config);

markdownIt
  .use(emoji)
  .use(deflist)
  .use(footnote)
  .use(ins)
  .use(mark)
  .use(taskLists)
  .use(container)
  .use(container, "hljs-left")
  .use(container, "hljs-center")
  .use(container, "hljs-right")
  .use(toc);

addTargetBlankToLinks(markdownIt);

export default markdownIt;
