export function textToHtml(strData: string): string {
  // Replace line breaks with a non-existent style to ensure seamless toggling back and forth.
  return strData.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br class="__NEW__LINE__"/>');
}
