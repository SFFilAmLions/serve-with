import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import dayjs, { type Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AppBar, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Alert, Autocomplete, Snackbar, Container, CssBaseline, Stack, Tab, Tabs, TextField, ThemeProvider, Typography, useMediaQuery, IconButton, Menu, MenuItem, ListItemButton, ListItemText, Divider, Tooltip, Skeleton } from '@mui/material';
import './style.css';
import { createClubTheme } from './theme';
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
if (magic) history.replaceState(null,'','/login');
const api = async (path:string,body?:Record<string,string>) => {
 const r=await fetch('/api/auth/'+path,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin',cache:'no-store'});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;
};
function Editor({event,onClose,onSaved,onReload}:{event:EventRecord|null;onClose:()=>void;onSaved:()=>void;onReload:()=>void}){
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
 <Dialog open={reloadConfirm} onClose={()=>setReloadConfirm(false)} aria-labelledby="reload-title"><DialogTitle id="reload-title">Discard edits and load current event?</DialogTitle><DialogContent>Your unsaved changes will be lost. The event list will reload with the latest saved version.</DialogContent><DialogActions><Button onClick={()=>setReloadConfirm(false)}>Keep editing</Button><Button color="error" onClick={onReload}>Discard edits and reload</Button></DialogActions></Dialog>
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
  {admin&&<Box sx={{display:'flex',justifyContent:'flex-end',mb:2}}><Button variant="contained" onClick={e=>{editorTrigger.current=e.currentTarget;go('/admin/events/new')}}>Add Event</Button></Box>}
  <Tabs value={view} onChange={(_,v:View)=>setView(v)} aria-label="Event timeline"><Tab label="Upcoming Events" value="upcoming"/><Tab label="Past Events" value="past"/></Tabs>
  {loading?<Box sx={{p:4}} role="status"><CircularProgress aria-label="Loading events"/></Box>:error?<Stack sx={{p:3}} spacing={2}><Typography role="alert">{error}</Typography><Button onClick={()=>reload(n=>n+1)}>Retry</Button></Stack>:events.length===0?<Box sx={{p:4}}><Typography variant="h6">{view==='upcoming'?'No upcoming events':'No past events yet.'}</Typography>{view==='upcoming'&&<Typography>Check back soon for new opportunities to serve.</Typography>}</Box>:
  <Stack spacing={0} sx={{pt:3}}>{events.map(e=><Box key={e.id} sx={{py:2,borderBottom:1,borderColor:"divider"}}><Button onClick={()=>go("/events/"+e.id)}>{e.title}</Button><Typography sx={{mt:1}}>{local(e.start_at,e.timezone)} – {local(e.end_at,e.timezone)}</Typography><Typography color="text.secondary">{e.timezone}</Typography><Typography sx={{mt:1}}>Location: {e.location}</Typography>{admin&&<Stack direction="row" spacing={1} sx={{mt:2}}><Button onClick={event=>{editorTrigger.current=event.currentTarget;go('/admin/events/'+e.id+'/edit')}}>Edit</Button><Button onClick={()=>go("/admin/events/new",{duplicate:e})}>Duplicate</Button><Button color="error" onClick={event=>{deleteTrigger.current=event.currentTarget;setToDelete(e);setDeleteError('')}}>Delete</Button></Stack>}</Box>)}</Stack>}
 {editor.open&&<Editor key={editor.event?.id||'new'} event={editor.event} onClose={closeEditor} onSaved={()=>{setNotice(editor.event?'Event updated':'Event created');closeEditor();reload(n=>n+1)}} onReload={()=>{closeEditor();reload(n=>n+1)}}/>}
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
export function App(){
 const [admin,setAdmin]=useState(false);
 const dark=useMediaQuery('(prefers-color-scheme: dark)');
 const theme=React.useMemo(()=>createClubTheme(dark?'dark':'light'),[dark]);
 return <ThemeProvider theme={theme}><CssBaseline/><AppBar position="static" color="default" elevation={0}><Container><Box sx={{py:1.5,display:"flex",alignItems:"center",gap:1.5}}><Box component="img" src="/club-logo.png" alt="San Francisco Fil-Am Lions Club logo" sx={{width:48,height:48,objectFit:"contain"}}/><Typography variant="h6">Serve With SF Fil-Am Lions</Typography></Box></Container></AppBar><Container maxWidth="md" component="main"><Typography variant="h3" component="h1" sx={{mt:5}}>Serve With SF Fil-Am Lions</Typography><Typography color="text.secondary">Making it easier to serve together.</Typography><EventList admin={admin}/><SignIn onAuthChange={setAdmin}/><BuildFooter/></Container></ThemeProvider>
}

type Me = {authenticated:boolean;email?:string;userId?:string;firstName?:string|null;lastName?:string|null;profileComplete?:boolean;agreementCurrent?:boolean;administratorEligible?:boolean;privileged?:boolean};
const requestJson=async(path:string, options?:RequestInit)=>{
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'Request failed');
 return data;
};
const submitJson=(path:string,body:Record<string,unknown>,method='POST')=>requestJson(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const go=(path:string,state?:unknown)=>{history.pushState(state,'',path);window.dispatchEvent(new PopStateEvent('popstate'))};
const formatTime=(value:number,zone:string)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZone:zone,timeZoneName:'short'}).format(new Date(value));

function AuthScreen({me,refresh}:{me:Me;refresh:()=>Promise<void>}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[stage,setStage]=useState<'email'|'code'>('email'),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''),[first,setFirst]=useState(''),[last,setLast]=useState(''),[dob,setDob]=useState('');

 const token=magic;
 const exchanging=useRef(false);
 const work=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn()}catch(err){setMessage(err instanceof Error?err.message:'Unable to complete request')}finally{setBusy(false)}};
 useEffect(()=>{if(!token||exchanging.current)return;exchanging.current=true;history.replaceState(null,'','/login');void work(async()=>{await submitJson('/api/auth/magic',{token});await refresh()})},[token]);
 return <Stack spacing={2} sx={{mt:4,maxWidth:560}}>
 <Typography variant="h4">Sign in</Typography>
 {!me.authenticated&&(stage==='email'?<Box component="form" onSubmit={e=>{e.preventDefault();void work(async()=>{const r=await submitJson('/api/auth/request',{email});setMessage(r.message);setStage('code')})}}><Stack spacing={2}><TextField required type="email" label="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/><Button variant="contained" type="submit" disabled={busy}>Continue</Button></Stack></Box>:
 <Stack spacing={2}><Typography>Check your email at {email}</Typography><Box component="form" onSubmit={e=>{e.preventDefault();void work(async()=>{await submitJson('/api/auth/verify',{email,code});await refresh()})}}><Stack spacing={2}><TextField required label="Eight-digit code" value={code} inputProps={{inputMode:'numeric',maxLength:8,pattern:'[0-9]{8}'}} onChange={e=>setCode(e.target.value)}/><Button type="submit" disabled={busy}>Continue</Button></Stack></Box><Button disabled={busy} onClick={()=>void work(async()=>{await submitJson('/api/auth/request',{email});setMessage('If eligible, a new code will arrive shortly.')})}>Resend code</Button><Button onClick={()=>{setStage('email');setCode('');setMessage('')}}>Use a different email</Button></Stack>)}
 {me.authenticated&&!me.profileComplete&&<Stack spacing={2} component="form" onSubmit={e=>{e.preventDefault();void work(async()=>{await submitJson('/api/auth/profile',{firstName:first,lastName:last,dateOfBirth:dob});await refresh()})}}><Typography variant="h6">Complete your profile</Typography><TextField required label="First name" value={first} onChange={e=>setFirst(e.target.value)}/><TextField required label="Last name" value={last} onChange={e=>setLast(e.target.value)}/><TextField required label="Date of birth" type="date" slotProps={{inputLabel:{shrink:true}}} value={dob} onChange={e=>setDob(e.target.value)}/><Button disabled={busy} type="submit" variant="contained">Save profile</Button></Stack>}
 {me.authenticated&&me.profileComplete&&!me.agreementCurrent&&<Alert severity="info">Your account requires acceptance of the current Terms of Use and Privacy Policy before privileged access. These documents must be approved and published before acceptance can be enabled.</Alert>}
 {me.authenticated&&me.profileComplete&&me.agreementCurrent&&<Button onClick={()=>go('/')}>Continue to events</Button>}
 {message&&<Alert role="status" severity="info">{message}</Alert>}
 </Stack>;
}
function UserView({id,edit}:{id:string;edit:boolean}){
 const [user,setUser]=useState<any>(null),[message,setMessage]=useState(''),[first,setFirst]=useState(''),[last,setLast]=useState(''),[dob,setDob]=useState(''),[dirty,setDirty]=useState(false);
 useEffect(()=>{void requestJson('/api/users/'+encodeURIComponent(id)).then(r=>{setUser(r);setFirst(r.user.first_name||'');setLast(r.user.last_name||'');setDob(r.user.date_of_birth||'')}).catch(e=>setMessage(e.message))},[id]);
 if(message&&!user)return <Alert severity="error">{message}</Alert>;
 if(!user)return <Skeleton height={240}/>;
 const u=user.user;
 return <Stack spacing={2} sx={{my:4}}><Stack direction="row" justifyContent="space-between"><Typography variant="h4">{u.first_name} {u.last_name}</Typography><Tooltip title={edit?'Close':'Edit'}><IconButton aria-label={edit?'Close editor':'Edit profile'} onClick={()=>{if(edit&&dirty&&!confirm('Discard changes?'))return;go('/users/'+id+(edit?'':'/edit'))}}>{edit?'✕':'✎'}</IconButton></Tooltip></Stack>
 {edit?<Stack spacing={2} component="form" onSubmit={ev=>{ev.preventDefault();void submitJson('/api/users/'+id,{firstName:first,lastName:last,...(user.canCorrectDob?{dateOfBirth:dob}:{})},'PUT').then(()=>go('/users/'+id)).catch(e=>setMessage(e.message))}}><TextField label="First name" value={first} onChange={e=>{setFirst(e.target.value);setDirty(true)}}/><TextField label="Last name" value={last} onChange={e=>{setLast(e.target.value);setDirty(true)}}/><TextField label="Email" value={u.email} disabled/>{user.canCorrectDob?<TextField label="Date of birth" type="date" slotProps={{inputLabel:{shrink:true}}} value={dob} onChange={e=>{setDob(e.target.value);setDirty(true)}}/>:<TextField label="Date of birth" value={dob} disabled/>}<Button type="submit" variant="contained">✓ Save</Button></Stack>:<><Typography>Email: {u.email}</Typography><Typography>Date of birth: {u.date_of_birth}</Typography></>}
 {message&&<Alert severity="error">{message}</Alert>}</Stack>;
}
function UsersDirectory(){
 const [people,setPeople]=useState<any[]>([]),[query,setQuery]=useState(''),[sort,setSort]=useState<'first'|'last'>('last'),[direction,setDirection]=useState<'asc'|'desc'>('asc'),[letter,setLetter]=useState(''),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[error,setError]=useState('');
 const load=async(next=0)=>{try{const params=new URLSearchParams({q:query,sort,direction,letter,offset:String(next)});const data=await requestJson('/api/admin/users?'+params);setPeople(old=>next?[...old,...data.users]:data.users);setMore(data.hasMore);setOffset(data.nextOffset);setError('')}catch(e){setError(String(e))}};
 useEffect(()=>{void load(0)},[query,sort,direction,letter]);
 const sortBy=(v:'first'|'last')=>{if(sort===v)setDirection(d=>d==='asc'?'desc':'asc');else{setSort(v);setDirection('asc')}};
 return <Stack sx={{my:4}} spacing={2}><Typography variant="h4">Users</Typography><TextField label="Search name or email" value={query} onChange={e=>setQuery(e.target.value)}/><Stack direction="row" spacing={1}><Button onClick={()=>sortBy('first')}>First name {sort==='first'?(direction==='asc'?'↑':'↓'):''}</Button><Button onClick={()=>sortBy('last')}>Last name {sort==='last'?(direction==='asc'?'↑':'↓'):''}</Button></Stack>
 <Box sx={{display:'flex',gap:1}}><Box sx={{flex:1}}>{people.map(p=><React.Fragment key={p.id}><ListItemButton onClick={()=>go('/users/'+p.id)}><ListItemText primary={p.first_name+' '+p.last_name} secondary={p.email}/></ListItemButton><Divider/></React.Fragment>)}{!people.length&&<Typography>No matching users.</Typography>}{more&&<Button onClick={()=>void load(offset)}>Load more</Button>}</Box><Stack sx={{position:'sticky',top:16,alignSelf:'flex-start'}}>{'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(x=><Button key={x} size="small" aria-label={'Jump to '+x} onClick={()=>setLetter(x)}>{x}</Button>)}<Button size="small" onClick={()=>setLetter('')}>All</Button></Stack></Box>{error&&<Alert severity="error">{error}</Alert>}</Stack>;
}
function EventDetail({id,admin}:{id:string;admin:boolean}){
 const [event,setEvent]=useState<EventRecord|null>(null),[error,setError]=useState('');
 useEffect(()=>{void requestJson('/api/events/'+id).then(r=>setEvent(r.event)).catch(e=>setError(e.message))},[id]);
 if(error)return <Alert severity="error">{error}</Alert>;
 if(!event)return <Skeleton height={200}/>;
 return <Stack spacing={2} sx={{my:4}}><Typography variant="h4">{event.title}</Typography><Typography>{formatTime(event.start_at,event.timezone)} – {formatTime(event.end_at,event.timezone)}</Typography><Typography>{event.location}</Typography>{admin&&<Button onClick={()=>go('/admin/events/'+id+'/edit')}>✎ Edit</Button>}</Stack>;
}

function EventPageEditor({id}:{id?:string}){
 const [draft,setDraft]=useState<Draft>(emptyDraft()),[original,setOriginal]=useState<Draft>(emptyDraft());
 const [version,setVersion]=useState(1),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[more,setMore]=useState(false);
 const [confirmClose,setConfirmClose]=useState(false);
 const duplication=(history.state as {duplicate?:EventRecord}|null)?.duplicate;
 useEffect(()=>{const populate=(event:EventRecord)=>{const value={title:event.title,location:event.location,timezone:event.timezone,start:localInput(event.start_at,event.timezone),end:localInput(event.end_at,event.timezone)};setDraft(value);setOriginal(value);setVersion(event.version)};
  if(id){void requestJson('/api/events/'+id).then(r=>populate(r.event)).catch(e=>setMessage(e.message))}
  else if(duplication)populate(duplication);
 },[id]);
 const update=(key:keyof Draft,value:string)=>setDraft(d=>({...d,[key]:value}));
 const date=(key:'start'|'end')=>draft[key]?dayjs(draft[key]):null;
 const setDate=(key:'start'|'end',v:Dayjs|null)=>{if(!v?.isValid())return;const stamp=v.format('YYYY-MM-DD');setDraft(old=>{const before=old.start.slice(0,10);const next={...old,[key]:stamp+'T'+(old[key].slice(11)||'09:00')};if(key==='start'&&(!old.end||old.end.slice(0,10)===before))next.end=stamp+'T'+(old.end.slice(11)||'10:00');return next})};
 const setTime=(key:'start'|'end',v:Dayjs|null)=>{if(v?.isValid())update(key,(draft[key].slice(0,10)||dayjs().format('YYYY-MM-DD'))+'T'+v.format('HH:mm'))};
 const close=()=>{if(draft.title!==original.title||JSON.stringify(draft)!==JSON.stringify(original))setConfirmClose(true);else go(id?'/events/'+id:'/admin/events')};
 const save=async()=>{const errors=validateDraft(draft);if(Object.keys(errors).length){setMessage(Object.values(errors).join('; '));return}setBusy(true);setMessage('');try{const r=await submitJson(id?'/api/admin/events/'+id:'/api/admin/events',{...draft,...(id?{version}:{})},id?'PUT':'POST');go('/events/'+r.event.id)}catch(e){setMessage(e instanceof Error?e.message:'Save failed; draft retained')}finally{setBusy(false)}};
 const duration=draft.start&&draft.end?dayjs(draft.end).diff(dayjs(draft.start),'minute'):0;
 return <LocalizationProvider dateAdapter={AdapterDayjs}><Stack spacing={2} sx={{my:4,maxWidth:750}}>
 <Stack direction="row" alignItems="center" spacing={1}><Tooltip title="Close"><IconButton aria-label="Close editor" onClick={close}>✕</IconButton></Tooltip><Typography variant="h4" sx={{flex:1}}>{id?'Edit event':'Create event'}</Typography><Tooltip title="Save"><span><IconButton aria-label="Save event" disabled={busy} onClick={()=>void save()}>✓</IconButton></span></Tooltip></Stack>
 {duplication&&!id&&<Alert severity="info">Duplicating {duplication.title}; saving creates a different event.</Alert>}
 {message&&<Alert severity="error">{message}</Alert>}
 <TextField required label="Event title" value={draft.title} onChange={e=>update('title',e.target.value)}/>
 <TextField required label="Location" value={draft.location} onChange={e=>update('location',e.target.value)}/>
 <DatePicker label="Start date" value={date('start')} onChange={v=>setDate('start',v)} slotProps={{textField:{fullWidth:true,required:true}}}/>
 <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TimePicker label="Start time" value={date('start')} onChange={v=>setTime('start',v)} slotProps={{textField:{fullWidth:true}}}/><TimePicker label="End time" value={date('end')} onChange={v=>setTime('end',v)} slotProps={{textField:{fullWidth:true}}}/></Stack>
 {duration>0&&<Typography>Duration: {Math.floor(duration/60)}h {duration%60}m</Typography>}
 <Button onClick={()=>setMore(v=>!v)} aria-expanded={more}>More options</Button>
 {more&&<><DatePicker label="End date" value={date('end')} onChange={v=>setDate('end',v)} slotProps={{textField:{fullWidth:true}}}/><Autocomplete options={timeZones} value={draft.timezone} onChange={(_,v)=>update('timezone',v||'America/Los_Angeles')} renderInput={p=><TextField {...p} label="Time zone"/>}/></>}
 <Button variant="contained" disabled={busy} onClick={()=>void save()}>Save event</Button>
 <Dialog open={confirmClose} onClose={()=>setConfirmClose(false)}><DialogTitle>Discard unsaved changes?</DialogTitle><DialogActions><Button onClick={()=>setConfirmClose(false)}>Keep editing</Button><Button color="error" onClick={()=>go(id?'/events/'+id:'/admin/events')}>Discard changes</Button></DialogActions></Dialog>
 </Stack></LocalizationProvider>;
}

function RoutedApp(){
 const [path,setPath]=useState(location.pathname),[me,setMe]=useState<Me>({authenticated:false}),[appearance,setAppearance]=useState<'light'|'dark'|'system'>(()=>(localStorage.getItem('servewith-appearance') as 'light'|'dark'|'system')||'system'),[anchor,setAnchor]=useState<HTMLElement|null>(null);
 const systemDark=useMediaQuery('(prefers-color-scheme: dark)');
 const theme=React.useMemo(()=>createClubTheme(appearance==='system'?(systemDark?'dark':'light'):appearance),[appearance,systemDark]);
 const refresh=async()=>{try{setMe(await api('me'))}catch{setMe({authenticated:false})}};
 useEffect(()=>{const fn=()=>setPath(location.pathname);addEventListener('popstate',fn);void refresh();return()=>removeEventListener('popstate',fn)},[]);
 const admin=path.startsWith('/admin'),canAdmin=Boolean(me.privileged&&me.administratorEligible);
 const userRoute=path.match(/^\/users\/([0-9a-f-]{36})(\/edit)?$/);
 const eventRoute=path.match(/^\/events\/([0-9a-f-]{36})$/);
 const editRoute=path.match(/^\/admin\/events\/([0-9a-f-]{36})\/edit$/);

 return <ThemeProvider theme={theme}><CssBaseline/><AppBar position="static" color={admin?'primary':'default'} elevation={0}><Container maxWidth="lg"><Stack direction="row" alignItems="center" spacing={2} sx={{py:1}}><Box component="img" src="/club-logo.png" alt="SF Fil-Am Lions logo" sx={{width:42,height:42}}/><Button color="inherit" onClick={()=>go('/')}>Serve With</Button>{admin&&<Typography>Administrator</Typography>}<Box sx={{flexGrow:1}}/><Button color="inherit" onClick={e=>setAnchor(e.currentTarget)} aria-label="Account and appearance menu">{me.authenticated?(me.firstName||me.email||'Account'):'Sign in / Appearance'}</Button><Menu anchorEl={anchor} open={!!anchor} onClose={()=>setAnchor(null)}>{me.authenticated&&<MenuItem onClick={()=>{setAnchor(null);go('/users/'+me.userId)}}>My Profile</MenuItem>}{canAdmin&&<MenuItem onClick={()=>{setAnchor(null);go(admin?'/':'/admin/events')}}>{admin?'Attendee workspace':'Administrator workspace'}</MenuItem>}{(['light','dark','system'] as const).map(mode=><MenuItem key={mode} selected={appearance===mode} onClick={()=>{setAppearance(mode);localStorage.setItem('servewith-appearance',mode);setAnchor(null)}}>{mode[0].toUpperCase()+mode.slice(1)} appearance</MenuItem>)}{me.authenticated?<MenuItem onClick={()=>{setAnchor(null);void api('logout',{}).then(refresh).then(()=>go('/'))}}>Sign out</MenuItem>:<MenuItem onClick={()=>{setAnchor(null);go('/login')}}>Sign in</MenuItem>}</Menu></Stack>{admin&&canAdmin&&<Tabs value={path.startsWith('/admin/users')?'users':'events'} onChange={(_,v)=>go(v==='users'?'/admin/users':'/admin/events')} textColor="inherit" indicatorColor="secondary"><Tab label="Events" value="events"/><Tab label="Users" value="users"/></Tabs>}</Container></AppBar>
 <Container maxWidth="lg" component="main">{path==='/login'?<AuthScreen me={me} refresh={refresh}/>:path==='/admin/events/new'&&canAdmin?<EventPageEditor/>:editRoute&&canAdmin?<EventPageEditor id={editRoute[1]}/>:userRoute?<UserView key={path} id={userRoute[1]} edit={!!userRoute[2]}/>:eventRoute?<EventDetail id={eventRoute[1]} admin={canAdmin}/>:path==='/admin/users'&&canAdmin?<UsersDirectory/>:path.startsWith('/admin')&&!canAdmin?<Alert severity="warning" sx={{mt:3}}>Complete your profile and current agreement to access administrator tools. <Button onClick={()=>go('/login')}>Account setup</Button></Alert>:<><Typography variant="h4" sx={{mt:4}}>{admin?'Manage events':'Serve With SF Fil-Am Lions'}</Typography><EventList admin={canAdmin&&admin}/></>}<BuildFooter/></Container></ThemeProvider>;
}

createRoot(document.getElementById('app')!).render(<RoutedApp/>);
