import {test,expect} from '@playwright/test';
const id='qa-shared-stock',name='QA shared stock options',origin='http://127.0.0.1:3100';
const data={name,slug:'qa-shared-stock-options',category_id:'electronics',brand:'QA',merchant_id:'edge',merchant_name:'Edgedirect2u',price_kobo:10000,image:'/icons/brand-20261021-192.png',images:['/icons/brand-20261021-192.png','/icons/brand-20261021-192.png','/icons/brand-20261021-512.png'],description:'Isolated stock and gallery regression fixture',options:{Colour:['Light','Dark']},featured:false,active:true};
test('options share stock, old overfilled bags cannot check out, and gallery thumbnails are unique',async({page,request})=>{
 expect((await request.post('/api/manage',{headers:{origin},data:{kind:'products',id,data}})).ok()).toBe(true);
 expect((await request.post('/api/operations',{headers:{origin},data:{action:'stock',product_id:id,quantity:5,reason:'QA shared stock fixture'}})).ok()).toBe(true);
 try{
  const product=(await(await request.get('/api/catalogue?q=QA%20shared%20stock%20options')).json()).products[0];
  await page.addInitScript(p=>localStorage.setItem('edge-shopping',JSON.stringify({cart:sessionStorage.getItem('qa-stock-seeded')?[{product:p,quantity:5,options:{Colour:'Light'}},{product:p,quantity:1,options:{Colour:'Dark'}}]:[{product:p,quantity:5,options:{Colour:'Light'}}],wishlist:[]})),product);
  await page.goto('/products/'+data.slug,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'View product image',exact:true})).toHaveCount(2);
  await page.getByRole('button',{name:'View product image',exact:true}).nth(1).click();
  await expect(page.locator('.detail-image img')).toHaveAttribute('src',/brand-20261021-512/);
  await page.getByRole('button',{name:'Dark',exact:true}).click();await page.getByRole('button',{name:'Add to bag',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Available stock is shared');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('edge-shopping')!).cart.reduce((n:number,c:{quantity:number})=>n+c.quantity,0))).toBe(5);
  // Represent a bag saved before the shared-stock fix; no server order is created.
  await page.evaluate(()=>sessionStorage.setItem('qa-stock-seeded','1'));
  await page.goto('/cart',{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('alert').filter({hasText:'your bag contains'})).toContainText('your bag contains 6 units, but only 5 are available');
  await expect(page.getByRole('button',{name:'Continue to checkout'})).toBeDisabled();
  await page.getByRole('button',{name:'Decrease quantity'}).first().click();
  await expect(page.getByRole('alert').filter({hasText:'your bag contains'})).toHaveCount(0);await expect(page.getByRole('link',{name:'Continue to checkout'})).toBeVisible();
  await page.getByRole('button',{name:'Increase quantity'}).first().click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('edge-shopping')!).cart.reduce((n:number,c:{quantity:number})=>n+c.quantity,0))).toBe(5);
 }finally{expect((await request.post('/api/manage',{headers:{origin},data:{kind:'products',id,data:{...data,active:false}}})).ok()).toBe(true);}
});
