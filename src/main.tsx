import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AppBar, Box, Button, Card, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Alert, Autocomplete, Snackbar, Container, CssBaseline, Stack, Tab, Tabs, TextField, ThemeProvider, Typography, createTheme, useMediaQuery } from '@mui/material';
import './style.css';
import { type Draft, timeZones, validateDraft, emptyDraft, localInput } from './event-form';

type EventRecord = { id:string; title:string; location:string; timezone:string; start_at:number; end_at:number; version:number };
type View = 'upcoming'|'past';
const repositoryUrl = 'https://github.com/SFFilAmLions/serve-with';
const buildEnvironment = import.meta.env.VITE_DEPLOY_ENV;
const buildSha = import.meta.env.VITE_COMMIT_SHA || '';
const releaseTag = import.meta.env.VITE_RELEASE_TAG || '';
function BuildFooter() {
 const staged = buildEnvironment === 'staging' && /^[a-f0-9]{40}$/.test(buildSha);
 const released = buildEnvironment === 'production' && /^v\d+\.\d+\.\d+$/.test(releaseTag);
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
function Editor({event,onClose,onSaved}:{event:EventRecord|null;onClose:()=>void;onSaved:()=>void}){
 const original=React.useMemo<Draft>(()=>event?{title:event.title,location:event.location,timezone:event.timezone,start:localInput(event.start_at,event.timezone),end:localInput(event.end_at,event.timezone)}:emptyDraft(),[event]);
 const [form,setForm]=useState<Draft>(original),[saving,setSaving]=useState(false),[errors,setErrors]=useState<Record<string,string>>({}),[message,setMessage]=useState(''),[discard,setDiscard]=useState(false),[conflict,setConflict]=useState(false),[reloadConfirm,setReloadConfirm]=useState(false);
 const changed=JSON.stringify(form)!==JSON.stringify(original);
 const close=()=>{if(saving||discard||reloadConfirm)return;if(changed)setDiscard(true);else onClose()};
 const set=(key:keyof Draft,value:string)=>{setForm(previous=>({...previous,[key]:value}));setErrors(previous=>({...previous,[key]:''}));};
 const save=async()=>{if(saving)return;const validation=validateDraft(form);if(Object.keys(validation).length){setErrors(validation);setMessage('Correct the highlighted fields before saving');return;}setSaving(true);setErrors({});setMessage('');
  try{
   const response=await fetch(event?'/api/admin/events/'+encodeURIComponent(event.id):'/api/admin/events',{
    method:event?'PUT':'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
    body:JSON.stringify({...form,...(event?{version:event.version}:{})})
   });
   if(!response.ok){const result=await response.json() as {error?:string;fields?:Record<string,string>};
     setErrors(result.fields||{});
     if(response.status===409)setConflict(true);
     setMessage(response.status===409?'Another administrator changed this event. Your edits are preserved.':result.error||'Unable to save event');
     return;
   }
   onSaved();
  }catch{setMessage('Could not reach the server. Your edits are preserved.')}finally{setSaving(false)}
 };
 return <>
 <Dialog open onClose={close} fullWidth maxWidth="sm" aria-labelledby="event-editor-title" aria-describedby="event-editor-description">
 <DialogTitle id="event-editor-title">{event?'Edit Event':'Add Event'}</DialogTitle>
 <DialogContent><Typography id="event-editor-description" variant="body2" color="text.secondary" sx={{mb:2}}>All event times use the selected time zone. Required fields are marked.</Typography><Stack spacing={2} sx={{mt:1}}>
 {message&&<Alert severity="error" action={conflict?<Button color="inherit" size="small" onClick={()=>setReloadConfirm(true)}>Reload current event</Button>:undefined}>{message}</Alert>}
 <TextField label="Title" required inputProps={{maxLength:200}} value={form.title} onChange={e=>set('title',e.target.value)} error={!!errors.title} helperText={errors.title}/>
 <TextField label="Location" required multiline inputProps={{maxLength:500}} value={form.location} onChange={e=>set('location',e.target.value)} error={!!errors.location} helperText={errors.location}/>
 <Autocomplete options={timeZones} value={form.timezone} onChange={(_,value)=>set('timezone',value||'')} renderInput={params=><TextField {...params} label="Time zone (IANA)" required error={!!errors.timezone} helperText={errors.timezone||'Choose the event’s local time zone'}/>}/>
 <TextField label="Start date and time" type="datetime-local" slotProps={{inputLabel:{shrink:true}}} required value={form.start} onChange={e=>set('start',e.target.value)} error={!!errors.start} helperText={errors.start}/>
 <TextField label="End date and time" type="datetime-local" slotProps={{inputLabel:{shrink:true}}} required value={form.end} onChange={e=>set('end',e.target.value)} error={!!errors.end} helperText={errors.end}/>
 </Stack></DialogContent>
 <DialogActions><Button disabled={saving} onClick={close}>Cancel</Button><Button loading={saving} variant="contained" onClick={()=>void save()}>Save</Button></DialogActions>
 </Dialog>
 <Dialog open={reloadConfirm} onClose={()=>setReloadConfirm(false)} aria-labelledby="reload-title"><DialogTitle id="reload-title">Discard edits and load current event?</DialogTitle><DialogContent>Your unsaved changes will be lost. The event list will reload with the latest saved version.</DialogContent><DialogActions><Button onClick={()=>setReloadConfirm(false)}>Keep editing</Button><Button color="error" onClick={onSaved}>Discard edits and reload</Button></DialogActions></Dialog>
 <Dialog open={discard} onClose={()=>setDiscard(false)} aria-labelledby="discard-title" aria-describedby="discard-description"><DialogTitle id="discard-title">Discard unsaved changes?</DialogTitle><DialogContent id="discard-description">Changes to this event will not be saved.</DialogContent><DialogActions><Button onClick={()=>setDiscard(false)}>Keep editing</Button><Button color="error" onClick={onClose}>Discard changes</Button></DialogActions></Dialog>
 </>;
}
function EventList({admin}:{admin:boolean}){
 const [view,setView]=useState<View>('upcoming'),[events,setEvents]=useState<EventRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,reload]=useState(0);
 const editorTrigger=useRef<HTMLElement|null>(null);
 const deleteTrigger=useRef<HTMLElement|null>(null);
 const restoreFocus=(target:React.RefObject<HTMLElement|null>)=>{requestAnimationFrame(()=>target.current?.focus())};
 const closeEditor=()=>{setEditor({open:false,event:null});restoreFocus(editorTrigger)};
 const closeDelete=()=>{setToDelete(null);restoreFocus(deleteTrigger)};
 const [editor,setEditor]=useState<{open:boolean;event:EventRecord|null}>({open:false,event:null}),[toDelete,setToDelete]=useState<EventRecord|null>(null),[deleting,setDeleting]=useState(false),[deleteError,setDeleteError]=useState(''),[notice,setNotice]=useState('');
 const remove=async()=>{if(!toDelete||deleting)return;setDeleting(true);setDeleteError('');
  try{const response=await fetch('/api/admin/events/'+encodeURIComponent(toDelete.id),{method:'DELETE',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({version:toDelete.version})});
   if(!response.ok){setDeleteError(response.status===409?'This event was changed by another administrator. Refresh the list.':'Unable to delete event');return;}
   closeDelete();setNotice('Event deleted');reload(n=>n+1);
  }catch{setDeleteError('Could not reach the server')}finally{setDeleting(false)}
 };
 useEffect(()=>{let active=true;setLoading(true);setError('');fetch('/api/events?view='+view,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Unable to load events');return r.json()}).then(d=>{if(active)setEvents(d.events)}).catch(e=>{if(active)setError(String(e.message))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[view,revision]);
 const local=(instant:number,timezone:string)=>new Intl.DateTimeFormat('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:timezone,timeZoneName:'short'}).format(new Date(instant));
 return <Box component="section" aria-label="Events" sx={{my:5}}>
  {admin&&<Box sx={{display:'flex',justifyContent:'flex-end',mb:2}}><Button variant="contained" onClick={e=>{editorTrigger.current=e.currentTarget;setEditor({open:true,event:null})}}>Add Event</Button></Box>}
  <Tabs value={view} onChange={(_,v:View)=>setView(v)} aria-label="Event timeline"><Tab label="Upcoming Events" value="upcoming"/><Tab label="Past Events" value="past"/></Tabs>
  {loading?<Box sx={{p:4}} role="status"><CircularProgress aria-label="Loading events"/></Box>:error?<Stack sx={{p:3}} spacing={2}><Typography role="alert">{error}</Typography><Button onClick={()=>reload(n=>n+1)}>Retry</Button></Stack>:events.length===0?<Box sx={{p:4}}><Typography variant="h6">{view==='upcoming'?'No upcoming events':'No past events yet.'}</Typography>{view==='upcoming'&&<Typography>Check back soon for new opportunities to serve.</Typography>}</Box>:
  <Stack spacing={2} sx={{pt:3}}>{events.map(e=><Card key={e.id} variant="outlined"><CardContent><Typography variant="h6">{e.title}</Typography><Typography sx={{mt:1}}>{local(e.start_at,e.timezone)} – {local(e.end_at,e.timezone)}</Typography><Typography color="text.secondary">{e.timezone}</Typography><Typography sx={{mt:1}}>Location: {e.location}</Typography>{admin&&<Stack direction="row" spacing={1} sx={{mt:2}}><Button onClick={event=>{editorTrigger.current=event.currentTarget;setEditor({open:true,event:e})}}>Edit</Button><Button color="error" onClick={event=>{deleteTrigger.current=event.currentTarget;setToDelete(e);setDeleteError('')}}>Delete</Button></Stack>}</CardContent></Card>)}</Stack>}
 {editor.open&&<Editor key={editor.event?.id||'new'} event={editor.event} onClose={closeEditor} onSaved={()=>{setNotice(editor.event?'Event updated':'Event created');closeEditor();reload(n=>n+1)}}/>}
 <Snackbar open={!!notice} autoHideDuration={4500} onClose={()=>setNotice('')} anchorOrigin={{vertical:'bottom',horizontal:'center'}}><Alert severity="success" onClose={()=>setNotice('')}>{notice}</Alert></Snackbar>
 <Dialog open={!!toDelete} onClose={()=>{if(!deleting)closeDelete()}} aria-labelledby="delete-event-title" aria-describedby="delete-event-description"><DialogTitle id="delete-event-title">Delete {toDelete?.title}?</DialogTitle><DialogContent id="delete-event-description">{deleteError&&<Alert severity="error">{deleteError}</Alert>}This removes the event from public listings.</DialogContent><DialogActions><Button disabled={deleting} onClick={closeDelete}>Cancel</Button><Button color="error" loading={deleting} onClick={()=>void remove()}>Delete event</Button></DialogActions></Dialog>
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
