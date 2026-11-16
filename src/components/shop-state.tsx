'use client';
import { createContext, useContext, useSyncExternalStore, useState, useRef, useEffect, type ReactNode } from 'react';
import type { Product } from '@/lib/types';
import { cartKey, restoreShopping, type ShoppingState as State } from '@/lib/shopping-storage';
import {cartLineLimit} from '@/lib/cart-stock';
export type { CartLine } from '@/lib/shopping-storage';
const empty: State = { cart: [], wishlist: [] }; let snapshot = empty; let loaded = false; const listeners = new Set<() => void>();
function getState() { if(!loaded && typeof window !== 'undefined') { loaded=true; try { snapshot=restoreShopping(localStorage.getItem('edge-shopping')); }catch{} }return snapshot; }
function update(value: State) { snapshot=value; try{localStorage.setItem('edge-shopping',JSON.stringify(value));}catch{} listeners.forEach(fn=>fn()); }
function storageChanged(event:StorageEvent){if(event.key==='edge-shopping'||event.key===null){snapshot=restoreShopping(event.newValue);listeners.forEach(fn=>fn());}}
const subscribe=(fn:()=>void)=>{if(!listeners.size)window.addEventListener('storage',storageChanged);listeners.add(fn);return()=>{listeners.delete(fn);if(!listeners.size)window.removeEventListener('storage',storageChanged);};};
export function mergeAccountWishlist(ids:string[]){const current=getState(),wishlist=[...new Set([...current.wishlist,...ids])];if(wishlist.length>100)throw Error('Your combined wishlist exceeds 100 finds. Remove some device finds before adding your account list.');if(wishlist.length!==current.wishlist.length)update({...current,wishlist});}
export async function refreshCartPrices(){const current=getState(),ids=[...new Set(current.cart.map(c=>c.product.id))];if(!ids.length)return;const r=await fetch('/api/wishlist?'+new URLSearchParams(ids.map(id=>['id',id])),{cache:'no-store'});if(!r.ok)throw Error('Prices could not be refreshed. Please try again.');const products=await r.json() as Product[],byId=new Map(products.map(p=>[p.id,p]));const latest=getState();if(latest.cart.some(c=>!ids.includes(c.product.id)))throw Error('Your bag changed during the refresh. Please refresh prices again.');const missing=latest.cart.find(c=>!byId.has(c.product.id));if(missing)throw Error(`${missing.product.name} is no longer available. Remove it from your bag before refreshing the other items.`);update({...latest,cart:latest.cart.map(c=>({...c,product:byId.get(c.product.id)!}))});}
const Context=createContext<{state:State;add:(p:Product,q?:number,o?:Record<string,string>)=>void;quantity:(key:string,q:number)=>void;wish:(id:string)=>void;clear:()=>void;notify:(s:string)=>void} | null>(null);
export function ShopProvider({children}:{children:ReactNode}) {
  const state=useSyncExternalStore(subscribe,getState,()=>empty); const [toast,setToast]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const notify=(text:string)=>{if(timer.current)clearTimeout(timer.current);setToast(text);timer.current=setTimeout(()=>setToast(''),3500);};
  function add(product:Product,quantity=1,options:Record<string,string>={}) {
    if(!Number.isSafeInteger(quantity)||quantity<1){notify('Choose a valid quantity.');return;}
    const key=cartKey(product.id,options),current=getState(),exists=current.cart.find(c=>c.key===key);
    if(!exists&&current.cart.length>=50){notify('Your bag holds up to 50 different finds.');return;}
    const limit=cartLineLimit(current.cart,product,key),held=exists?.quantity||0;
    if(held+quantity>limit){notify(limit===50?'Your bag holds up to 50 units of each option.':`Only ${Math.max(0,limit-held)} more of this item can be added. Available stock is shared across its options.`);return;}
    const cart=current.cart.map(c=>c.product.id===product.id?{...c,product,quantity:c.key===key?c.quantity+quantity:c.quantity}:c);
    if(!exists)cart.push({key,product,quantity,options});update({...current,cart});notify('Added to your bag');
  }
  function quantity(key:string,q:number){
    const current=getState(),line=current.cart.find(c=>c.key===key);if(!line)return;
    const requested=Math.max(0,Number.isFinite(q)?Math.floor(q):0),limit=cartLineLimit(current.cart,line.product,key),next=Math.min(requested,limit);
    if(requested>limit)notify(limit===50?'Your bag holds up to 50 units of each option.':'Available stock is shared across this item’s options.');
    update({...current,cart:current.cart.map(c=>c.key===key?{...c,quantity:next}:c).filter(c=>c.quantity>0)});
  }
  return <Context.Provider value={{state,add,quantity,wish:id=>{const s=getState();if(!s.wishlist.includes(id)&&s.wishlist.length>=100){notify('Your wishlist holds up to 100 finds. Remove one to save another.');return;}update({...s,wishlist:s.wishlist.includes(id)?s.wishlist.filter(i=>i!==id):[...s.wishlist,id]});},clear:()=>update({...getState(),cart:[]}),notify}}>{children}{toast&&<div className="toast" role="status">{toast}</div>}</Context.Provider>;
}
export function useShop(){const value=useContext(Context);if(!value)throw new Error('ShopProvider missing');return value;}
