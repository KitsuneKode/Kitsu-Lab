declare module "page-flip/dist/js/page-flip.module.js" {
  export type PageFlipPoint = {
    x: number
    y: number
  }

  export type PageFlipSettings = {
    startPage: number
    size: "fixed" | "stretch"
    width: number
    height: number
    minWidth: number
    maxWidth: number
    minHeight: number
    maxHeight: number
    drawShadow: boolean
    flippingTime: number
    usePortrait: boolean
    startZIndex: number
    autoSize: boolean
    maxShadowOpacity: number
    showCover: boolean
    mobileScrollSupport: boolean
    clickEventForward: boolean
    useMouseEvents: boolean
    swipeDistance: number
    showPageCorners: boolean
    disableFlipByClick: boolean
  }

  export type PageFlipEvent = {
    data: unknown
  }

  export class PageFlip {
    constructor(host: HTMLElement, settings: Partial<PageFlipSettings>)
    loadFromHTML(items: HTMLElement[]): void
    updateFromHtml(items: HTMLElement[]): void
    destroy(): void
    update(): void
    flip(page: number, corner?: string): void
    flipNext(corner?: string): void
    flipPrev(corner?: string): void
    turnToPage(page: number): void
    startUserTouch(pos: PageFlipPoint): void
    userMove(pos: PageFlipPoint, isTouch: boolean): void
    userStop(pos: PageFlipPoint, isSwipe?: boolean): void
    getCurrentPageIndex(): number
    getPageCount(): number
    getState(): string
    getSettings(): PageFlipSettings
    getUI(): { getDistElement: () => HTMLElement }
    on(event: string, callback: (event: PageFlipEvent) => void): this
    off(event: string): void
  }
}
