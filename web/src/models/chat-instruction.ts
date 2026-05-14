import { tr } from "@/i18n";

export function getBuiltinChatInsTemplateList() {
  return [
    {
      id: "inst-m77grbkj-aktc-4gj7",
      name: tr("chat.builtinTemplates.translationAssistant.name"),
      value: tr("chat.builtinTemplates.translationAssistant.value"),
    },
    {
      id: "inst-m77greuw-e5up-tqzb",
      name: tr("chat.builtinTemplates.gitEmojiAssistant.name"),
      value: tr("chat.builtinTemplates.gitEmojiAssistant.value"),
    },
  ];
}
