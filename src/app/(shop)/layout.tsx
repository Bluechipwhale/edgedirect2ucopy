import { publishedTheme, storefrontCategories, localMode, configured } from '@/lib/server';
import Link from 'next/link';
import {customerCategoryLinks} from '@/lib/category-visibility';
import { StoreHeader, StoreFooter } from '@/components/store-shell';
import { themeTokens } from '@/lib/theme';
import type { CSSProperties, ReactNode } from 'react';
export default async function ShopLayout({children}:{children:ReactNode}) { const [raw,categories]=await Promise.all([publishedTheme(),storefrontCategories()]);const visible=new Set(categories.map(c=>c.id));const origin=process.env.NEXT_PUBLIC_SITE_URL||'https://edgedirect2u.com';const t={...raw,navigation:customerCategoryLinks(raw.navigation,visible,origin),footerLinks:customerCategoryLinks(raw.footerLinks,visible,origin)};const local=await localMode();return <div className="themed-store" style={themeTokens(t) as CSSProperties} data-buttons={t.buttonStyle}>{local&&<div className="workspace-strip">DEVELOPMENT CATALOGUE · Sample products, no live payments <Link href="/admin">Open workspace ↗</Link></div>}{!local&&!configured()&&<div className="workspace-strip">Store setup in progress · Catalogue services are not connected</div>}<a className="skip-link" href="#main-content">Skip to content</a><StoreHeader theme={t}/><main id="main-content" tabIndex={-1}>{children}</main><StoreFooter theme={t}/></div>; }

