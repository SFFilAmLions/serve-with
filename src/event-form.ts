export type Draft = {title:string;location:string;timezone:string;start:string;end:string};
export const timeZones = (() => {
 const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['America/Los_Angeles','America/New_York','America/Chicago','America/Denver','UTC'];
 return Array.from(new Set(['America/Los_Angeles','UTC',...zones])).sort();
})();
export const validateDraft = (draft:Draft):Record<string,string> => {
 const errors:Record<string,string>={};
 if(!draft.title.trim()||draft.title.trim().length>200)errors.title='Enter a title (1–200 characters)';
 if(!draft.location.trim()||draft.location.trim().length>500)errors.location='Enter a location (1–500 characters)';
 if(!timeZones.includes(draft.timezone))errors.timezone='Choose a valid time zone';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.start))errors.start='Enter a start date and time';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(draft.end))errors.end='Enter an end date and time';
 if(!errors.start&&!errors.end&&draft.end<=draft.start)errors.end='End must be after start';
 return errors;
};
export const emptyDraft = ():Draft => ({title:'',location:'',timezone:'America/Los_Angeles',start:'',end:''});
export const localInput = (timestamp:number,zone:string) => {
 const parts = new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(timestamp));
 const part=(key:string)=>parts.find(p=>p.type===key)?.value || '';
 return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
};
