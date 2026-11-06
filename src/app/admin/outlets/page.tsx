import Link from 'next/link';
import {requireRole,localMode} from '@/lib/server';
import {companySnapshot} from '@/lib/platform-server';
import {OutletDirectory} from '@/components/outlet-directory';
import {catalogueSearchParams} from '@/lib/catalogue-query';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireRole(['admin']);
 if(await localMode())return <><h1>Customer outlets & routes</h1><p>Production customer locations require an authorized company membership. Local sample products remain separate.</p></>;
 const snapshot=await companySnapshot('e-edge-direct-2u');
 if(!['company_admin','supervisor'].includes(snapshot.role))return <><h1>Company authorization required</h1><p>Your account needs the company’s customer-management permission to edit outlets.</p><Link href="/workspaces">Your workspaces</Link></>;
 const query=catalogueSearchParams(await searchParams).q?.trim().slice(0,120)||'';
 return <div className="platform-root"><div className="management-heading"><div><span className="eyebrow muted">CUSTOMER OPERATIONS</span><h1>Customer outlets & routes</h1><p>Edit customer names, phone numbers, addresses and verified GPS positions. Route assignments and corrections are audited.</p></div><Link className="small-button" href="/admin/customers">Imported customer accounts</Link></div><OutletDirectory canDelete key={query} snapshot={snapshot} fieldMode={false} initialQuery={query}/></div>;
}
