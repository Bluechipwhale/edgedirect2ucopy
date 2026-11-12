import {test,expect} from '@playwright/test';
test('new food imports do not displace old homepage products and remain available in the full collection',async({page,request})=>{
 const origin='http://127.0.0.1:3100',ids=['3671','3673','3674','3678','3682','5875','5933','5934','5935','5937'];
 const fixtures=ids.map((id,i)=>({kind:'products',id:'eedgefoods-'+id,data:{name:'QA homepage food '+(i===0?'Soup MAXI':i===1?'Fish MAXI':id),slug:'qa-homepage-food-'+id,category_id:'groceries',brand:'QA',merchant_id:'edge',merchant_name:'Edgedirect2u',price_kobo:10000,image:'/images/fmcg-placeholder.svg',images:[],description:'Isolated homepage regression fixture',options:{},featured:i<2,active:true}}));
 await page.goto('/');const before=await page.locator('.product-card h3').allTextContents();expect(before.length).toBeGreaterThan(0);
 try{
  for(const product of fixtures)expect((await request.post('/api/manage',{headers:{origin},data:product})).ok()).toBe(true);
  await page.reload();for(const title of before)await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  for(const product of fixtures.slice(0,2))await expect(page.getByRole('heading',{name:product.data.name,exact:true})).toBeVisible();
  for(const product of fixtures.slice(2))await expect(page.getByRole('heading',{name:product.data.name,exact:true})).toHaveCount(0);
  const all=await(await request.get('/api/catalogue?q=QA%20homepage%20food')).json();expect(all.count).toBe(10);
  await page.goto('/categories/groceries');for(const product of fixtures)await expect(page.getByRole('heading',{name:product.data.name,exact:true})).toBeVisible();
 }finally{for(const product of fixtures)expect((await request.post('/api/manage',{headers:{origin},data:{...product,data:{...product.data,active:false}}})).ok()).toBe(true);}
});
