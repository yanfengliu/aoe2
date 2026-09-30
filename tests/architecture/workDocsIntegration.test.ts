// Migration of the three existing hygiene checks: the original ten live roots,
// exact-case references and four independent floors; closure in the current
// structured plan; and Updated within 30 days of newer HEAD/devlog evidence.
// The permanent registry and seven raw-import bindings add byte/shape checks.
// Active legacy threads remain governed by threadHygiene.test.ts; their original
// maintenance and closure checks are retained through this bounded transition.
// Bounds: literal paths, listed roots, metadata, exact retained bytes and Git
// attributes. No assertion proves grouping, truthful status or review quality.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { auditLivePointers } from './helpers/workDocsPointers.js';
import { referenceClock, validateOpenWork } from './helpers/workDocsStatus.js';
import { validateGitAttributes, validateWorkDocs } from './helpers/workDocsStructure.js';
const root=realpathSync.native(fileURLToPath(new URL('../../',import.meta.url)));
function git(args:string[],input?:string) {
  return execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,...args],{encoding:'utf8',input,timeout:10000,stdio:['pipe','pipe','pipe'],maxBuffer:8*1024*1024});
}
function documents(){
  const files=new Map<string,Buffer>(),directories=new Set<string>();
  function visit(directory:string,prefix=''){
    for(const entry of readdirSync(directory,{withFileTypes:true})){
      const name=prefix+entry.name,full=join(directory,entry.name);
      if(entry.isDirectory()){directories.add(name);visit(full,name+'/');}
      else if(entry.isFile())files.set(name,readFileSync(full));
      else throw new Error(`docs/${name} is not an ordinary file or directory; inspect this unexpected input.`);
    }
  }
  visit(join(root,'docs'));return{files,directories};
}
function sourceBytes(source:string){
  const match=/^aoe2@([0-9a-f]{40}|[0-9a-f]{64}):(.+)$/.exec(source);
  if(!match||/[\\\0\r\n]/.test(match[2])||match[2].split('/').some(part=>!part||part==='.'||part==='..'||part.includes(':')))throw new Error(`Historical source ${source} needs aoe2@<full-commit>:<safe-path>.`);
  return execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-C',root,'show',`${match[1]}:${match[2]}`],{timeout:10000,stdio:['ignore','pipe','pipe']});
}
describe('thread hygiene under permanent work documents',()=>{
  test('every live pointer resolves with exact case and each original population is measured',()=>expect(auditLivePointers(root,{retainLegacyPointers:true}).errors).toEqual([]));
  test('retains contiguous plans/reviews and only exact approved historical artifacts',()=>{
    const {files,directories}=documents();expect(validateWorkDocs(files,directories,sourceBytes,{retainLegacyRoots:true})).toEqual([]);
  });
  test('open plans retain their current state and a valid Updated within the 30-day tail',()=>{
    let head:string|undefined;try{head=git(['log','-1','--format=%cs']).trim();}catch{/* The dated devlog remains the original fallback. */}
    const clock=referenceClock(head,readFileSync(join(root,'docs/devlog/summary.md'),'utf8'));
    expect(validateOpenWork(documents().files,clock)).toEqual([]);
  });
  test('Git preserves every work file as the exact bytes its review/import digest names',()=>{
    const paths=[...documents().files.keys()].filter(path=>path.startsWith('work/')).map(path=>`docs/${path}`);
    const measured=git(['check-attr','-z','--stdin','text','filter','working-tree-encoding','ident'],paths.join('\0')+'\0');
    expect(validateGitAttributes(measured,paths)).toEqual([]);
  });
});
