import type {Page} from '@playwright/test';
/** Functional tests must not depend on an unrelated stock-photo CDN being online. */
export async function mockRemoteDemoImages(page:Page){
 const image={path:'public/images/fmcg-placeholder.svg',contentType:'image/svg+xml'};
 await page.route('https://images.unsplash.com/**',route=>route.fulfill(image));
 await page.route('**/_next/image?*',route=>{
  const source=new URL(route.request().url()).searchParams.get('url');
  return source?.startsWith('https://images.unsplash.com/')?route.fulfill(image):route.continue();
 });
}
