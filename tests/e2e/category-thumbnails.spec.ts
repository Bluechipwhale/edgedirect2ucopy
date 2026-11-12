import {test,expect} from '@playwright/test';
test('a populated baby-care category uses its original product photo fallback and review categories stay private',async({page,request})=>{
 const response=await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{kind:'categories',id:'fmcg-baby-care-products',data:{name:'Baby care products',image:'/qa-category-photo-does-not-exist.png',parent_id:'',sort_order:0}}});
 expect(response.ok()).toBe(true);
 const product=await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{kind:'products',id:'qa-baby-photo',data:{name:'QA baby lotion',slug:'qa-baby-photo',category_id:'fmcg-baby-care-products',brand:'QA',merchant_id:'edge',merchant_name:'Edgedirect2u',price_kobo:10000,image:'/icon.svg',images:[],description:'Isolated thumbnail test fixture',options:{},active:true,featured:false}}});
 expect(product.ok()).toBe(true);
 const hidden=await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{kind:'categories',id:'legacy-category-review',data:{name:'Imported products — category review',image:'/icon.svg',parent_id:'',sort_order:0}}});
 expect(hidden.ok()).toBe(true);
 await page.goto('/');
 const image=page.getByRole('img',{name:'Baby care products',exact:true});
 await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect.poll(()=>image.evaluate(el=>decodeURIComponent((el as HTMLImageElement).currentSrc))).toContain('/images/category-thumbnails/fmcg-baby-care-products-');
 await expect(image).toHaveCSS('object-fit','contain');
 await expect(page.getByRole('link',{name:'Imported products — category review',exact:true})).toHaveCount(0);
 await expect(page.getByRole('link',{name:'Baby care products',exact:true})).toHaveAttribute('href','/categories/fmcg-baby-care-products');
 const category={kind:'categories',id:'fmcg-baby-care-products',data:{name:'Baby care products',image:'/qa-category-photo-does-not-exist.png',parent_id:'',sort_order:0}};
 expect((await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{...category,data:{...category.data,storefront_hidden:true}}})).ok()).toBe(true);
 await page.reload();await expect(page.getByRole('link',{name:'Baby care products',exact:true})).toHaveCount(0);
 // An older editor that omits the new checkbox must preserve the saved flag.
 expect((await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:category})).ok()).toBe(true);
 const hiddenCatalogue=await(await request.get('/api/catalogue')).json();expect(hiddenCatalogue.categories.some((c:{id:string})=>c.id===category.id)).toBe(false);expect(hiddenCatalogue.products.some((p:{id:string})=>p.id==='qa-baby-photo')).toBe(true);
 expect((await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{...category,data:{...category.data,storefront_hidden:false}}})).ok()).toBe(true);
});
