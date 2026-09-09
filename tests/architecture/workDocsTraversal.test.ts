// Bounds: actual temporary trees across all ten existing scan roots, four
// independent populations, exact-case paths, and a 30-day maintenance clock.
// Fixture strings are assembled so they cannot inflate the live gate's count.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { auditLivePointers } from './helpers/workDocsPointers.js';
import { referenceClock, validateOpenWork } from './helpers/workDocsStatus.js';
import { examplePlan } from './helpers/workDocsFixture.js';
const owned: string[]=[];
const roots=['src','tests','scripts','design','docs/architecture','docs/policies','docs/learning','docs/engine-feedback','AGENTS.md','README.md'];
const target=['docs','work','0_example','plan.md'].join('/');
function write(root:string,path:string,text:string){mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),text);}
function tree(){
  const root=mkdtempSync(join(tmpdir(),'aoe2-workdocs-'));owned.push(root);
  write(root,target,examplePlan);
  for(const name of roots){if(name.endsWith('.md'))write(root,name,'Working rules.');else mkdirSync(join(root,name),{recursive:true});}
  for(const name of ['src','tests','design','docs/architecture'])write(root,`${name}/pointers.${name==='src'||name==='tests'?'ts':'md'}`,`${target}\n${target}.\n${target.replace('/plan.md','/.../plan.md')}\n`);
  return root;
}
afterEach(()=>{for(const root of owned.splice(0)){if(!resolve(root).startsWith(resolve(tmpdir())+'\\aoe2-workdocs-')&&!resolve(root).startsWith(resolve(tmpdir())+'/aoe2-workdocs-'))throw new Error('Refusing cleanup outside owned temporary fixture');rmSync(root,{recursive:true,force:true});}});
describe('real traversal mutation controls',()=>{
  test('reads all roots and accepts exact pointers, sentence punctuation and elision',()=>expect(auditLivePointers(tree()).errors).toEqual([]));
  test.each(['missing.md','Plan.md'])('rejects absent or wrong-case destination %s',name=>{
    const root=tree();write(root,'scripts/bad.mjs',target.replace('plan.md',name));expect(auditLivePointers(root).errors).not.toEqual([]);
  });
  test('rejects a legacy pointer even when its destination remains on disk',()=>{
    const root=tree(),old=['docs','threads','done','old','PLAN.md'].join('/');write(root,old,'Legacy.');write(root,'scripts/old.mjs',old);expect(auditLivePointers(root).errors).not.toEqual([]);
  });
  test('dropping TypeScript support cannot silently empty two populations',()=>{
    const root=tree();expect(auditLivePointers(root,{extensions:['.md','.mjs','.json']}).errors.join('\n')).toMatch(/src|tests/);
  });
  test.each(['src','tests','design','docs/architecture'])('each %s population independently needs three concrete pointers',name=>{
    const root=tree();write(root,`${name}/pointers.${name==='src'||name==='tests'?'ts':'md'}`,`${target}\n${target}\n`);expect(auditLivePointers(root).errors.join('\n')).toContain(name);
  });
  test('a missing scan root and an omitted root are both detectable',()=>{
    const root=tree();rmSync(join(root,'docs/engine-feedback'),{recursive:true});expect(auditLivePointers(root).errors).not.toEqual([]);
    expect(auditLivePointers(tree(),{roots:roots.filter(name=>name!=='scripts')}).errors).not.toEqual([]);
  });
  test('provenance and work-directory literals cannot satisfy a live floor',()=>{
    const root=tree();write(root,'src/pointers.ts',Array(5).fill(['docs','work'].join('/')+'/').join('\n'));write(root,['docs','work','0_example','historical','many.md'].join('/'),Array(20).fill(target).join('\n'));expect(auditLivePointers(root).errors.join('\n')).toContain('src');
  });
  test('a real Git commit and checkout preserve exact work bytes',()=>{
    const root=tree();const bytes=Buffer.from('Authored\r\nreview\r\n');const path=['docs','work','0_example','snapshots','target.md'].join('/');write(root,path,bytes.toString());write(root,['docs','work','.gitattributes'].join('/'),'* -text\n');
    const git=(args:string[])=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-c','user.name=Work documentation test','-c','user.email=work-docs-test@example.invalid','-C',root,...args],{stdio:['ignore','pipe','pipe']});
    git(['init','-q']);git(['add','--',path,['docs','work','.gitattributes'].join('/')]);git(['commit','-qm','Pin authored bytes']);expect(git(['show',`HEAD:${path}`]).equals(bytes)).toBe(true);
    writeFileSync(join(root,path),'Changed');git(['restore','--',path]);expect(readFileSync(join(root,path)).equals(bytes)).toBe(true);
  });
});
const day=(date:string)=>Date.parse(date+'T00:00:00Z');
const plans=(text=examplePlan,path='work/0_example/plan.md')=>new Map([[path,Buffer.from(text)]]);
describe('open-plan lifecycle controls',()=>{
  test('uses the newer of HEAD and devlog, without falling back to wall time',()=>{
    expect(referenceClock('2026-09-08','2026-09-05')).toBe(day('2026-09-08'));
    expect(referenceClock('2026-09-01','2026-09-08')).toBe(day('2026-09-08'));
    expect(referenceClock(undefined,'2026-09-08')).toBe(day('2026-09-08'));
    expect(()=>referenceClock(undefined,'no date')).toThrow();
  });
  test.each(['planned','active','blocked'])('30 days passes and 31 fails for %s',status=>{
    const files=plans(examplePlan.replace('Status: active',`Status: ${status}`));expect(validateOpenWork(files,day('2026-10-05'))).toEqual([]);expect(validateOpenWork(files,day('2026-10-06'))).not.toEqual([]);
  });
  test.each(['','invalid','2026-02-30','Unknown (historical record; not recorded)'])('an open Updated field must be a real date: %s',value=>{
    expect(validateOpenWork(plans(examplePlan.replace('Updated: 2026-09-05',`Updated: ${value}`)),day('2026-09-08'))).not.toEqual([]);
  });
  test('a fresh closure marker fails immediately and cannot refresh open work',()=>{
    expect(validateOpenWork(plans(examplePlan+'\nClosed 2026-09-08: shipped\n'),day('2026-09-08'))).not.toEqual([]);
  });
  test('a new Created date or a future historical quotation cannot rescue stale Updated',()=>{
    const files=plans(examplePlan.replace('Created: 2026-09-01','Created: 2026-10-06'));files.set('work/0_example/reviews/0_legacy.md',Buffer.from('Forecast 2099-01-01.'));expect(validateOpenWork(files,day('2026-10-06'))).not.toEqual([]);
  });
  test('a reopened plan does not inherit closure markers from its retained history',()=>{
    const files=plans();files.set('work/0_example/historical/PLAN.md',Buffer.from('Closed 2026-09-08: earlier attempt.'));expect(validateOpenWork(files,day('2026-09-08'))).toEqual([]);
  });
  test.each(['legacy','complete','cancelled'])('historical or closed status %s is outside the open queue',status=>{
    expect(validateOpenWork(plans(examplePlan.replace('Status: active',`Status: ${status}`)),day('2027-01-01'))).toEqual([]);
  });
  test.each(['97_lumber-camp-routing','98_concurrency-review-2026-09-02'])('known-open import %s cannot become unknown historical work',unit=>{
    expect(validateOpenWork(plans(examplePlan.replace('Status: active','Status: legacy'),`work/${unit}/plan.md`),day('2026-09-08'))).not.toEqual([]);
    expect(validateOpenWork(plans(examplePlan,`work/${unit}/plan.md`),day('2026-09-08'))).toEqual([]);
    expect(validateOpenWork(plans(examplePlan.replace('Status: active','Status: complete'),`work/${unit}/plan.md`),day('2026-09-08'))).toEqual([]);
  });
});
