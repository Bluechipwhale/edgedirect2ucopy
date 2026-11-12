'use client';
import Image from 'next/image';
import {useState} from 'react';
import {ShoppingBasket} from 'lucide-react';
import thumbnails from '../../data/category-thumbnails.json';
import {canOptimize} from '@/lib/images';

export function CategoryThumbnail({id,name,image}:{id:string;name:string;image:string}){
 const reference=thumbnails.find(row=>row.categoryId===id);
 const [failed,setFailed]=useState<string[]>([]);
 const usable=(value:string|undefined)=>{if(!value||value.includes('fmcg-placeholder')||/[\x00-\x20]/.test(value))return false;if(value.startsWith('/'))return !value.startsWith('//');try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}};
 const choices=[image,reference?.fallback].filter(usable) as string[];
 const source=choices.find(value=>!failed.includes(value));
 if(!source)return <span className="category-image-fallback" role="img" aria-label={name}><ShoppingBasket size={36} aria-hidden="true"/></span>;
 const productPhoto=source.includes('/category-thumbnails/');
 return <Image src={source} alt={name} fill sizes="(max-width:600px) 33vw, 16vw" unoptimized={!canOptimize(source)} style={productPhoto?{objectFit:'contain',padding:8,background:'#fff'}:undefined} onError={()=>setFailed(current=>current.includes(source)?current:[...current,source])}/>;
}
