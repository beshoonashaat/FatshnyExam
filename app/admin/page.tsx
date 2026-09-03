import AdminClient from '@/components/AdminClient'; import { isAdmin } from '@/lib/auth';
export const dynamic='force-dynamic'; export default async function AdminPage(){return <AdminClient initialAuthenticated={await isAdmin()}/>}
