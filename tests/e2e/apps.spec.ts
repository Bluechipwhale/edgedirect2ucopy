import {test,expect} from '@playwright/test';
import {mockRemoteDemoImages} from './demo-images';
test.beforeEach(async({page})=>mockRemoteDemoImages(page));
test('store app manifest, download hub and install guidance',async({page,request})=>{
  await page.setViewportSize({width:320,height:760});await page.goto('/apps');
  await expect(page.getByRole('heading',{name:'Your everyday. Now in your pocket.'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Download store APK'})).toHaveAttribute('href',/Edgedirect2u-Store\.apk$/);
  await expect(page.getByRole('link',{name:'Download driver APK'})).toHaveAttribute('href',/Edgedirect2u-Driver\.apk$/);
  await expect(page.getByRole('link',{name:'Download Windows installer'})).toHaveAttribute('href',/Edgedirect2u-Store-Setup\.exe$/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  const manifest=await(await request.get('/store.webmanifest')).json();expect(manifest.start_url).toBe('/?source=installed');expect(manifest.scope).toBe('/');expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map((icon:{src:string})=>icon.src)).toEqual(['/icons/brand-20261021-192.png','/icons/brand-20261021-512.png']);
  const logo=page.locator('.main-header .official-logo img');await expect(logo).toBeVisible();await expect(logo).toHaveAttribute('src',/e-edge-direct-2u-mark-20261021\.png$/);
  const worker=await request.get('/app-sw.js');expect(worker.headers()['cache-control']).toContain('no-store');
});
test('offline app fallback stores no customer pages or API responses',async({page,context})=>{
  await page.goto('/apps');await page.evaluate(async()=>{await navigator.serviceWorker.ready;});await page.reload();
  await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);await page.goto('/products');
  await expect(page.getByRole('heading',{name:'Your next good find can wait.'})).toBeVisible();
  const cached=await page.evaluate(async()=>{const names=await caches.keys();const urls=[];for(const name of names){const cache=await caches.open(name);for(const key of await cache.keys())urls.push(new URL(key.url).pathname);}return urls;});
  expect(cached.sort()).toEqual(['/icons/brand-20261021-192.png','/icons/brand-20261021-512.png','/offline.html'].sort());
  expect(await page.evaluate(()=>fetch('/api/catalogue').then(()=>false).catch(()=>true))).toBe(true);
  await context.setOffline(false);
});
test('administrator creates products with category choices and naira prices',async({page,request})=>{
  const name='QA portable product '+Date.now();let product;
  try{
    await page.goto('/admin/products');await page.getByRole('button',{name:'Add record'}).click();
    await page.getByLabel('Product name',{exact:true}).fill(name);await expect(page.getByLabel('URL slug')).toHaveValue(name.toLowerCase().replaceAll(' ','-'));
    await page.getByRole('combobox',{name:'Category',exact:true}).selectOption({label:'Electronics'});
    await page.getByLabel('Brand',{exact:true}).fill('QA');await page.getByLabel('Price (₦)',{exact:true}).fill('1234.56');
    await page.getByLabel('Image URL',{exact:true}).fill('https://images.unsplash.com/photo-1505740420928-5e560c06d30e');
    await page.getByLabel('Description',{exact:true}).fill('Disposable browser verification product.');
    await page.getByRole('button',{name:'Save product',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
    const response=await(await request.get('/api/catalogue?q='+encodeURIComponent(name))).json();product=response.products.find((p:{name:string})=>p.name===name);expect(product.price_kobo).toBe(123456);expect(product.stock).toBe(0);expect(product.featured).toBe(false);
  }finally{if(product)await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{kind:'products',id:product.id,data:{...product,active:false}}});}
});
test('administrator searches the catalogue and can delete and restore a product',async({page,request})=>{
  await page.goto('/admin/products');
  await page.getByRole('textbox',{name:'Search all products'}).fill('Studio wireless headphones');
  await page.getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.getByText('1 products',{exact:true})).toBeVisible();
  const row=page.getByRole('row').filter({hasText:'Studio wireless headphones'});
  await expect(row).toContainText('Published');
  await row.getByRole('button',{name:'Delete Studio wireless headphones'}).click();
  await expect(page.getByRole('dialog',{name:'Delete product'})).toContainText('keeps its past orders and stock history');
  await page.getByRole('dialog',{name:'Delete product'}).getByRole('button',{name:'Delete product'}).click();
  await expect(page.getByRole('dialog',{name:'Delete product'})).toHaveCount(0);
  await expect(row).toContainText('Deleted');
  const archived=await(await request.get('/api/catalogue?q=Studio%20wireless%20headphones')).json();
  expect(archived.products).toEqual([]);
  await row.getByRole('button',{name:'Restore Studio wireless headphones'}).click();
  await page.getByRole('dialog',{name:'Restore product'}).getByRole('button',{name:'Restore product'}).click();
  await expect(row).toContainText('Published');
});
