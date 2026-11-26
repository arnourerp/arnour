/* The stylesheets must be well formed: every { has its }, nothing stray, no rule nested inside a media query by mistake.
   (2026-11-26: a missing } after the admin phone block swallowed every rule after it, so the profile page and the
   Credly styles only applied on screens up to 860 px wide.) */
import fs from 'fs';
const ROOT=process.env.ARNOUR_ROOT||process.cwd();
let f=0; const t=(n,ok,x)=>{console.log(ok?'ok  ':'FAIL',n,ok?'':JSON.stringify(x||'').slice(0,300)); if(!ok)f++;};
const files=['css/styles.css',...fs.readdirSync(ROOT+'/css').filter(x=>x.endsWith('.css')&&x!=='styles.css').map(x=>'css/'+x)];
for(const file of files){
  const src=fs.readFileSync(ROOT+'/'+file,'utf8');
  const s=src.replace(/\/\*[\s\S]*?\*\//g,m=>m.replace(/[^\n]/g,' ')).replace(/"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g,m=>m.replace(/[{}]/g,' '));
  let depth=0,line=1,stray=[],nested=[],opens=[];
  for(let i=0;i<s.length;i++){
    const c=s[i];
    if(c==='\n') line++;
    else if(c==='{'){ depth++; opens.push(line); }
    else if(c==='}'){ if(depth===0) stray.push(line); else { depth--; opens.pop(); } }
    else if(c==='@'&&depth>=1&&/^@(media|supports)\b/.test(s.slice(i,i+10))) nested.push(line);
  }
  t(file+': no stray closing brace',stray.length===0,'at line '+stray.join(','));
  t(file+': every block is closed',depth===0,'unclosed block opened at line '+opens.join(','));
  t(file+': no @media inside another block',nested.length===0,'at line '+nested.join(','));
}
process.exit(f?1:0);
