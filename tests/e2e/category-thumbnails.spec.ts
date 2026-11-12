import {test,expect} from '@playwright/test';
test('a broken baby-care thumbnail falls back to its matching product photo without cropping',async({page,request})=>{
 const response=await request.post('/api/manage',{headers:{origin:'http://127.0.0.1:3100'},data:{kind:'categories',id:'fmcg-baby-care-products',data:{name:'Baby care products',image:'/qa-category-photo-does-not-exist.png',parent_id:'',sort_order:0}}});
 expect(response.ok()).toBe(true);
 await page.goto('/');
 const image=page.getByRole('img',{name:'Baby care products',exact:true});
 await expect(image).toBeVisible();
 await expect.poll(()=>image.evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
 await expect.poll(()=>image.evaluate(el=>decodeURIComponent((el as HTMLImageElement).currentSrc))).toContain('/images/category-thumbnails/fmcg-baby-care-products-');
 await expect(image).toHaveCSS('object-fit','contain');
 await expect(page.getByRole('link',{name:'Baby care products',exact:true})).toHaveAttribute('href','/categories/fmcg-baby-care-products');
});
