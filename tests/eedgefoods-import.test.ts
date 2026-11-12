import {createRequire} from 'node:module';
import {expect,it} from 'vitest';
const {normalize}=createRequire(import.meta.url)('../scripts/import-eedgefoods.cjs');
const product=(id:number,name='Fish in a Box (MAXI)',price='3580000')=>({id,name,slug:'fish-'+id,type:'simple',permalink:'https://eedgefoods.com/product/fish-'+id+'/',prices:{currency_code:'NGN',currency_minor_unit:2,price},images:[{src:'https://eedgefoods.com/fish-'+id+'.jpg'}],attributes:[],variations:[],short_description:'<p>Fresh fish selection.</p>'});
it('consolidates the approved repeated MAXI listings without adding their stock or losing source photos',()=>{
 const rows=normalize([product(5936),product(3673),product(3681)]);expect(rows).toHaveLength(1);expect(rows[0]).toMatchObject({id:'eedgefoods-3673',price_kobo:3580000,description:'Fresh fish selection.'});expect(rows[0].source_rows).toHaveLength(3);expect(rows[0].source_images).toHaveLength(3);expect(rows[0]).not.toHaveProperty('stock');
});
it('keeps different verified prices separate and rejects unverified currency, variants and duplicate source IDs',()=>{
 expect(normalize([product(1),product(2,'Fish in a Box (MAXI)','2780000')])).toHaveLength(2);
 expect(()=>normalize([{...product(1),prices:{currency_code:'USD',currency_minor_unit:2,price:'3580000'}}])).toThrow('NGN');
 expect(()=>normalize([{...product(1),type:'variable'}])).toThrow('variants');
 expect(()=>normalize([product(1),product(1)])).toThrow('source IDs');
 expect(()=>normalize([product(1,'Other product'),product(2,'Other product')])).toThrow('Unapproved duplicate');
 expect(()=>normalize([{...product(1),permalink:'https://other.example/product/x'}])).toThrow('source product URL');
});
