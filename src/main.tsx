import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBar, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Alert, Container, CssBaseline, Stack, Tab, Tabs, TextField, ThemeProvider, Typography, createTheme, useMediaQuery } from '@mui/material';
import './style.css';

type EventRecord = { id:string; title:string; location:string; timezone:string; start_at:number; end_at:number; version:number };
type View = 'upcoming'|'past';
const repositoryUrl = 'https://github.com/SFFilAmLions/serve-with';
const buildEnvironment = import.meta.env.VITE_DEPLOY_ENV;
const buildSha = import.meta.env.VITE_COMMIT_SHA || '';
const releaseTag = import.meta.env.VITE_RELEASE_TAG || '';
function BuildFooter() {
 const staged = buildEnvironment === 'staging' && /^[a-f0-9]{40}$/.test(buildSha);
 const released = buildEnvironment === 'production' && /^v\\d+\\.\\d+\\.\\d+$/.test(releaseTag);
 const label = staged ? 'Commit ' + buildSha.slice(0,12) : released ? 'Version ' + releaseTag : 'Development build';
 const href = staged ? repositoryUrl + '/commit/' + buildSha : released ? repositoryUrl + '/releases/tag/' + releaseTag : undefined;
 return <Box component="footer" sx={{my:5,color:'text.secondary',fontSize:12,display:'flex',flexWrap:'wrap',gap:1,alignItems:'center'}}>
  <a href={repositoryUrl} target="_blank" rel="noopener noreferrer" aria-label="Serve With GitHub repository">GitHub repository</a>
  <span aria-hidden="true">·</span>
  {href ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a> : <span>{label}</span>}
 </Box>;
}
const magic = new URL(location.href).searchParams.get('magic');
if (magic) history.replaceState(null,'',location.pathname);
const api = async (path:string,body?:Record<string,string>) => {
 const r=await fetch('/api/auth/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;
};
type Draft = {title:string;location:string;timezone:string;start:string;end:string};
const emptyDraft = ():Draft => ({title:'',location:'',timezone:'America/Los_Angeles',start:'',end:''});
const localInput = (timestamp:number,zone:string) => {
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp));
 const part=(key:string)=>parts.find(p=>p.type===key)?.value || '';
 return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};
function Editor({event,onClose,onSaved}:{event:EventRecord|null;onClose:()=>void;onSaved:()=>void}){
 const original=React.useMemo<Draft>(()=>event?{title:event.title,location:event.location,timezone:event.timezone,start:localInput(event.start_at,event.timezone),end:localInput(event.end_at,event.timezone)}:emptyDraft(),[event]);
 const [form,setForm]=useState<Draft>(original),[saving,setSaving]=useState(false),[errors,setErrors]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[discard,setDiscard]=useState(false);
 const changed=JSON.stringify(form)!==JSON.stringify(original);
 const close=()=>{if(saving)return;if(changed)setDiscard(true);else onClose()};
 const set=(key:keyof Draft,value:string)=>setForm(previous=>({...previous,[key]:value}));
 const save=async()=>{if(saving)return;setSaving(true);setErrors({});setMessage('');
  try{
   const response=await fetch(event?'/api/admin/events/'+encodeURIComponent(event.id):'/api/admin/events',{
    method:event?'PUT':'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
    body:JSON.stringify({...form,...(event?{version:event.version}:{})})
   });
   if(!response.ok){const result=await response.json() as {error?:string;fields?:Record<string,string>};
     setErrors(result.fields||{});
     setMessage(response.status===409?'Another administrator changed this event. Copy your edits before reloading.':result.error||'Unable to save event');
     return;
   }
   onSaved();
  }catch{setMessage('Could not reach the server. Your edits are preserved.')}finally{setSaving(false)}
 };
 return <>
 <Dialog open onClose={close} fullWidth maxWidth="sm" aria-labelledby="event-editor-title">
 <DialogTitle id="event-editor-title">{event?'Edit Event':'Add Event'}</DialogTitle>
 <DialogContent><Stack spacing={2} sx={{mt:1}}>
 {message&&<Alert severity="error">{message}</Alert>}
 <TextField label="Title" required inputProps={{maxLength:200}} value={form.title} onChange={e=>set('title',e.target.value)} error={!!errors.title} helperText={errors.title}/>
 <TextField label="Location" required multiline inputProps={{maxLength:500}} value={form.location} onChange={e=>set('location',e.target.value)} error={!!errors.location} helperText={errors.location}/>
 <TextField label="Time zone (IANA)" required value={form.timezone} onChange={e=>set('timezone',e.target.value)} error={!!errors.timezone} helperText={errors.timezone||'Example: America/Los_Angeles'}/>
 <TextField label="Start date and time" type="datetime-local" slotProps={{inputLabel:{shrink:true}}} required value={form.start} onChange={e=>set('start',e.target.value)} error={!!errors.start} helperText={errors.start}/>
 <TextField label="End date and time" type="datetime-local" slotProps={{inputLabel:{shrink:true}}} required value={form.end} onChange={e=>set('end',e.target.value)} error={!!errors.end} helperText={errors.end}/>
 </Stack></DialogContent>
 <DialogActions><Button disabled={saving} onClick={close}>Cancel</Button><Button loading={saving} variant="contained" onClick={()=>void save()}>Save</Button></DialogActions>
 </Dialog>
 <Dialog open={discard} onClose={()=>setDiscard(false)} aria-labelledby="discard-title"><DialogTitle id="discard-title">Discard unsaved changes?</DialogTitle><DialogActions><Button onClick={()=>setDiscard(false)}>Keep editing</Button><Button color="error" onClick={onClose}>Discard changes</Button></DialogActions></Dialog>
 </>;
}
function EventList({admin}:{admin:boolean}){
 const [view,setView]=useState<View>('upcoming'),[events,setEvents]=useState<EventRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,reload]=useState(0);
 const [editor,setEditor]=useState<{open:boolean;event:EventRecord|null}>({open:false,event:null}),[toDelete,setToDelete]=useState<EventRecord|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState('');
 const remove=async()=>{if(!toDelete||deleting)return;setDeleting(true);setDeleteError('');
  try{const response=await fetch('/api/admin/events/'+encodeURIComponent(toDelete.id),{method:'DELETE',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({version:toDelete.version})});
   if(!response.ok){setDeleteError(response.status===409?'This event was changed by another administrator. Refresh the list.':'Unable to delete event');return;}
   setToDelete(null);reload(n=>n+1);
  }catch{setDeleteError('Could not reach the server')}finally{setDeleting(false)}
 };
 useEffect(()=>{let active=true;setLoading(true);setError('');fetch('/api/events?view='+view,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Unable to load events');return r.json()}).then(d=>{if(active)setEvents(d.events)}).catch(e=>{if(active)setError(String(e.message))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[view,revision]);
 const local=(instant:number,timezone:string)=>new Intl.DateTimeFormat('en-US',{dateStyle:'full',timeStyle:'short',timeZone:timezone,timeZoneName:'short'}).format(new Date(instant));
 return <Box component="section" aria-label="Events" sx={{my:5}}>
  {admin&&<Box sx={{display:'flex',justifyContent:'flex-end',mb:2}}><Button variant="contained" onClick={()=>setEditor({open:true,event:null})}>Add Event</Button></Box>}
  <Tabs value={view} onChange={(_,v:View)=>setView(v)} aria-label="Event timeline"><Tab label="Upcoming Events" value="upcoming"/><Tab label="Past Events" value="past"/></Tabs>
  {loading?<Box sx={{p:4}} role="status"><CircularProgress aria-label="Loading events"/></Box>:error?<Stack sx={{p:3}} spacing={2}><Typography role="alert">{error}</Typography><Button onClick={()=>reload(n=>n+1)}>Retry</Button></Stack>:events.length===0?<Box sx={{p:4}}><Typography variant="h6">{view==='upcoming'?'No upcoming events':'No past events yet.'}</Typography>{view==='upcoming'&&<Typography>Check back soon for new opportunities to serve.</Typography>}</Box>:
  <Stack spacing={2} sx={{pt:3}}>{events.map(e=><Card key={e.id} variant="outlined"><CardContent><Typography variant="h6">{e.title}</Typography><Typography sx={{mt:1}}>{local(e.start_at,e.timezone)} – {local(e.end_at,e.timezone)}</Typography><Typography color="text.secondary">{e.timezone}</Typography><Typography sx={{mt:1}}>Location: {e.location}</Typography>{admin&&<Stack direction="row" spacing={1} sx={{mt:2}}><Button onClick={()=>setEditor({open:true,event:e})}>Edit</Button><Button color="error" onClick={()=>{setToDelete(e);setDeleteError('')}}>Delete</Button></Stack>}</CardContent></Card>)}</Stack>}
 {editor.open&&<Editor key={editor.event?.id||'new'} event={editor.event} onClose={()=>setEditor({open:false,event:null})} onSaved={()=>{setEditor({open:false,event:null});reload(n=>n+1)}}/>}
 <Dialog open={!!toDelete} onClose={()=>{if(!deleting)setToDelete(null)}} aria-labelledby="delete-event-title"><DialogTitle id="delete-event-title">Delete {toDelete?.title}?</DialogTitle><DialogContent>{deleteError&&<Alert severity="error">{deleteError}</Alert>}This removes the event from public listings.</DialogContent><DialogActions><Button disabled={deleting} onClick={()=>setToDelete(null)}>Cancel</Button><Button color="error" loading={deleting} onClick={()=>void remove()}>Delete event</Button></DialogActions></Dialog>
 </Box>
}
function SignIn({onAuthChange}:{onAuthChange:(value:boolean)=>void}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[showCode,setShowCode]=useState(false),[message,setMessage]=useState(''),[signed,setSigned]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const refresh=async()=>{try{const me=await api('me');if(me.authenticated){const check=await fetch('/api/admin/dashboard',{credentials:'same-origin',cache:'no-store'});setSigned(check.ok?me.email:null);onAuthChange(check.ok)}else {setSigned(null);onAuthChange(false)}}catch{setSigned(null);onAuthChange(false)}};
 useEffect(()=>{void refresh()},[]);
 const act=async (work:()=>Promise<unknown>)=>{setBusy(true);setMessage('');try{await work()}catch(e){setMessage(e instanceof Error?e.message:'Request failed')}finally{setBusy(false)}};
 return <Box component="section" aria-label="Administrator sign-in" sx={{my:3}}>
 {signed?<Stack spacing={2}><Typography>Signed in as {signed}</Typography><Button variant="outlined" disabled={busy} onClick={()=>void act(async()=>{await api('logout',{});setSigned(null);onAuthChange(false)})}>Sign out</Button></Stack>:
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
 const [admin,setAdmin]=useState(false);
 const dark=useMediaQuery('(prefers-color-scheme: dark)');
 const theme=React.useMemo(()=>createTheme({palette:{mode:dark?'dark':'light',primary:{main:dark?'#f1c232':'#705400'}},shape:{borderRadius:16}}),[dark]);
 return <ThemeProvider theme={theme}><CssBaseline/><AppBar position="static" color="default" elevation={0}><Container><Typography variant="h6" sx={{py:2}}>Serve With SF Fil-Am Lions</Typography></Container></AppBar><Container maxWidth="md" component="main"><Typography variant="h3" component="h1" sx={{mt:5}}>Serve With SF Fil-Am Lions</Typography><Typography color="text.secondary">Making it easier to serve together.</Typography><EventList admin={admin}/><SignIn onAuthChange={setAdmin}/><BuildFooter/></Container></ThemeProvider>
}
createRoot(document.getElementById('app')!).render(<App/>);
