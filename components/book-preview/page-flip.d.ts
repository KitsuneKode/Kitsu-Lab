declare module 'page-flip/dist/js/page-flip.module.js' {
  export type PageFlipPoint = { x: number; y: number }

  export class PageFlip {
    constructor(element: HTMLElement, options: Record<string, unknown>)
    loadFromHTML(pages: HTMLElement[]): void
    destroy(): void
    update(): void
    flip(page: number, corner?: 'top' | 'bottom'): void
    flipNext(corner?: 'top' | 'bottom'): void
    flipPrev(corner?: 'top' | 'bottom'): void
    getCurrentPageIndex(): number
    getState(): string
    getSettings(): { showPageCorners: boolean }
    getFlipController(): { showCorner: (pos: PageFlipPoint) => void }
    on(event: string, cb: (e: { data: unknown }) => void): this
    off(event: string): void
    userMove(pos: PageFlipPoint, isTouch: boolean): void
    mousePosition?: PageFlipPoint
    isUserTouch?: boolean
  }
}
