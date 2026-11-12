import selection from '../../data/homepage-products.json';
export const homepageProductSelection=selection;
export function homepageProductAllowed(product:{id:string;featured:boolean}){return !product.id.startsWith(selection.importPrefix)||product.featured;}
