// Bounds: seven pinned real Git inputs, fixed source/target bindings, exact
// bytes first, and strict LF-only UTF-8 to CRLF reconstruction otherwise.
// A valid new registry/source pair and cross-unit replay must still fail.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { assertApprovedRaw, assertBoundBytes } from './helpers/workDocsRaw.js';
import { APPROVED_RAW_IMPORTS, type RawBinding } from './helpers/workDocsRawImports.js';
import { digest } from './helpers/workDocsFixture.js';
const owned:string[]=[];
const git=(root:string,args:string[])=>execFileSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,'-c','user.name=Work documentation test','-c','user.email=work-docs-test@example.invalid','-C',root,...args],{stdio:['ignore','pipe','pipe']});
function readSource(source:string){const match=/^aoe2@([0-9a-f]{40}):(.+)$/.exec(source);if(!match)throw new Error('Invalid fixture source');return git(process.cwd(),['show',`${match[1]}:${match[2]}`]);}
const retained=(binding:RawBinding)=>Buffer.from(readSource(binding.source).toString('utf8').replaceAll('\n','\r\n'));
afterEach(()=>{for(const root of owned.splice(0)){if(!resolve(root).startsWith(resolve(tmpdir())+'\\aoe2-rawdocs-')&&!resolve(root).startsWith(resolve(tmpdir())+'/aoe2-rawdocs-'))throw new Error('Refusing cleanup outside owned raw fixture');rmSync(root,{recursive:true,force:true});}});
describe('fixed raw-import authorization boundary',()=>{
  test('has exactly the seven reviewed bindings with distinct targets and real source bytes',()=>{
    expect(APPROVED_RAW_IMPORTS).toHaveLength(7);expect(new Set(APPROVED_RAW_IMPORTS.map(b=>b.target)).size).toBe(7);
    for(const binding of APPROVED_RAW_IMPORTS){expect(digest(readSource(binding.source))).toBe(binding.sourceGitSha256);expect(digest(retained(binding))).toBe(binding.targetSha256);expect(()=>assertApprovedRaw(binding.target,{source:binding.source,sha256:binding.targetSha256},retained(binding),readSource)).not.toThrow();}
  });
  test('refuses a new registered raw file even when a real committed Git source and digest agree',()=>{
    const root=mkdtempSync(join(tmpdir(),'aoe2-rawdocs-'));owned.push(root);writeFileSync(join(root,'prompt.txt'),'An independently committed new capture.\n');git(root,['init','-q']);git(root,['add','--','prompt.txt']);git(root,['commit','-qm','New source does not confer import permission']);
    const revision=git(root,['rev-parse','HEAD']).toString().trim();const bytes=git(root,['show','HEAD:prompt.txt']);const source=`aoe2@${revision}:prompt.txt`;const target=['docs','work','0_example','historical','prompt.txt'].join('/');expect(()=>assertApprovedRaw(target,{source,sha256:digest(bytes)},bytes,()=>git(root,['show','HEAD:prompt.txt']))).toThrow();
  });
  test('refuses approved bytes copied to a second unit',()=>{
    const binding=APPROVED_RAW_IMPORTS[0];const target=binding.target.replace('/0_full/','/1_second/');expect(()=>assertApprovedRaw(target,{source:binding.source,sha256:binding.targetSha256},retained(binding),readSource)).toThrow();
  });
  test('refuses a changed source identity or declared target digest',()=>{
    const binding=APPROVED_RAW_IMPORTS[0];for(const entry of [{source:binding.source.replace('143ad511','243ad511'),sha256:binding.targetSha256},{source:binding.source,sha256:'0'.repeat(64)}])expect(()=>assertApprovedRaw(binding.target,entry,retained(binding),readSource)).toThrow();
  });
  test('refuses one changed target byte and a different committed source',()=>{
    const binding=APPROVED_RAW_IMPORTS[0],bytes=retained(binding);bytes[0]^=1;expect(()=>assertApprovedRaw(binding.target,{source:binding.source,sha256:binding.targetSha256},bytes,readSource)).toThrow();
    expect(()=>assertApprovedRaw(binding.target,{source:binding.source,sha256:binding.targetSha256},retained(binding),()=>readSource(APPROVED_RAW_IMPORTS[1].source))).toThrow();
  });
});
function bound(source:Buffer,target:Buffer):RawBinding{return{source:'fixture',target:'fixture',sourceGitSha256:digest(source),targetSha256:digest(target)};}
describe('strict source-byte reconstruction',()=>{
  test('accepts exact bytes first, without transforming already-CRLF data',()=>{const bytes=Buffer.from('Already\r\nCRLF\r\n');expect(()=>assertBoundBytes(bound(bytes,bytes),bytes,bytes)).not.toThrow();});
  test('expands only LF and preserves every other UTF-8 byte including a BOM',()=>{
    const source=Buffer.from('\uFEFFA café\n with spaces \n'),target=Buffer.from('\uFEFFA café\r\n with spaces \r\n');expect(()=>assertBoundBytes(bound(source,target),target,source)).not.toThrow();
  });
  test.each([Buffer.from([0xff,10]),Buffer.from('Mixed\r\nand LF\n'),Buffer.from('Only\r\nCRLF\r\n'),Buffer.from('Bare\rCR\n')])('refuses invalid UTF-8 or CR-bearing reconstruction input %j',source=>{
    const target=Buffer.from(source.toString('utf8').replaceAll('\n','\r\n'));expect(()=>assertBoundBytes(bound(source,target),target,source)).toThrow();
  });
  test.each(['A\r\n','\uFEFFA \r\n','A\t\r\n','unrelated'])('refuses trimming, BOM insertion, normalization or unrelated target %j',text=>{
    const source=Buffer.from('A \n'),target=Buffer.from(text);expect(()=>assertBoundBytes(bound(source,target),target,source)).toThrow();
  });
  test('refuses BOM removal and either changed fixed digest',()=>{
    const source=Buffer.from('\uFEFFText\n'),target=Buffer.from('Text\r\n');expect(()=>assertBoundBytes(bound(source,target),target,source)).toThrow();
    const good=Buffer.from('\uFEFFText\r\n'),binding=bound(source,good);expect(()=>assertBoundBytes({...binding,sourceGitSha256:'0'.repeat(64)},good,source)).toThrow();expect(()=>assertBoundBytes({...binding,targetSha256:'0'.repeat(64)},good,source)).toThrow();
  });
});
