import { promotionJsonSchema } from '@/components/promotions/promotion-schema'

/** The promotion JSON Schema, for assistants and CMS field validation. */
export function GET() {
  return Response.json(promotionJsonSchema, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
