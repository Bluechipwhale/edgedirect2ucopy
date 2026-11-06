import Link from 'next/link';
import {requireRole,localMode,supabase} from '@/lib/server';
import {DeleteRecordButton} from '@/components/delete-record-button';
export default async function Page(){
 await requireRole(['admin']);
 const result=await localMode()?{data:[],error:null}:await(await supabase()).rpc('admin_deleted_records');
 if(result.error)throw new Error('Deleted-record directory is unavailable');
 const rows=result.data as {kind:string;id:string;name:string;archived_at:string}[];
 return <><div className="management-heading"><div><h1>Deleted records</h1><p>Restore directory and content records here. Past orders, payments, customer accounts and stock ledgers are retained.</p></div><Link className="small-button" href="/admin/products?state=archived">Deleted products</Link></div><nav className="resource-subnav"><a download="deleted-records.csv" className="small-button" href="/admin/trash/export">Export deleted records (CSV)</a></nav><div className="table-wrap"><table><thead><tr><th>Type</th><th>Name</th><th>Deleted</th><th>Action</th></tr></thead><tbody>{rows.map(r=><tr key={`${r.kind}-${r.id}`}><td>{r.kind.replace(/_/g,' ')}</td><td>{r.name}</td><td>{new Date(r.archived_at).toLocaleString('en-NG')}</td><td><DeleteRecordButton kind={r.kind} id={r.id} name={r.name} deleted/></td></tr>)}</tbody></table>{!rows.length&&<p>No deleted directory records.</p>}</div><p>Categories containing products cannot be deleted. Delete controls are intentionally unavailable for payment, accounting, audit and stock-ledger records; use their cancellation or reconciliation workflows.</p></>;
}
