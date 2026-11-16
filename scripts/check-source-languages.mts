import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(file=>file&&existsSync(file)&&/\.(?:js|jsx|mjs|cjs)$/.test(file));
if(files.length)throw Error('Authored JavaScript sources must be converted to TypeScript: '+files.join(', '));
console.log('No authored JavaScript sources remain. Browser JavaScript is generated from TypeScript.');
const misplaced=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(file=>file&&existsSync(file)&&/\.(?:sql|py|sh|bash|go|rs)$/.test(file));
if(misplaced.length)throw Error('Backend source does not belong in the web repository: '+misplaced.join(', '));
