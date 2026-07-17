# Persistence

This directory is the typed boundary between application use cases and browser
storage. Feature code imports repositories from `@/persistence`; it does not
know localStorage keys, IndexedDB database names, serialized shapes or `idb:`
references.

`browser/state.ts` owns the small localStorage configuration/index document.
`browser/records.ts` owns Chat, Image and Video message collections in IndexedDB.
`browser/blobs.ts` owns binary and data-URL storage in separate IndexedDB stores.
Image and Video repositories fold large message sources before writing and
expand them when reading.

Repository methods return domain values and throw on failure. They do not return
HTTP-like response envelopes and never mutate Vuex state.
