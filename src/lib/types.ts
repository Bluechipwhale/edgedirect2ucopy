export type Role = 'admin' | 'operations' | 'merchant' | 'driver' | 'customer';
export type Actor = { id: string; role: Role; merchantId?: string; local?: boolean };
export type Category = { id: string; name: string; image: string; parent_id?: string; sort_order?: number; storefront_hidden?: boolean };
export type Product = { id: string; slug: string; name: string; category_id: string; brand: string; merchant_id: string; merchant_name: string; price_kobo: number; regular_price_kobo?:number; previous_price_kobo?: number | null; stock: number; reserved: number; reorder_level?: number; image: string; images: string[]; description: string; options: Record<string, string[]>; featured: boolean; active: boolean; archived_at?: string | null; archived_previous_active?: boolean; created_at: string };
export type RecordRow = { id: string; kind: string; owner_id?: string; merchant_id?: string; data: Record<string, unknown>; created_at: string };
export type OrderItem = { product_id: string; name: string; quantity: number; price_kobo: number; merchant_id: string; options: Record<string, string> };
export type Address = { name: string; email: string; phone: string; street: string; city: string; state: string };
export type Order = { id: string; customer_id: string; status: string; queue?: string; payment_status: string; items: OrderItem[]; address: Address; subtotal_kobo: number; delivery_kobo: number; discount_kobo: number; total_kobo: number; reference: string; expires_at: string; created_at: string; allocations: { merchant_id: string; total_kobo: number; status: string }[] };
export const money = (kobo: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits:kobo%100===0?0:2,maximumFractionDigits:2 }).format(kobo / 100);
