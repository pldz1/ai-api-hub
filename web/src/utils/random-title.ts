import i18n, { tr } from "@/i18n";

const emojiList = [
  "😀",
  "😂",
  "😅",
  "😊",
  "😍",
  "😎",
  "😒",
  "😢",
  "😭",
  "😡",
  "😴",
  "🤔",
  "🙄",
  "😷",
  "🤒",
  "🥳",
  "🤯",
  "🤩",
  "🤗",
  "🤫",
  "🤐",
  "😬",
  "😇",
  "😈",
  "👻",
  "💀",
  "👽",
  "👾",
  "🤖",
  "🎃",
  "😺",
  "😸",
  "😹",
  "😻",
  "😼",
  "😽",
  "🙀",
  "😿",
  "😾",
  "🐱",
  "🐶",
  "🐭",
  "🐹",
  "🐰",
  "🦊",
  "🐻",
  "🐼",
  "🐨",
  "🐯",
  "🦁",
  "🐮",
  "🐷",
  "🐽",
  "🐸",
  "🐵",
  "🙈",
  "🙉",
  "🙊",
  "🐒",
  "🐔",
  "🐧",
  "🐦",
  "🐤",
  "🐣",
  "🐥",
  "🦆",
  "🦅",
  "🦉",
  "🦇",
  "🐺",
  "🐗",
  "🐴",
  "🦄",
  "🐝",
  "🐛",
  "🦋",
  "🐌",
  "🐞",
  "🐜",
  "🦟",
  "🦠",
  "🐍",
  "🦎",
  "🦖",
  "🦕",
  "🐙",
  "🦑",
  "🦐",
  "🦞",
  "🦀",
  "🐡",
  "🐠",
  "🐟",
  "🐬",
  "🐳",
  "🐋",
  "🦈",
  "🐊",
  "🐅",
  "🐆",
];

export function generateRandomCname() {
  const randomEmoji = emojiList[Math.floor(Math.random() * emojiList.length)];
  const now = new Date();
  const locale = i18n.global.locale.value || "zh-CN";
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const monthDay = locale.toLowerCase().startsWith("zh") ? `${month}月${day}日` : `${month}/${day}`;
  const time = now.toLocaleTimeString(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }); // 格式为 hh:mm

  return tr("chat.generatedConversationTitle", {
    emoji: randomEmoji,
    monthDay,
    time,
  });
}

/**
 * 字符串增加随机4位字符
 */
export function append4Random(prefix) {
  const randomId = Math.random().toString(36).slice(-4);
  return `${prefix}-${randomId}`;
}
