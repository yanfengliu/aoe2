// Bound: open structured plans only, their real Updated date, a 30-day tail,
// and the newer of committed HEAD and dated devlog text. This cannot prove a
// status sentence truthful. Historical quotations do not maintain an open plan.
const DAY=24*60*60*1000;
const OPEN=new Set(['planned','active','blocked']);
const KNOWN_CURRENT=new Set(['97_lumber-camp-routing','98_concurrency-review-2026-09-02']);
function isoDate(value:string):number|undefined {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return undefined;
  const date=new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===value?date.valueOf():undefined;
}
export function referenceClock(head:string|undefined,devlog:string):number {
  const dates=[head??'',...devlog.matchAll(/\b(20\d\d-\d{2}-\d{2})(?!\d)/g)].map(value=>typeof value==='string'?value:value[1]).map(isoDate).filter((value):value is number=>value!==undefined);
  if(!dates.length)throw new Error('Neither HEAD nor the devlog yields a valid date; restore a dated input before checking the 30-day bound.');
  return Math.max(...dates);
}
export function validateOpenWork(files:ReadonlyMap<string,Buffer>,clock:number):string[] {
  const errors:string[]=[];
  const plans=[...files].filter(([path])=>/^work\/\d+_[^/]+\/plan\.md$/.test(path));
  if(!plans.length)errors.push('No structured plans were read; the open-work check did not run.');
  for(const [path,bytes] of plans) {
    const text=bytes.toString('utf8'),status=/^Status: (.*)$/m.exec(text)?.[1].trim();
    if(status==='legacy'&&KNOWN_CURRENT.has(path.split('/')[1]))errors.push(`${path} was open at migration; carry its real state and follow-ups instead of marking it unknown history.`);
    if(!OPEN.has(status??''))continue;
    if(/^Closed \d{4}-\d{2}-\d{2}/m.test(text))errors.push(`${path} is open but carries a closure marker; record the actual state in Status and Outcome.`);
    const updated=/^Updated: (.*)$/m.exec(text)?.[1].trim()??'',date=isoDate(updated);
    if(date===undefined){errors.push(`${path} has invalid Updated ${JSON.stringify(updated)}; open work needs a real ISO maintenance date.`);continue;}
    const age=Math.floor((clock-date)/DAY);
    if(age>30)errors.push(`${path} was last maintained ${updated}, ${age} days before the reference clock; report its current state or close it with an outcome.`);
  }
  return errors;
}
