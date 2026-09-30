// Bound: the original ten live roots, original text extensions and exclusions,
// exact-case literal paths, and four independent minimum populations. History
// and provenance under work folders never contribute to these populations.
import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
const ROOTS = ['src','tests','scripts','design','docs/architecture','docs/policies','docs/learning','docs/engine-feedback','AGENTS.md','README.md'];
const EXTENSIONS = ['.ts','.tsx','.mjs','.cjs','.js','.md','.json','.yml','.yaml','.css','.html','.txt'];
const SKIP = new Set(['node_modules','.git','dist','generated','coverage','tmp']);
const FLOORS: Readonly<Record<string, number>> = { src:3, tests:3, design:3, 'docs/architecture':3 };
const POINTER = /docs\/(?:threads\/(?:current|done)|work)\/[A-Za-z0-9_./-]*/g;
function normalized(raw: string) {
  const elision=raw.indexOf('/...');
  return (elision >= 0 ? raw.slice(0,elision) : raw).replace(/[./]+$/, '');
}
export function auditLivePointers(root: string, options: { roots?: string[]; extensions?: string[]; retainLegacyPointers?: boolean } = {}): { errors: string[]; counts: Record<string, number> } {
  const errors: string[]=[];
  const counts: Record<string, number>={};
  const roots=options.roots ?? ROOTS, extensions=new Set(options.extensions ?? EXTENSIONS);
  if (roots.length !== ROOTS.length || ROOTS.some(name=>!roots.includes(name))) errors.push('Live pointer scan must retain all ten named roots; restore the omitted or duplicate root.');
  const posix=(file:string)=>relative(root,file).replaceAll('\\','/');
  function walk(directory:string, out:string[]) {
    for(const entry of readdirSync(directory,{withFileTypes:true})) {
      const full=join(directory,entry.name);
      if(entry.isDirectory()) { if(!SKIP.has(entry.name))walk(full,out); }
      else if(entry.isFile()) { const dot=entry.name.lastIndexOf('.');if(dot>=0&&extensions.has(entry.name.slice(dot)))out.push(full); }
    }
  }
  for(const name of roots) {
    const abs=join(root,name);counts[name]=0;
    if(!existsSync(abs)){errors.push(`Pointer root ${name} is missing; restore it so the scan covers its declared population.`);continue;}
    const files:string[]=[];
    if(statSync(abs).isFile())files.push(abs);else walk(abs,files);
    for(const file of files) {
      readFileSync(file,'utf8').split(/\r?\n/).forEach((line,index)=>{
        for(const match of line.matchAll(POINTER)) {
          const path=normalized(match[0]);
          if(!options.retainLegacyPointers && path.startsWith(['docs','threads'].join('/')+'/')) { errors.push(`${posix(file)}:${index+1} retains legacy pointer ${match[0]}; name the mapped permanent work path.`);continue; }
          if(!['docs/work','docs/threads/current','docs/threads/done'].includes(path))counts[name]++;
          const destination=join(root,path);
          if(!existsSync(destination)||posix(realpathSync.native(destination))!==path)errors.push(`${posix(file)}:${index+1} names ${match[0]}, but ${path} does not exist with exact case; restore the target or correct this pointer.`);
        }
      });
    }
  }
  for(const [name,floor] of Object.entries(FLOORS))if((counts[name]??0)<floor)errors.push(`${name}: ${counts[name]??0} concrete pointers found; at least ${floor} must be scanned independently.`);
  return {errors,counts};
}
