import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBar, Box, Button, Card, CardContent, CircularProgress, Container, CssBaseline, Stack, Tab, Tabs, TextField, ThemeProvider, Typography, createTheme, useMediaQuery } from '@mui/material';
import './style.css';

type EventRecord = { id:string; title:string; location:string; timezone:string; start_at:number; end_at:number; version:number };
type View = 'upcoming'|'past';
const build = import.meta.env.VITE_COMMIT_SHA || 'local';
const magic = new URL(location.href).searchParams.get('magic');
if (magic) history.replaceState(null,'',location.pathname);
const api = async (path:string,body?:Record<string,string>) => {
 const r=await fetch('/api/auth/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;
};
function EventList(){
 const [view,setView]=useState<View>('upcoming'),[events,setEvents]=useState<EventRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,reload]=useState(0);
 useEffect(()=>{let active=true;setLoading(true);setError('');fetch('/api/events?view='+view,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Unable to load events');return r.json()}).then(d=>{if(active)setEvents(d.events)}).catch(e=>{if(active)setError(String(e.message))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[view,revision]);
 const local=(instant:number,timezone:string)=>new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:timezone,timeZoneName:'short'}).format(new Date(instant));
 return <Box component="section" aria-label="Events" sx={{my:5}}>
  <Tabs value={view} onChange={(_,v:View)=>setView(v)} aria-label="Event timeline"><Tab label="Upcoming Events" value="upcoming"/><Tab label="Past Events" value="past"/></Tabs>
  {loading?<Box sx={{p:4}} role="status"><CircularProgress aria-label="Loading events"/></Box>:error?<Stack sx={{p:3}} spacing={2}><Typography role="alert">{error}</Typography><Button onClick={()=>reload(n=>n+1)}>Retry</Button></Stack>:events.length===0?<Box sx={{p:4}}><Typography variant="h6">{view==='upcoming'?'No upcoming events':'No past events yet.'}</Typography>{view==='upcoming'&&<Typography>Check back soon for new opportunities to serve.</Typography>}</Box>:
  <Stack spacing={2} sx={{pt:3}}>{events.map(e=><Card key={e.id} variant="outlined"><CardContent><Typography variant="h6">{e.title}</Typography><Typography sx={{mt:1}}>{local(e.start_at,e.timezone)} – {local(e.end_at,e.timezone)}</Typography><Typography color="text.secondary">{e.timezone}</Typography><Typography sx={{mt:1}}>Location: {e.location}</Typography></CardContent></Card>)}</Stack>}
 </Box>
}
function SignIn(){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[showCode,setShowCode]=useState(false),[message,setMessage]=useState(''),[signed,setSigned]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const refresh=async()=>{try{const me=await api('me');if(me.authenticated){const check=await fetch('/api/admin/dashboard',{credentials:'same-origin',cache:'no-store'});setSigned(check.ok?me.email:null)}else setSigned(null)}catch{setSigned(null)}};
 useEffect(()=>{void refresh()},[]);
 const act=async (work:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await work()}catch(e){setMessage(e instanceof Error?e.message:'Request failed')}finally{setBusy(false)}};
 return <Box component="section" aria-label="Administrator sign-in" sx={{my:3}}>
 {signed?<Stack spacing={2}><Typography>Signed in as {signed}</Typography><Button variant="outlined" disabled={busy} onClick={()=>void act(async()=>{await api('logout',{});setSigned(null)})}>Sign out</Button></Stack>:
 <Stack spacing={2} component="form" onSubmit={e=>{e.preventDefault();void act(async()=>{const result=await api('request',{email});setMessage(result.message);setShowCode(true)})}}>
  <Typography variant="h6">Administrator sign-in</Typography>
  <TextField label="Administrator email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/>
  <Button type="submit" variant="contained" disabled={busy}>Email me a code and sign-in link</Button>
 </Stack>}
 {!signed&&showCode&&<Stack component="form" sx={{mt:2}} spacing={2} onSubmit={e=>{e.preventDefault();void act(async()=>{await api('verify',{email,code});await refresh()})}}>
  <TextField label="Eight-digit email code" value={code} onChange={e=>setCode(e.target.value)} inputProps={{inputMode:'numeric',pattern:'[0-9]{8}'}} required/>
  <Button type="submit" disabled={busy}>Verify code</Button>
 </Stack>}
 {!signed&&magic&&<Button sx={{mt:2}} disabled={busy} variant="outlined" onClick={()=>void act(async()=>{await api('magic',{token:magic});await refresh()})}>Confirm magic-link sign-in</Button>}
 {message&&<Typography sx={{mt:2}} role="status">{message}</Typography>}
 </Box>
}
function App(){
 const dark=useMediaQuery('(prefers-color-scheme: dark)');
 const theme=React.useMemo(()=>createTheme({palette:{mode:dark?'dark':'light',primary:{main:dark?'#f1c232':'#705400'}},shape:{borderRadius:16}}),[dark]);
 return <ThemeProvider theme={theme}><CssBaseline/><AppBar position="static" color="default" elevation={0}><Container><Typography variant="h6" sx={{py:2}}>Serve With SF Fil-Am Lions</Typography></Container></AppBar><Container maxWidth="md" component="main"><Typography variant="h3" component="h1" sx={{mt:5}}>Serve With SF Fil-Am Lions</Typography><Typography color="text.secondary">Making it easier to serve together.</Typography><EventList/><SignIn/><Box component="footer" sx={{my:5,color:'text.secondary',fontSize:12}}>Build: <code>{build.slice(0,12)}</code></Box></Container></ThemeProvider>
}
createRoot(document.getElementById('app')!).render(<App/>);
