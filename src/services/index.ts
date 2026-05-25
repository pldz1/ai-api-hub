/**
 * Public service surface for views and stores.
 *
 * Keep feature internals behind their directory indexes so callers do not need
 * to know whether a function talks to local storage, a model provider, or the DOM.
 */
export * from "./chat";
export * from "./image";
export * from "./app";
