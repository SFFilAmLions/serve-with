// One meaningful relative unit. Time differences are UTC milliseconds,
// never calendar-date subtraction, so timezone/DST shifts do not skew labels.
export function eventRelativeLabel(startAt:number,endAt:number,now:number):string {
 if(now>=endAt)return 'Event ended';
 if(now>=startAt)return 'Event in progress';
 const ms=startAt-now;
 const units=[
  {name:'week',length:7*24*60*60*1000},
  {name:'day',length:24*60*60*1000},
  {name:'hour',length:60*60*1000},
  {name:'minute',length:60*1000}
 ];
 for(const unit of units){
  if(ms>=unit.length){
   const count=Math.floor(ms/unit.length);
   return 'In '+count+' '+unit.name+(count===1?'':'s');
  }
 }
 return 'Starting soon';
}
