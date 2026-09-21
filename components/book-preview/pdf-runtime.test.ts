import { describe, expect, test } from "bun:test"
import { resolvePdfOutline, type PdfDocumentProxy, type PdfOutlineNode } from "./pdf-runtime"
import { countOccurrences, createPdfSearchIndex } from "./engines/pdf-search"

function mockDoc(
  pages: string[],
  outline?: PdfOutlineNode[] | null
): PdfDocumentProxy {
  return {
    numPages: pages.length,
    getPage: async (pageNumber: number) => ({
      getViewport: () => ({ width: 612, height: 792 }),
      getTextContent: async () => ({
        items: [{ str: pages[pageNumber - 1] ?? "" }],
      }),
      render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    }),
    getOutline: outline === undefined ? undefined : async () => outline,
    getDestination: async (id: string) => [{ num: Number(id.replace("p", "")), gen: 0 }],
    getPageIndex: async (ref) => ref.num - 1,
  }
}

describe("countOccurrences", () => {
  test("counts overlapping-free matches", () => {
    expect(countOccurrences("the cat sat on the mat", "the")).toBe(2)
  })

  test("returns zero for empty needle or no match", () => {
    expect(countOccurrences("abc", "")).toBe(0)
    expect(countOccurrences("abc", "z")).toBe(0)
  })
})

describe("createPdfSearchIndex", () => {
  test("finds pages containing the query", async () => {
    const index = createPdfSearchIndex(
      mockDoc(["hello world", "nothing here", "world peace"])
    )
    const hits = await index.search("world", () => false)
    expect(hits).toEqual([
      { page: 1, count: 1 },
      { page: 3, count: 1 },
    ])
  })

  test("caches page text between queries", async () => {
    let calls = 0
    const doc: PdfDocumentProxy = {
      numPages: 1,
      getPage: async () => {
        calls += 1
        return {
          getViewport: () => ({ width: 1, height: 1 }),
          getTextContent: async () => ({ items: [{ str: "alpha beta alpha" }] }),
          render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
        }
      },
    }
    const index = createPdfSearchIndex(doc)
    await index.search("alpha", () => false)
    const hits = await index.search("beta", () => false)
    expect(hits).toEqual([{ page: 1, count: 1 }])
    expect(calls).toBe(1)
  })

  test("stops early when cancelled", async () => {
    const index = createPdfSearchIndex(mockDoc(["a", "b", "c"]))
    let visited = 0
    const hits = await index.search("a", () => {
      visited += 1
      return visited > 1
    })
    expect(hits).toEqual([])
  })
})

describe("resolvePdfOutline", () => {
  test("returns empty when the document has no outline API", async () => {
    const doc = mockDoc(["x"])
    delete doc.getOutline
    expect(await resolvePdfOutline(doc)).toEqual([])
  })

  test("flattens a nested outline into indented contents", async () => {
    const doc = mockDoc(["x", "y", "z"], [
      {
        title: "Part I",
        dest: [{ num: 1, gen: 0 }],
        items: [{ title: "Chapter 1", dest: [{ num: 2, gen: 0 }], items: [] }],
      },
      { title: "External link", dest: null, items: [] },
    ])
    const entries = await resolvePdfOutline(doc)
    expect(entries).toEqual([
      { title: "Part I", pageIndex: 0, depth: 0 },
      { title: "Chapter 1", pageIndex: 1, depth: 1 },
    ])
  })

  test("resolves named destinations", async () => {
    const doc = mockDoc(["x", "y"], [{ title: "Named", dest: "p2", items: [] }])
    expect(await resolvePdfOutline(doc)).toEqual([
      { title: "Named", pageIndex: 1, depth: 0 },
    ])
  })

  test("drops destinations outside the document", async () => {
    const doc = mockDoc(["only page"], [{ title: "Far away", dest: [{ num: 99, gen: 0 }], items: [] }])
    expect(await resolvePdfOutline(doc)).toEqual([])
  })
})
