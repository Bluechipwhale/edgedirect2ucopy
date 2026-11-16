import { test,expect } from '@playwright/test';
import {mockRemoteDemoImages} from './demo-images';
test.beforeEach(async({page})=>mockRemoteDemoImages(page));
test('storefront, categories, search, product variants and wishlist',async({page})=>{
  await page.goto('/');await expect(page.getByRole('heading',{name:'Stock up. Move forward.'})).toBeVisible();
  await page.screenshot({path:'artifacts/storefront-desktop.png',fullPage:true,caret:'initial'});
  await page.getByRole('textbox',{name:'Search products'}).fill('headphones');await page.getByRole('button',{name:'Submit search'}).click();await expect(page.getByRole('heading',{name:'Results for “headphones”'})).toBeVisible();
  await page.getByRole('link',{name:'Studio wireless headphones',exact:true}).first().click();await expect(page.getByRole('heading',{name:'Studio wireless headphones',exact:true,level:1})).toBeVisible({timeout:15000});await expect(page.getByRole('button',{name:'Select your options'})).toBeDisabled();await page.getByRole('button',{name:'Warm white',exact:true}).click();await page.getByRole('button',{name:'Add to bag',exact:true}).click();await expect(page.getByRole('link',{name:'Shopping bag, 1 items'})).toBeVisible();
  await page.getByRole('button',{name:'Toggle wishlist'}).click();await page.goto('/wishlist');await expect(page.getByRole('heading',{name:'Studio wireless headphones'})).toBeVisible();
});
test('cart and checkout create a persistent unpaid reservation',async({page})=>{
  await page.goto('/products/sculpture-table-lamp');await page.getByRole('button',{name:'Add to bag',exact:true}).click();await page.goto('/cart');await expect(page.getByRole('heading',{name:'Sculpture table lamp',exact:true})).toBeVisible();await page.getByRole('link',{name:'Continue to checkout'}).click();
  await page.getByLabel('Full name').fill('QA Customer');await page.getByLabel('Email',{exact:true}).fill('qa@example.com');await page.getByLabel('Phone number').fill('08012345678');await page.getByLabel('Street address').fill('123 QA Test Street');await page.getByLabel('City',{exact:true}).fill('Lagos');await page.getByRole('button',{name:'Continue to payment'}).click();await expect(page.getByRole('heading',{name:'Your order is reserved.'})).toBeVisible();await expect(page.getByText(/no charge has been made/)).toBeVisible();await page.goto('/account/orders');await expect(page.getByText(/QA Customer/)).toHaveCount(0);await expect(page.getByText(/Payment: pending/).first()).toBeVisible();
});
test('theme preview, draft isolation, publication and rollback',async({page,request})=>{
  test.setTimeout(90000);
  const original=await(await request.get('/api/theme')).json();const priorVersion=original.versions[0].id;const brand='QA Theme '+Date.now();
  try{
    await page.goto('/admin/theme');await expect(page.frameLocator('iframe[title="Live storefront preview"]').getByRole('heading',{name:'Stock up. Move forward.'})).toBeVisible();await page.screenshot({path:'artifacts/theme-studio.png',fullPage:true});await page.getByLabel('Website & company name').fill(brand);
    await expect(page.frameLocator('iframe[title="Live storefront preview"]').getByRole('link',{name:brand+' home'}).first()).toBeVisible();
    await page.getByRole('button',{name:'Save draft',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Draft saved.'})).toBeVisible();
    const publicBefore=await request.get('/');expect(await publicBefore.text()).not.toContain(brand+' home');
    await page.getByRole('button',{name:'Publish changes'}).click();await expect(page.getByRole('dialog',{name:'Publish theme'})).toBeVisible();await page.getByRole('button',{name:'Publish theme',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Theme published.'})).toBeVisible();
    await page.goto('/');await expect(page.getByRole('link',{name:brand+' home'}).first()).toBeVisible();
  }finally{
    const origin='http://127.0.0.1:3100';await request.post('/api/theme',{headers:{origin},data:{action:'rollback',version:priorVersion}});await request.post('/api/theme',{headers:{origin},data:{action:'draft',config:original.draft}});
  }
});
test('mobile storefront has no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('heading',{name:'Stock up. Move forward.'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.getByRole('button',{name:'Toggle navigation'}).click();await expect(page.getByRole('link',{name:'All categories',exact:true})).toBeVisible();await page.screenshot({path:'artifacts/storefront-mobile.png',fullPage:true});
});
test('admin pages render and stock adjustments are auditable',async({page})=>{
  await page.goto('/admin');await expect(page.getByRole('heading',{name:'Your marketplace, at a glance.'})).toBeVisible();await page.goto('/admin/products');await expect(page.getByRole('button',{name:'Add record'})).toBeVisible();await page.goto('/admin/inventory');await expect(page.getByRole('columnheader',{name:'Reserved',exact:true})).toBeVisible();await page.goto('/admin/dispatch');await expect(page.getByRole('button',{name:'Assign delivery'})).toBeVisible();
});
test('missing services and unauthorized workspaces show clear states',async({page,request})=>{
  await page.goto('/login');await page.getByLabel('Email address').fill('qa@example.com');await page.getByLabel('Password',{exact:true}).fill('qasecurepassword');await page.getByRole('button',{name:/^Sign in/}).click();await expect(page.getByRole('status')).toContainText('Connect Supabase');
  await page.goto('/merchant');await expect(page.getByRole('heading',{name:'Your merchant workspace.'})).toBeVisible();await page.goto('/driver');await expect(page.getByRole('heading',{name:'Your delivery day, simplified.'})).toBeVisible();
  const res=await request.post('/api/theme',{headers:{origin:'https://untrusted.example'},data:{action:'publish',config:{}}});expect(res.status()).toBe(400);
});
