export interface CreationConversationRepository<TItem, TMessage> {
  list(): TItem[];
  create(id: string, name: string): Promise<void>;
  getMessages(id: string): Promise<TMessage[]>;
  delete(id: string): Promise<void>;
}

export interface CreationConversationState<TItem, TMessage> {
  replaceList(items: TItem[]): void;
  add(item: TItem): void;
  remove(id: string): void;
  setCurrent(id: string): void;
  replaceMessages(id: string, messages: TMessage[]): void;
}

export interface CreationConversationLifecycleOptions<TItem, TMessage> {
  createId(): string;
  createName(name: string): string;
  createItem(id: string, name: string): TItem;
  repository: CreationConversationRepository<TItem, TMessage>;
  state: CreationConversationState<TItem, TMessage>;
}

/**
 * Shares only collection lifecycle. Message shapes, execution, polling and
 * persistence folding stay capability-specific.
 */
export function createCreationConversationLifecycle<TItem, TMessage>(options: CreationConversationLifecycleOptions<TItem, TMessage>) {
  return {
    loadList(): void {
      options.state.replaceList(options.repository.list());
    },

    async create(name = ""): Promise<TItem> {
      const id = options.createId();
      const resolvedName = options.createName(name);
      await options.repository.create(id, resolvedName);
      const item = options.createItem(id, resolvedName);
      options.state.add(item);
      options.state.setCurrent(id);
      options.state.replaceMessages(id, []);
      return item;
    },

    async select(id: string): Promise<TMessage[]> {
      if (!id) {
        options.state.setCurrent("");
        return [];
      }

      try {
        const messages = await options.repository.getMessages(id);
        options.state.setCurrent(id);
        options.state.replaceMessages(id, messages);
        return messages;
      } catch (error) {
        options.state.setCurrent(id);
        options.state.replaceMessages(id, []);
        throw error;
      }
    },

    async remove(id: string): Promise<void> {
      await options.repository.delete(id);
      options.state.remove(id);
    },
  };
}
