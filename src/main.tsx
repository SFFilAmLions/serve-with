import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import dayjs, { type Dayjs } from 'dayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AppBar, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Alert, Autocomplete, Snackbar, Checkbox, FormControlLabel, Container, CssBaseline, Stack, Tab, Tabs, TextField, ThemeProvider, Typography, useMediaQuery, IconButton, Menu, MenuItem, ListItemButton, Divider, Tooltip, Skeleton, Card, CardContent, CardActions, Chip, SvgIcon, Avatar, ToggleButtonGroup, ToggleButton } from '@mui/material';
import './style.css';
import policyMetadata from './generated/policy-versions.json';
import privacyPolicy from '../policies/privacy/approved-draft.md?raw';
import termsPolicy from '../policies/terms/approved-draft.md?raw';
import { createClubTheme } from './theme';
import { createApiClient } from './generated/openapi-client';
import { type Draft, timeZones, validateDraft, emptyDraft, localInput } from './event-form';

type EventRecord = { id:string; title:string; location:string; timezone:string; start_at:number; end_at:number; version:number; capacity?:number|null; signups_count?:number; spots_available?:number|null };
type View = 'upcoming'|'past';
function Glyph({type}:{type:'sun'|'moon'|'system'|'person'|'swap'|'logout'|'login'|'pin'|'back'|'save'|'edit'|'copy'|'trash'|'github'}) {
 const paths:{[key:string]:string}={
 sun:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
 moon:'M20 15.5A8 8 0 0 1 8.5 4a8.2 8.2 0 1 0 11.5 11.5',
 system:'M3 4h18v13H3zM8 21h8m-4-4v4M12 6v9a4 4 0 0 0 0-9',
 person:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21a8 8 0 0 1 16 0',
 swap:'M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4',
 logout:'M4 4h8v16H4M10 12h11m-4-4 4 4-4 4',
 login:'M4 4h8v16H4M10 12h11m-4-4 4 4-4 4',
 pin:'M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13Zm0-10a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
 back:'M20 12H4m7-7-7 7 7 7',
 save:'M5 12l5 5L20 7',
 edit:'M4 20h4l11-11-4-4L4 16v4',
 copy:'M8 4h12v14H8zM4 8v12h12',
 trash:'M4 7h16M10 4h4M7 7l1 14h8l1-14M10 11v6m4-6v6',
 github:'M9 19c-4 1-4-2-6-2m13 2v-3a4 4 0 0 0-1-3c3 0 6-1 6-6a5 5 0 0 0-1-3 4 4 0 0 0 0-3s-2 0-4 2a15 15 0 0 0-8 0C6 1 4 1 4 1v3a5 5 0 0 0-1 3c0 5 3 6 6 6a4 4 0 0 0-1 3v3'
 };
 return <SvgIcon fontSize="small"><path d={paths[type]} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></SvgIcon>;
}
function AccountAvatar({email,name}:{email?:string;name?:string}) {
 const [src,setSrc]=useState('');
 useEffect(()=>{
  let active=true;
  if(!email){setSrc('');return;}
  void crypto.subtle.digest('SHA-256',new TextEncoder().encode(email.trim().toLowerCase()))
   .then(buf=>{if(active)setSrc('https://www.gravatar.com/avatar/'+Array.from(new Uint8Array(buf)).map(x=>x.toString(16).padStart(2,'0')).join('')+'?d=404&s=64')})
   .catch(()=>setSrc(''));
  return()=>{active=false};
 },[email]);
 const initials=(name||email?.split('@')[0]||'').split(/[\s._-]+/).filter(Boolean).slice(0,2).map(word=>word[0].toUpperCase()).join('')||'?';
 return <Avatar src={src||undefined} alt="" sx={{width:28,height:28,fontSize:12}}>{initials}</Avatar>;
}
function timeZoneOffsetMinutes(instant:number,zone:string) {
 const part=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(new Date(instant)).find(p=>p.type==='timeZoneName')?.value;
 const match=/^GMT([+-])(\d{2}):(\d{2})$/.exec(part||'');
 return part==='GMT'?0:match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3])):null;
}
function EventWhen({event}:{event:EventRecord}){
 const date=(v:number)=>new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:event.timezone}).format(v);
 const time=(v:number)=>new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit',timeZone:event.timezone}).format(v);
 const start=date(event.start_at),end=date(event.end_at);
 const abbreviated=new Intl.DateTimeFormat('en-US',{timeZone:event.timezone,timeZoneName:'short'}).formatToParts(event.start_at).find(p=>p.type==='timeZoneName')?.value||event.timezone;
 return <Stack spacing={1}><Typography>{start===end?start:start+' – '+end}</Typography><Typography variant="body2" color="text.secondary">{time(event.start_at)} – {time(event.end_at)}</Typography><Stack direction="row" gap={1} flexWrap="wrap"><Chip icon={<Glyph type="pin"/>} size="small" label={event.location} variant="outlined"/>{timeZoneOffsetMinutes(event.start_at,event.timezone)!==timeZoneOffsetMinutes(event.start_at,Intl.DateTimeFormat().resolvedOptions().timeZone)&&<Tooltip title={event.timezone}><Chip size="small" variant="outlined" label={abbreviated}/></Tooltip>}</Stack>{event.signups_count!==undefined&&<Typography variant="body2" color="text.secondary">
  {event.signups_count} {event.signups_count===1?'spot taken':'spots taken'} · {event.capacity===null?'Unlimited capacity':event.spots_available===undefined?'Capacity information unavailable':event.spots_available+' spots available'}
 </Typography>}</Stack>;
}

const generatedApi = createApiClient();
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
  <Chip component="a" clickable icon={<Glyph type="github"/>} label="GitHub" href={repositoryUrl} target="_blank" rel="noopener noreferrer" aria-label="Serve With GitHub repository" size="small" variant="outlined"/>{href?<Chip component="a" clickable label={label} href={href} target="_blank" rel="noopener noreferrer" size="small" variant="outlined"/>:<Chip label={label} size="small" variant="outlined"/>}
 </Box>;
}
const magic = new URL(location.href).searchParams.get('magic');
if (magic) history.replaceState(null,'','/login');
const api = async (path:string,body?:Record<string,string>) => {
 if(path==='me'&&!body){const result=await generatedApi.getCurrentSession();if(result.status!==200)throw Error('Could not read session');return result.data;}
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
 useEffect(()=>{let active=true;setLoading(true);setError('');generatedApi.listEvents({view}).then(result=>{if(result.status!==200)throw Error('Unable to load events');return result.data as {events:EventRecord[]}}).then(d=>{if(active)setEvents(d.events)}).catch(e=>{if(active)setError(String(e.message))}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[view,revision]);
 return <Box component="section" aria-label="Events" sx={{my:5}}>
  {admin&&<Box sx={{display:'flex',justifyContent:'flex-end',mb:2}}><Button variant="contained" onClick={e=>{editorTrigger.current=e.currentTarget;go('/admin/events/new')}}>Add Event</Button></Box>}
  <ToggleButtonGroup exclusive color="primary" size="small" value={view} onChange={(_,v:View|null)=>{if(v)setView(v)}} aria-label="Event timeline" sx={{gap:1,'& .MuiToggleButton-root':{borderRadius:'24px !important',px:2,border:'1px solid',borderColor:'divider'}}}><ToggleButton value="upcoming">Upcoming</ToggleButton><ToggleButton value="past">Past</ToggleButton></ToggleButtonGroup>
  {loading?<Box sx={{p:4}} role="status"><CircularProgress aria-label="Loading events"/></Box>:error?<Stack sx={{p:3}} spacing={2}><Typography role="alert">{error}</Typography><Button onClick={()=>reload(n=>n+1)}>Retry</Button></Stack>:events.length===0?<Box sx={{p:4}}><Typography variant="h6">{view==='upcoming'?'No upcoming events':'No past events yet.'}</Typography>{view==='upcoming'&&<Typography>Check back soon for new opportunities to serve.</Typography>}</Box>:
  <Box sx={{display:'grid',gridTemplateColumns:{xs:'1fr',md:'repeat(2,minmax(0,1fr))'},gap:2,pt:3}}>{events.map(e=><Card variant="outlined" key={e.id} sx={{display:'flex',flexDirection:'column'}}><CardContent sx={{flexGrow:1}}><Typography variant="h6" component="h3"><Button sx={{p:0,textAlign:'left',fontSize:'inherit'}} onClick={()=>go('/events/'+e.id)}>{e.title}</Button></Typography><EventWhen event={e}/></CardContent><CardActions sx={{justifyContent:'flex-end',px:2,pb:2}}>{admin?<><Button size="small" startIcon={<Glyph type="edit"/>} onClick={()=>go('/admin/events/'+e.id+'/edit')}>Edit</Button><Button size="small" onClick={()=>go('/admin/events/'+e.id)}>Signups</Button><IconButton size="small" aria-label={'Duplicate '+e.title} onClick={()=>go('/admin/events/new',{duplicate:e})}><Glyph type="copy"/></IconButton><IconButton size="small" color="error" aria-label={'Delete '+e.title} onClick={event=>{deleteTrigger.current=event.currentTarget;setToDelete(e);setDeleteError('')}}><Glyph type="trash"/></IconButton></>:<Button size="small" onClick={()=>go('/events/'+e.id)}>Details</Button>}</CardActions></Card>)}</Box>}
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
 return <ThemeProvider theme={theme}><CssBaseline/><AppBar position="static" color="default" elevation={0}><Container><Box sx={{py:1.5,display:"flex",alignItems:"center",gap:1.5}}><Box component="img" src="/club-logo.png" alt="San Francisco Fil-Am Lions Club logo" sx={{width:48,height:48,objectFit:"contain"}}/><Typography variant="h6">Serve With Lions</Typography></Box></Container></AppBar><Container maxWidth="md" component="main"><Typography variant="h3" component="h1" sx={{mt:5}}>Serve With SF Fil-Am Lions</Typography><Typography color="text.secondary">Making it easier to serve together.</Typography><EventList admin={admin}/><SignIn onAuthChange={setAdmin}/><Box sx={{mt:3,display:'flex',gap:2}}><a href="/terms">Terms of Use</a><a href="/privacy">Privacy Policy</a></Box><BuildFooter/></Container></ThemeProvider>
}

type Me = {requiredVersions?:{terms:string;privacy:string}|null;authenticated:boolean;email?:string;userId?:string;firstName?:string|null;lastName?:string|null;profileComplete?:boolean;agreementCurrent?:boolean;administratorEligible?:boolean;privileged?:boolean};
const requestJson=async(path:string, options?:RequestInit)=>{
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options});
 const data=await response.json();
 if(!response.ok)throw new Error(data.error||'Request failed');
 return data;
};
const submitJson=(path:string,body:Record<string,unknown>,method='POST')=>requestJson(path,{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const go=(path:string,state?:unknown)=>{history.pushState(state,'',path);window.dispatchEvent(new PopStateEvent('popstate'))};

type TurnstileApi={render:(element:HTMLElement,options:{sitekey:string;action:string;callback:(token:string)=>void;'expired-callback':()=>void;'error-callback':()=>void})=>string;remove:(id:string)=>void};
function LoginChallenge({siteKey,onToken}:{siteKey:string;onToken:(token:string)=>void}){
 const host=useRef<HTMLDivElement|null>(null);
 useEffect(()=>{
  let active=true,widget:string|undefined;
  const win=window as Window & {turnstile?:TurnstileApi};
  const render=()=>{if(!active||!host.current||!win.turnstile||widget)return;widget=win.turnstile.render(host.current,{sitekey:siteKey,action:'request-login',callback:onToken,'expired-callback':()=>onToken(''),'error-callback':()=>onToken('')})};
  const scriptId='servewith-turnstile-script';
  let script=document.getElementById(scriptId) as HTMLScriptElement|null;
  if(!script){script=document.createElement('script');script.id=scriptId;script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;document.head.appendChild(script)}
  script.addEventListener('load',render);render();
  return()=>{active=false;script?.removeEventListener('load',render);if(widget&&win.turnstile)win.turnstile.remove(widget);onToken('')};
 },[siteKey]);
 return <Box ref={host} aria-label="Security verification"/>;
}

function AuthScreen({me,refresh}:{me:Me;refresh:()=>Promise<void>}){
 const [email,setEmail]=useState(''),[code,setCode]=useState(''),[stage,setStage]=useState<'email'|'code'>('email'),[busy,setBusy]=useState(false);
 const [message,setMessage]=useState(''),[first,setFirst]=useState(''),[last,setLast]=useState(''),[dob,setDob]=useState('');
 const [turnstileKey,setTurnstileKey]=useState<string|null>(null),[captchaReady,setCaptchaReady]=useState(false),[captchaToken,setCaptchaToken]=useState(''),[captchaRound,setCaptchaRound]=useState(0);
 useEffect(()=>{void generatedApi.getTurnstileConfig().then(r=>{if(r.status!==200)throw Error('Unable to load verification settings');const data=r.data as {siteKey:string|null};setTurnstileKey(data.siteKey||null);setCaptchaReady(true)}).catch(()=>setCaptchaReady(false))},[]);
 const requestCode=async()=>{if(!captchaReady||(turnstileKey&&!captchaToken))throw Error('Complete the security check first');try{return await submitJson('/api/auth/request',{email,turnstileToken:captchaToken})}finally{setCaptchaToken('');setCaptchaRound(n=>n+1)}};

 const token=magic;
 const exchanging=useRef(false);
 const work=async(fn:()=>Promise<void>)=>{setBusy(true);setMessage('');try{await fn()}catch(err){setMessage(err instanceof Error?err.message:'Unable to complete request')}finally{setBusy(false)}};
 useEffect(()=>{if(!token||exchanging.current)return;exchanging.current=true;history.replaceState(null,'','/login');void work(async()=>{await submitJson('/api/auth/magic',{token});await refresh()})},[token]);
 return <Stack spacing={2} sx={{mt:4,maxWidth:560}}>
 <Typography variant="h4">Sign in</Typography>
 {!me.authenticated&&turnstileKey&&<LoginChallenge key={captchaRound} siteKey={turnstileKey} onToken={setCaptchaToken}/>}
 {!me.authenticated&&(stage==='email'?<Box component="form" onSubmit={e=>{e.preventDefault();void work(async()=>{const r=await requestCode();setMessage(r.message);setStage('code')})}}><Stack spacing={2}><TextField required type="email" label="Email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email"/><Button variant="contained" type="submit" disabled={busy||!captchaReady||Boolean(turnstileKey&&!captchaToken)}>Continue</Button></Stack></Box>:
 <Stack spacing={2}><Typography>Check your email at {email}</Typography><Box component="form" onSubmit={e=>{e.preventDefault();void work(async()=>{await submitJson('/api/auth/verify',{email,code});await refresh()})}}><Stack spacing={2}><TextField required label="Eight-digit code" value={code} inputProps={{inputMode:'numeric',maxLength:8,pattern:'[0-9]{8}'}} onChange={e=>setCode(e.target.value)}/><Button type="submit" disabled={busy}>Continue</Button></Stack></Box><Button disabled={busy||!captchaReady||Boolean(turnstileKey&&!captchaToken)} onClick={()=>void work(async()=>{await requestCode();setMessage('If eligible, a new code will arrive shortly.')})}>Resend code</Button><Button onClick={()=>{setStage('email');setCode('');setMessage('')}}>Use a different email</Button></Stack>)}
 {me.authenticated&&!me.profileComplete&&<Stack spacing={2} component="form" onSubmit={e=>{e.preventDefault();void work(async()=>{await submitJson('/api/auth/profile',{firstName:first,lastName:last,dateOfBirth:dob});await refresh()})}}><Typography variant="h6">Complete your profile</Typography><TextField required label="First name" value={first} onChange={e=>setFirst(e.target.value)}/><TextField required label="Last name" value={last} onChange={e=>setLast(e.target.value)}/><TextField required label="Date of birth" type="date" slotProps={{inputLabel:{shrink:true}}} value={dob} onChange={e=>setDob(e.target.value)}/><Button disabled={busy} type="submit" variant="contained">Save profile</Button></Stack>}
 {me.authenticated&&me.profileComplete&&!me.agreementCurrent&&<AgreementCompletion me={me} refresh={refresh}/>}
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
 return <Stack spacing={2} sx={{my:4}}><Button size="small" startIcon={<Glyph type="back"/>} sx={{alignSelf:"flex-start"}} onClick={()=>go("/admin/users")}>Back to users</Button><Stack direction="row" justifyContent="space-between"><Typography variant="h4">{u.first_name} {u.last_name}</Typography><Tooltip title={edit?'Close':'Edit'}><IconButton aria-label={edit?'Close editor':'Edit profile'} onClick={()=>{if(edit&&dirty&&!confirm('Discard changes?'))return;go('/users/'+id+(edit?'':'/edit'))}}>{edit?'✕':'✎'}</IconButton></Tooltip></Stack>
 {edit?<Stack spacing={2} component="form" onSubmit={ev=>{ev.preventDefault();void submitJson('/api/users/'+id,{firstName:first,lastName:last,...(user.canCorrectDob?{dateOfBirth:dob}:{})},'PUT').then(()=>go('/users/'+id)).catch(e=>setMessage(e.message))}}><TextField label="First name" value={first} onChange={e=>{setFirst(e.target.value);setDirty(true)}}/><TextField label="Last name" value={last} onChange={e=>{setLast(e.target.value);setDirty(true)}}/><TextField label="Email" value={u.email} disabled/>{user.canCorrectDob?<TextField label="Date of birth" type="date" slotProps={{inputLabel:{shrink:true}}} value={dob} onChange={e=>{setDob(e.target.value);setDirty(true)}}/>:<TextField label="Date of birth" value={dob} disabled/>}<Button type="submit" variant="contained">✓ Save</Button></Stack>:<><Typography>Email: {u.email}</Typography><Typography>Date of birth: {u.date_of_birth}</Typography></>}
 {message&&<Alert severity="error">{message}</Alert>}</Stack>;
}
function UsersDirectory(){
 const [people,setPeople]=useState<any[]>([]),[query,setQuery]=useState(()=>sessionStorage.getItem('sw-users-q')||''),[sort,setSort]=useState<'first'|'last'>(()=>sessionStorage.getItem('sw-users-sort')==='first'?'first':'last'),[direction,setDirection]=useState<'asc'|'desc'>(()=>sessionStorage.getItem('sw-users-direction')==='desc'?'desc':'asc'),[offset,setOffset]=useState(0),[more,setMore]=useState(false),[error,setError]=useState('');
 const load=async(next=0)=>{try{const params=new URLSearchParams({q:query,sort,direction,offset:String(next)});const data=await requestJson('/api/admin/users?'+params);setPeople(old=>next?[...old,...data.users]:data.users);setMore(data.hasMore);setOffset(data.nextOffset);setError('')}catch(e){setError(String(e))}};
 useEffect(()=>{sessionStorage.setItem('sw-users-q',query);sessionStorage.setItem('sw-users-sort',sort);sessionStorage.setItem('sw-users-direction',direction);void load(0)},[query,sort,direction]);
 const sortBy=(v:'first'|'last')=>{if(sort===v)setDirection(d=>d==='asc'?'desc':'asc');else{setSort(v);setDirection('asc')}};
 const gridColumns={xs:'minmax(0,1fr)',sm:'minmax(0,1fr) minmax(0,1fr)',lg:'minmax(0,1fr) minmax(0,1fr) minmax(0,2fr)'};
 return <Stack sx={{my:4}} spacing={2}><Typography variant="h4">Users</Typography><TextField label="Search name or email" value={query} onChange={e=>setQuery(e.target.value)}/><Box sx={{display:{xs:'none',sm:'grid'},gridTemplateColumns:gridColumns,gap:1}}>
 <Button sx={{justifyContent:'flex-start'}} onClick={()=>sortBy('first')}>First name {sort==='first'?(direction==='asc'?'↑':'↓'):''}</Button>
 <Button sx={{justifyContent:'flex-start'}} onClick={()=>sortBy('last')}>Last name {sort==='last'?(direction==='asc'?'↑':'↓'):''}</Button>
 <Typography sx={{display:{xs:'none',lg:'block'},px:1,alignSelf:'center',color:'text.secondary'}}>Email</Typography>
 </Box>
 <Box sx={{display:'flex',gap:1}}><Box sx={{flex:1,minWidth:0}}>{people.map(p=><React.Fragment key={p.id}><ListItemButton onClick={()=>go('/users/'+p.id)} sx={{display:'grid',gridTemplateColumns:gridColumns,gap:1,minHeight:52}}>
 <Typography sx={{display:{xs:'none',sm:'block'},overflow:'hidden',textOverflow:'ellipsis'}}>{p.first_name||'—'}</Typography>
 <Typography sx={{display:{xs:'none',sm:'block'},overflow:'hidden',textOverflow:'ellipsis'}}>{p.last_name||'—'}</Typography>
 <Typography sx={{display:{xs:'block',sm:'none'}}}>{[p.first_name,p.last_name].filter(Boolean).join(' ')||p.email}</Typography>
 <Typography color="text.secondary" sx={{display:{xs:'none',lg:'block'},overflow:'hidden',textOverflow:'ellipsis'}}>{p.email}</Typography>
 </ListItemButton><Divider/></React.Fragment>)}{!people.length&&<Typography sx={{p:2}}>No matching users. Try a different name or email.</Typography>}{more&&<Button onClick={()=>void load(offset)}>Load more</Button>}</Box>
 </Box>{error&&<Alert severity="error">{error}</Alert>}</Stack>;
}

function EventDetail({id,admin,me}:{id:string;admin:boolean;me:Me}){
 const [event,setEvent]=useState<EventRecord|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [signup,setSignup]=useState<{id:string}|null>(null),[participants,setParticipants]=useState<{name:string}[]>([]);
 const [busy,setBusy]=useState(false);
 const eligible=Boolean(me.authenticated&&me.profileComplete&&me.agreementCurrent);
 const refresh=async()=>{
   const response=await generatedApi.getEvent({id});
   if(response.status!==200)throw Error('Unable to load event');
   setEvent((response.data as {event:EventRecord}).event);
   if(eligible){
     const current=await generatedApi.getMyEventSignup({id});
     if(current.status===200){
       const record=(current.data as {signup:{id:string}|null}).signup;
       setSignup(record);
       if(record){
         const roster=await generatedApi.getEventParticipants({id});
         setParticipants(roster.status===200?(roster.data as {participants:{name:string}[]}).participants:[]);
       }else setParticipants([]);
     }
   }
 };
 useEffect(()=>{let active=true;setError('');void refresh().catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load event')});return()=>{active=false}},[id,eligible]);
 const act=async(action:'signup'|'withdraw')=>{
   if(!me.authenticated){localStorage.setItem('servewith-pending-signup',JSON.stringify({id,expiresAt:Date.now()+3600000}));go('/login');return;}
   if(!eligible){go('/login');return;}
   if(busy)return;
   setBusy(true);setError('');setNotice('');
   try {
     const result=action==='signup'?await generatedApi.signUpForEvent({id}):await generatedApi.withdrawFromEvent({id});
     if(result.status!==201&&result.status!==200){
       const detail=result.data as {error?:string};
       throw Error(detail?.error||'Unable to update signup');
     }
     await refresh();
     setNotice(action==='signup'?'You have signed up for this event.':'Your signup has been withdrawn.');
   }catch(e){setError(e instanceof Error?e.message:'Unable to update signup');}
   finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!eligible||!event)return;
  const raw=localStorage.getItem('servewith-pending-signup');
  if(!raw)return;
  try{
   const pending=JSON.parse(raw) as {id?:string;expiresAt?:number};
   if(!pending.expiresAt||pending.expiresAt<Date.now()){localStorage.removeItem('servewith-pending-signup');return;}
   if(pending.id!==id)return;
   localStorage.removeItem('servewith-pending-signup');
   if(event.start_at<=Date.now()){setError('Signups closed when the event started.');return;}
   if(event.spots_available===0){setError('This event is full.');return;}
   if(!signup)void act('signup');
  }catch{localStorage.removeItem('servewith-pending-signup');}
 },[id,eligible,event?.id]);
 if(error&&!event)return <Alert severity="error" role="alert">{error}</Alert>;
 if(!event)return <Skeleton height={200}/>;
 const closed=Date.now()>=event.start_at;
 const full=event.spots_available===0;
 return <Stack spacing={2} sx={{my:4}}>
  <Button size="small" startIcon={<Glyph type="back"/>} sx={{alignSelf:"flex-start"}} onClick={()=>go(admin?"/admin/events":"/")}>Back to events</Button>
  <Typography variant="h4">{event.title}</Typography>
  <EventWhen event={event}/>
  {error&&<Alert severity="error" role="alert">{error}</Alert>}
  {notice&&<Alert severity="success" role="status">{notice}</Alert>}
  {!closed&&(!full||signup)&&<Button variant="contained" disabled={busy} sx={{alignSelf:'flex-start'}} onClick={()=>void act(signup?'withdraw':'signup')}>
   {signup?'Withdraw':eligible?'Sign up as '+(me.firstName||'me'):'Sign up'}
  </Button>}
  {closed&&<Alert severity="info">Signups closed when the event started.</Alert>}
  {!closed&&full&&!signup&&<Alert severity="info">This event is full.</Alert>}
  {signup&&<Box><Typography variant="h6">Participants</Typography>
   {participants.map((participant,index)=><Typography key={index}>{participant.name}</Typography>)}
  </Box>}
  
 </Stack>;
}

function EventPageEditor({id}:{id?:string}){
 const [draft,setDraft]=useState<Draft>(emptyDraft()),[original,setOriginal]=useState<Draft>(emptyDraft());
 const [version,setVersion]=useState(1),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[more,setMore]=useState(false);
 const [confirmClose,setConfirmClose]=useState(false);
 const duplication=(history.state as {duplicate?:EventRecord}|null)?.duplicate;
 useEffect(()=>{const populate=(event:EventRecord)=>{const value={title:event.title,location:event.location,timezone:event.timezone,start:localInput(event.start_at,event.timezone),end:localInput(event.end_at,event.timezone)};setDraft(value);setOriginal(value);setVersion(event.version)};
  if(id){void generatedApi.getEvent({id}).then(r=>{if(r.status!==200)throw Error('Unable to load event');populate((r.data as {event:EventRecord}).event)}).catch(e=>setMessage(e.message))}
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
 <Stack direction="row" alignItems="center" spacing={1}><Tooltip title="Back"><IconButton aria-label="Back" onClick={close}><Glyph type="back"/></IconButton></Tooltip><Typography variant="h4" sx={{flex:1}}>{id?'Edit event':'Create event'}</Typography></Stack>
 {duplication&&!id&&<Alert severity="info">Duplicating {duplication.title}; saving creates a different event.</Alert>}
 {message&&<Alert severity="error">{message}</Alert>}
 <TextField required label="Event title" value={draft.title} onChange={e=>update('title',e.target.value)}/>
 <TextField required label="Location" value={draft.location} onChange={e=>update('location',e.target.value)}/>
 <DatePicker label="Start date" value={date('start')} onChange={v=>setDate('start',v)} slotProps={{textField:{fullWidth:true,required:true}}}/>
 <Stack direction={{xs:'column',sm:'row'}} spacing={2}><TimePicker label="Start time" value={date('start')} onChange={v=>setTime('start',v)} slotProps={{textField:{fullWidth:true}}}/><TimePicker label="End time" value={date('end')} onChange={v=>setTime('end',v)} slotProps={{textField:{fullWidth:true}}}/></Stack>
 {duration>0&&<Typography>Duration: {Math.floor(duration/60)}h {duration%60}m</Typography>}
 <Button onClick={()=>setMore(v=>!v)} aria-expanded={more}>More options</Button>
 {more&&<><DatePicker label="End date" value={date('end')} onChange={v=>setDate('end',v)} slotProps={{textField:{fullWidth:true}}}/><Autocomplete options={timeZones} value={draft.timezone} onChange={(_,v)=>update('timezone',v||'America/Los_Angeles')} renderInput={p=><TextField {...p} label="Time zone"/>}/></>}
 <Stack direction="row" spacing={1} justifyContent="flex-end"><Button size="small" onClick={close}>Cancel</Button><Button size="small" variant="contained" startIcon={<Glyph type="save"/>} disabled={busy} onClick={()=>void save()}>Save event</Button></Stack>
 <Dialog open={confirmClose} onClose={()=>setConfirmClose(false)}><DialogTitle>Discard unsaved changes?</DialogTitle><DialogActions><Button onClick={()=>setConfirmClose(false)}>Keep editing</Button><Button color="error" onClick={()=>go(id?'/events/'+id:'/admin/events')}>Discard changes</Button></DialogActions></Dialog>
 </Stack></LocalizationProvider>;
}


const policyVersion = policyMetadata;
function PolicyPage({kind}:{kind:'terms'|'privacy'}) {
 const source=kind==='terms'?termsPolicy:privacyPolicy;
 const title=kind==='terms'?'Terms of Use':'Privacy Policy';
 const renderInline=(line:string)=>line.split(/(\*\*[^*]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part);
 return <Box component="article" sx={{my:4,maxWidth:850}}>
  <Typography variant="h4" component="h1" gutterBottom>{title}</Typography>
  <Typography color="text.secondary" sx={{mb:3}}>Last modified {new Date(policyVersion[kind].modifiedAt).toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})} · Revision {policyVersion[kind].commit.slice(0,12)} · Effective October 11, 2026</Typography>
  {source.split('\n').map((line,i)=>{
    if(!line.trim()||line.startsWith('# '))return null;
    if(line.startsWith('### '))return <Typography key={i} variant="h6" component="h2" sx={{mt:3,mb:1}}>{renderInline(line.slice(4))}</Typography>;
    if(line.startsWith('- '))return <Typography key={i} component="p" sx={{pl:3,mb:0.75}}>• {renderInline(line.slice(2))}</Typography>;
    return <Typography key={i} component="p" sx={{mb:1.5}}>{renderInline(line)}</Typography>;
  })}
  <Typography sx={{mt:3}}><a href={kind==='terms'?'/privacy':'/terms'}>Read the {kind==='terms'?'Privacy Policy':'Terms of Use'}</a></Typography>
 </Box>;
}
function AgreementCompletion({me,refresh}:{me:Me;refresh:()=>Promise<void>}) {
 const [checked,setChecked]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const versions=me.requiredVersions;
 const submit=async()=>{
  if(!checked||!versions)return;
  setSaving(true);setError('');
  try {
   await submitJson('/api/auth/agreements',{accepted:true,termsVersion:versions.terms,privacyVersion:versions.privacy});
   await refresh();
  } catch(e) {setError(e instanceof Error?e.message:'Could not save acceptance');setChecked(false)}
  finally {setSaving(false)}
 };
 return <Stack spacing={2} sx={{mt:3,maxWidth:650}}>
  <Typography variant="h6">Review and accept current policies</Typography>
  <Typography>Read the <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> (version {versions?.terms||policyVersion.terms.version}).</Typography>
  <FormControlLabel control={<Checkbox checked={checked} onChange={e=>setChecked(e.target.checked)}/>} label="I have read and agree to the Terms of Use and acknowledge the Privacy Policy."/>
  {!versions&&<Alert severity="warning">Required policy versions are unavailable. Acceptance is disabled.</Alert>}
  {error&&<Alert severity="error" role="alert">{error}</Alert>}
  <Button variant="contained" disabled={!checked||!versions||saving} onClick={()=>void submit()}>Accept and continue</Button>
 </Stack>;
}

function AdminEventSignups({id}:{id:string}){
 const [entries,setEntries]=useState<{id:string;user_id:string;first_name:string|null;last_name:string|null;email:string|null;created_at:number;deleted_at:number|null}[]>([]);
 const [query,setQuery]=useState(''),[people,setPeople]=useState<{id:string;first_name:string|null;last_name:string|null;email:string|null}[]>([]);
 const [selected,setSelected]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 const load=async()=>{
  const result=await generatedApi.listAdminEventSignups({id});
  if(result.status!==200)throw Error((result.data as {error?:string}).error||'Unable to load roster');
  setEntries((result.data as {signups:typeof entries}).signups);
 };
 useEffect(()=>{void load().catch(e=>setError(e instanceof Error?e.message:'Unable to load roster'))},[id]);
 const search=async()=>{
  setError('');
  try{const result=await requestJson('/api/admin/users?q='+encodeURIComponent(query));setPeople(result.users);}
  catch(e){setError(e instanceof Error?e.message:'Unable to find users');}
 };
 const act=async(kind:'signup'|'withdraw',userId:string)=>{
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{
   const response=kind==='signup'?await generatedApi.adminSignUpAttendee({id,body:{userId}})
     :await generatedApi.adminWithdrawAttendee({id,body:{userId}});
   if(response.status!==201&&response.status!==200)throw Error((response.data as {error?:string}).error||'Signup update failed');
   await load();setNotice(kind==='signup'?'Attendee signed up':'Attendee withdrawn');
  }catch(e){setError(e instanceof Error?e.message:'Signup update failed');}finally{setBusy(false);}
 };
 return <Stack spacing={2} sx={{my:4}}>
  <Button sx={{alignSelf:'flex-start'}} onClick={()=>go('/admin/events')}>Back to admin events</Button>
  <Typography variant="h4">Manage event signups</Typography>
  {error&&<Alert severity="error" role="alert">{error}</Alert>}
  {notice&&<Alert severity="success" role="status">{notice}</Alert>}
  <Typography variant="h6">Add an attendee</Typography>
  <Stack direction={{xs:'column',sm:'row'}} spacing={1}>
   <TextField size="small" label="Search attendees by name or email" value={query} onChange={e=>setQuery(e.target.value)}/>
   <Button onClick={()=>void search()}>Search users</Button>
  </Stack>
  {people.length>0&&<Autocomplete options={people} value={people.find(p=>p.id===selected)||null}
    getOptionLabel={p=>[p.first_name,p.last_name].filter(Boolean).join(' ')||p.email||'Unnamed user'}
    onChange={(_,p)=>setSelected(p?.id||'')}
    renderInput={params=><TextField {...params} label="Select attendee"/>}/>}
  <Button variant="contained" sx={{alignSelf:'flex-start'}} disabled={!selected||busy} onClick={()=>void act('signup',selected)}>Confirm signup</Button>
  <Typography variant="h6">Roster and history</Typography>
  {entries.length===0?<Typography>No signups yet.</Typography>:entries.map(entry=><Card key={entry.id} variant="outlined"><CardContent>
   <Typography>{[entry.first_name,entry.last_name].filter(Boolean).join(' ')||'Unnamed attendee'}</Typography>
   <Typography variant="body2" color="text.secondary">{entry.email||'No email'} · {entry.deleted_at===null?'Active':'Withdrawn'}</Typography>
   <Typography variant="body2" color="text.secondary">Added {new Date(entry.created_at).toLocaleString()}</Typography>
   {entry.deleted_at!==null&&<Typography variant="body2">Withdrawn {new Date(entry.deleted_at).toLocaleString()}</Typography>}
   {entry.deleted_at===null&&<Button color="error" disabled={busy} onClick={()=>void act('withdraw',entry.user_id)}>Withdraw attendee</Button>}
  </CardContent></Card>)}
 </Stack>;
}

function MySignups({me}:{me:Me}){
 const [items,setItems]=useState<{id:string;event_id:string;created_at:number;deleted_at:number|null;title:string;start_at:number;end_at:number}[]>([]);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
  if(!me.authenticated||!me.profileComplete||!me.agreementCurrent){setLoading(false);return;}
  let active=true;
  void generatedApi.listMySignups().then(result=>{
   if(result.status!==200)throw Error((result.data as {error?:string}).error||'Unable to load signups');
   if(active)setItems((result.data as {signups:typeof items}).signups);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load signups')})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[me.authenticated,me.profileComplete,me.agreementCurrent]);
 if(!me.authenticated||!me.profileComplete||!me.agreementCurrent)
  return <Stack sx={{my:4}} spacing={2}><Typography variant="h4">My signups</Typography><Alert severity="info">Sign in and complete your account to see your event signups.</Alert><Button onClick={()=>go('/login')}>Complete account</Button></Stack>;
 return <Stack spacing={2} sx={{my:4}}><Typography variant="h4">My signups</Typography>
  {loading?<CircularProgress aria-label="Loading signups"/>:error?<Alert severity="error" role="alert">{error}</Alert>:items.length===0?<Typography>No signups yet.</Typography>:
   items.map(item=><Card variant="outlined" key={item.id}><CardContent>
    <Typography variant="h6">{item.title}</Typography>
    <Typography color="text.secondary">{new Date(item.start_at).toLocaleString()} · {item.deleted_at===null?'Active signup':'Withdrawn'}</Typography>
    <Typography variant="body2" color="text.secondary">Signed up {new Date(item.created_at).toLocaleString()}</Typography>
    {item.deleted_at!==null&&<Typography variant="body2" color="text.secondary">Withdrawn {new Date(item.deleted_at).toLocaleString()}</Typography>}
    <Button size="small" onClick={()=>go('/events/'+item.event_id)}>View event</Button>
   </CardContent></Card>)}
 </Stack>;
}

function RoutedApp(){
 const [path,setPath]=useState(location.pathname),[me,setMe]=useState<Me>({authenticated:false}),[appearance,setAppearance]=useState<'light'|'dark'|'system'>(()=>(localStorage.getItem('servewith-appearance') as 'light'|'dark'|'system')||'system'),[anchor,setAnchor]=useState<HTMLElement|null>(null),[appearanceAnchor,setAppearanceAnchor]=useState<HTMLElement|null>(null);
 const systemDark=useMediaQuery('(prefers-color-scheme: dark)');
 const theme=React.useMemo(()=>createClubTheme(appearance==='system'?(systemDark?'dark':'light'):appearance),[appearance,systemDark]);
 const refresh=async()=>{try{setMe(await api('me'))}catch{setMe({authenticated:false})}};
 useEffect(()=>{const fn=()=>setPath(location.pathname);addEventListener('popstate',fn);void refresh();return()=>removeEventListener('popstate',fn)},[]);
 const admin=path.startsWith('/admin'),canAdmin=Boolean(me.privileged&&me.administratorEligible);
 useEffect(()=>{
  if(!me.authenticated||!me.profileComplete||!me.agreementCurrent||path!=='/login')return;
  const raw=localStorage.getItem('servewith-pending-signup');
  if(!raw)return;
  try{
   const pending=JSON.parse(raw) as {id?:string;expiresAt?:number};
   if(pending.expiresAt&&pending.expiresAt>Date.now()&&pending.id&&/^[0-9a-f-]{36}$/.test(pending.id))
    go('/events/'+pending.id);
   else localStorage.removeItem('servewith-pending-signup');
  }catch{localStorage.removeItem('servewith-pending-signup');}
 },[me.authenticated,me.profileComplete,me.agreementCurrent,path]);
 const userRoute=path.match(/^\/users\/([0-9a-f-]{36})(\/edit)?$/);
 const eventRoute=path.match(/^\/events\/([0-9a-f-]{36})$/);
 const adminEventRoute=path.match(/^\/admin\/events\/([0-9a-f-]{36})$/);
 const editRoute=path.match(/^\/admin\/events\/([0-9a-f-]{36})\/edit$/);

 return <ThemeProvider theme={theme}><CssBaseline/><AppBar position="static" color="default" elevation={0} sx={{borderBottom:1,borderColor:'divider'}}><Container maxWidth="lg"><Stack direction="row" alignItems="center" spacing={1} sx={{py:1}}><Box component="img" src="/club-logo.png" alt="SF Fil-Am Lions logo" sx={{width:40,height:40}}/><Button color="inherit" onClick={()=>go('/')} sx={{fontWeight:700}}>Serve With Lions</Button>{admin&&<Chip size="small" color="primary" variant="outlined" label="Administrator"/>}<Box sx={{flexGrow:1}}/>{canAdmin&&<Button size="small" color="inherit" startIcon={<Glyph type="swap"/>} sx={{display:{xs:'none',md:'inline-flex'}}} onClick={()=>go(admin?'/':'/admin/events')}>{admin?'Attendee':'Admin'} view</Button>}<Tooltip title="Appearance"><IconButton color="inherit" aria-label="Appearance" onClick={e=>setAppearanceAnchor(e.currentTarget)}><Glyph type={appearance==='dark'?'moon':appearance==='light'?'sun':'system'}/></IconButton></Tooltip><Menu anchorEl={appearanceAnchor} open={!!appearanceAnchor} onClose={()=>setAppearanceAnchor(null)}>{(['light','dark','system'] as const).map(mode=><MenuItem key={mode} selected={appearance===mode} onClick={()=>{setAppearance(mode);localStorage.setItem('servewith-appearance',mode);setAppearanceAnchor(null)}}><Box sx={{mr:1.5}}><Glyph type={mode==='light'?'sun':mode==='dark'?'moon':'system'}/></Box>{mode[0].toUpperCase()+mode.slice(1)}</MenuItem>)}</Menu><Button size="small" color="inherit" onClick={e=>setAnchor(e.currentTarget)} aria-label="Account menu" startIcon={<AccountAvatar email={me.authenticated?me.email:undefined} name={me.firstName||undefined}/>}>{me.authenticated?<Box sx={{display:{xs:'none',sm:'block'}}}>{me.firstName||'Account'}</Box>:<Box sx={{display:{xs:'none',sm:'block'}}}>Sign in</Box>}</Button><Menu anchorEl={anchor} open={!!anchor} onClose={()=>setAnchor(null)}>{me.authenticated&&<MenuItem onClick={()=>{setAnchor(null);go('/users/'+me.userId)}}><Box sx={{mr:1.5}}><Glyph type="person"/></Box>My Profile</MenuItem>}{me.authenticated&&<MenuItem onClick={()=>{setAnchor(null);go('/my-signups')}}>My signups</MenuItem>}{canAdmin&&<Box sx={{display:{xs:'block',md:'none'}}}><MenuItem onClick={()=>{setAnchor(null);go(admin?'/':'/admin/events')}}><Box sx={{mr:1.5}}><Glyph type="swap"/></Box>{admin?'Attendee workspace':'Administrator workspace'}</MenuItem></Box>}{me.authenticated?<MenuItem onClick={()=>{setAnchor(null);void api('logout',{}).then(refresh).then(()=>go('/'))}}><Box sx={{mr:1.5}}><Glyph type="logout"/></Box>Sign out</MenuItem>:<MenuItem onClick={()=>{setAnchor(null);go('/login')}}><Box sx={{mr:1.5}}><Glyph type="login"/></Box>Sign in</MenuItem>}</Menu></Stack>{admin&&canAdmin&&<Tabs value={path.startsWith('/admin/users')?'users':'events'} onChange={(_,v)=>go(v==='users'?'/admin/users':'/admin/events')} indicatorColor="primary"><Tab label="Events" value="events"/><Tab label="Users" value="users"/></Tabs>}</Container></AppBar>
 <Container maxWidth="lg" component="main">{path==='/terms'?<PolicyPage kind="terms"/>:path==='/privacy'?<PolicyPage kind="privacy"/>:path==='/login'?<AuthScreen me={me} refresh={refresh}/>:path==='/admin/events/new'&&canAdmin?<EventPageEditor/>:editRoute&&canAdmin?<EventPageEditor id={editRoute[1]}/>:adminEventRoute&&canAdmin?<AdminEventSignups id={adminEventRoute[1]}/>:userRoute?<UserView key={path} id={userRoute[1]} edit={!!userRoute[2]}/>:eventRoute?<EventDetail id={eventRoute[1]} admin={canAdmin} me={me}/>:path==='/admin/users'&&canAdmin?<UsersDirectory/>:path==='/my-signups'?<MySignups me={me}/>:path.startsWith('/admin')&&!canAdmin?<Alert severity="warning" sx={{mt:3}}>Complete your profile and current agreement to access administrator tools. <Button onClick={()=>go('/login')}>Account setup</Button></Alert>:<><Typography variant="h4" sx={{mt:4}}>{admin?'Manage events':'Serve With SF Fil-Am Lions'}</Typography><EventList admin={canAdmin&&admin}/></>}<BuildFooter/></Container></ThemeProvider>;
}

createRoot(document.getElementById('app')!).render(<RoutedApp/>);
