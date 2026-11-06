import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import "fake-indexeddb/auto"; // provides IDBRequest etc. as globals
import { createStore, bookId } from "../../src/storage.js";

let store, idb;
beforeEach(() => {
  idb = new IDBFactory(); // fresh, empty "browser" for every test
  store = createStore(idb);
});

const bytes = s => new TextEncoder().encode(s).buffer;

describe("books", () => {
  it("saves a book once; saving it again does not overwrite or duplicate it", async () => {
    expect(await store.saveBook({ id: "a", data: bytes("v1"), title: "书" })).toBe(true);
    expect(await store.saveBook({ id: "a", data: bytes("v2"), title: "书" })).toBe(false);
    expect(await store.countBooks()).toBe(1);
    const book = await store.getBook("a");
    expect(new TextDecoder().decode(book.data)).toBe("v1");
    expect(book.title).toBe("书");
  });
  it("returns nothing for an unknown book", async () => {
    expect(await store.getBook("nope")).toBeUndefined();
  });
});

describe("positions, locations, last book, settings", () => {
  it("keeps one position per book, latest wins", async () => {
    await store.savePosition("a", { cfi: "epubcfi(/6/2!/4/2/1:0)", percent: 0.1 });
    await store.savePosition("a", { cfi: "epubcfi(/6/6!/4/2/1:0)", percent: 0.4 });
    await store.savePosition("b", { cfi: "epubcfi(/6/4!/4/2/1:0)" });
    expect((await store.getPosition("a")).cfi).toBe("epubcfi(/6/6!/4/2/1:0)");
    expect((await store.getPosition("a")).percent).toBe(0.4);
    expect((await store.getPosition("b")).cfi).toBe("epubcfi(/6/4!/4/2/1:0)");
  });
  it("caches the progress table", async () => {
    expect(await store.getLocations("a")).toBeNull();
    await store.saveLocations("a", '["epubcfi(/6/2!/4/2/1:0)"]');
    expect(await store.getLocations("a")).toBe('["epubcfi(/6/2!/4/2/1:0)"]');
  });
  it("remembers the last book", async () => {
    expect(await store.getLastBookId()).toBeUndefined();
    await store.setLastBookId("a");
    await store.setLastBookId("b");
    expect(await store.getLastBookId()).toBe("b");
  });
  it("merges saved settings over defaults", async () => {
    expect(await store.getSettings({ fontSize: 100, theme: "light" })).toEqual({ fontSize: 100, theme: "light" });
    await store.setSettings({ fontSize: 120 });
    expect(await store.getSettings({ fontSize: 100, theme: "light" })).toEqual({ fontSize: 120, theme: "light" });
  });
  it("data survives reopening the database (like reloading the page)", async () => {
    await store.setLastBookId("a");
    const again = createStore(idb);
    expect(await again.getLastBookId()).toBe("a");
  });
});

describe("bookId", () => {
  it("is the same for the same bytes and different for different bytes", async () => {
    const a1 = await bookId(bytes("same book"));
    const a2 = await bookId(bytes("same book"));
    const b = await bookId(bytes("other book"));
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });
});
