'use strict';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCaAVtScG22Mox5VyCm89nV31kUW6-GmMQ',
  authDomain: 'my-habit-journal.firebaseapp.com',
  projectId: 'my-habit-journal',
  storageBucket: 'my-habit-journal.firebasestorage.app',
  messagingSenderId: '803512840598',
  appId: '1:803512840598:web:1544ca6535cb8b8bc5adb7'
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app), db=getFirestore(app);
const provider=new GoogleAuthProvider();provider.setCustomParameters({prompt:'select_account'});
const allowedEmails=new Set(['anaitochka.barsegian@gmail.com','annavoloh1017@gmail.com']);
const defaults=['Mindful Spending','Planned Workout','Steps','Healthy Eating','Sleep Routine','Learning','Reading','Reading with My Son','Mindful Scrolling','Water Intake'];
const icons=['💰','🏋','👟','🥗','☾','✎','📚','♡','▣','💧'];
const makeId=()=>globalThis.crypto?.randomUUID?.()||('h'+Date.now().toString(36)+Math.random().toString(36).slice(2));
const freshState=()=>({habits:defaults.map((name,i)=>({id:'default-'+i,name,icon:icons[i]})),marks:{}});
const validState=s=>s&&Array.isArray(s.habits)&&s.marks&&typeof s.marks==='object'&&!Array.isArray(s.marks);
let state=freshState(),activeUser=null,stopListening=null,cloudRef=null,writeQueue=Promise.resolve(),pendingWrites=0;
let session=0;
function showLogin(message=''){
  document.getElementById('authGate').classList.remove('hide');
  document.getElementById('authMessage').textContent=message;
  document.querySelector('main.app').classList.add('hide');
  document.querySelector('nav.tabs').classList.add('hide');
}
function showApp(){
  document.getElementById('authGate').classList.add('hide');
  document.querySelector('main.app').classList.remove('hide');
  document.querySelector('nav.tabs').classList.remove('hide');
  document.getElementById('accountEmail').textContent=activeUser.email||'';
}
function save(){
  if(!cloudRef||!activeUser)return;
  const ref=cloudRef,token=session,snapshot=structuredClone(state);
  pendingWrites++;
  document.getElementById('syncStatus').textContent='Saving…';
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{
    if(token!==session)return;
    await setDoc(ref,{habits:snapshot.habits,marks:snapshot.marks});
  }).then(()=>{if(token===session)document.getElementById('syncStatus').textContent='Saved to cloud';})
    .catch(err=>{if(token===session){document.getElementById('syncStatus').textContent='Save failed';toast('Could not sync: '+(err.code||err.message));}})
    .finally(()=>{if(token===session)pendingWrites=Math.max(0,pendingWrites-1)});
}
async function enterAccount(user){
  const token=++session;
  if(stopListening){stopListening();stopListening=null;}
  activeUser=null;cloudRef=null;state=freshState();showLogin('Loading your journal…');
  if(!user){showLogin();return;}
  if(!user.emailVerified||!allowedEmails.has((user.email||'').toLowerCase())){
    showLogin('This Google account is not invited to this journal.');
    await signOut(auth);return;
  }
  try{
    const ref=doc(db,'users',user.uid);
    const snap=await getDoc(ref);
    if(token!==session)return;
    state=snap.exists()&&validState(snap.data())?{habits:snap.data().habits,marks:snap.data().marks}:freshState();
    activeUser=user;cloudRef=ref;
    if(!snap.exists())await setDoc(ref,{habits:state.habits,marks:state.marks});
    if(token!==session)return;
    showApp();render();
    document.getElementById('syncStatus').textContent='Saved to cloud';
    stopListening=onSnapshot(ref,snapshot=>{
      if(token!==session||!snapshot.exists()||pendingWrites>0||snapshot.metadata.hasPendingWrites)return;
      const remote=snapshot.data();if(validState(remote)){state={habits:remote.habits,marks:remote.marks};render();}
    },err=>{if(token===session)toast('Sync error: '+(err.code||err.message))});
  }catch(err){if(token===session)showLogin('Could not load journal: '+(err.code||err.message));}
}
const loginBtn=document.getElementById('googleLogin');
loginBtn.onclick=async()=>{
  loginBtn.disabled=true;document.getElementById('authMessage').textContent='Opening Google…';
  try{await setPersistence(auth,browserLocalPersistence);await signInWithPopup(auth,provider);}
  catch(err){document.getElementById('authMessage').textContent=err.code==='auth/popup-blocked'?'Safari blocked the sign-in popup. Open this page directly in Safari and try again.':'Sign-in failed: '+(err.code||err.message);}
  finally{loginBtn.disabled=false;}
};
document.getElementById('logout').onclick=async()=>{if(pendingWrites>0){await writeQueue.catch(()=>{});}await signOut(auth)};
onAuthStateChanged(auth,enterAccount,err=>showLogin('Authentication error: '+err.message));

const now=new Date();let year=now.getFullYear(),month=now.getMonth();
function renderToday(){const today=new Date();$('todayDate').textContent='Today · '+today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});}
const $=id=>document.getElementById(id);
const key=()=>`${year}-${String(month+1).padStart(2,'0')}`;
const daysInMonth=()=>new Date(year,month+1,0).getDate();
const monthTitle=()=>new Date(year,month,1).toLocaleDateString('en-US',{month:'long',year:'numeric'});
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
function toast(s){const t=$('toast');t.textContent=s;t.style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.style.display='none',2600)}
function changeMonth(offset){const d=new Date(year,month+offset,1);year=d.getFullYear();month=d.getMonth();render()}
function render(){ renderToday();renderTodayView();$('monthLabel').textContent=monthTitle();$('statMonth').textContent=monthTitle();renderJournal();renderStats();renderSettings() }
const palette=['#b58b42','#cb777b','#6d9c81','#74a56e','#8b85c4','#6e94c8','#b08ac2','#d28c9f','#8296a4','#55a9bf'];
const glyphs=['💰','🏋️','👟','🥗','🌙','🎓','📚','📖','📱','💧'];
function habitColor(h){const n=Number((h.id||'').replace('default-',''));return (h.id||'').startsWith('default-')&&n>=0&&n<10?palette[n]:'#819d91'}
const svgPaths=[
'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 9h18M16 13h5"/><circle cx="16" cy="15" r="1"/>',
'<path d="M6 9v6M9 7v10M15 7v10M18 9v6M9 12h6M3 10v4M21 10v4"/>',
'<ellipse cx="8" cy="16" rx="3" ry="5" transform="rotate(20 8 16)"/><ellipse cx="16" cy="8" rx="3" ry="5" transform="rotate(20 16 8)"/><circle cx="5" cy="9" r="1"/><circle cx="18" cy="16" r="1"/>',
'<path d="M3 13h18c0 5-3 8-9 8s-9-3-9-8ZM12 13C6 8 8 5 12 3c4 2 6 5 0 10Z"/>',
'<path d="M20 15A8 8 0 0 1 9 4a8 8 0 1 0 11 11Z"/><path d="M17 3v4M15 5h4"/>',
'<path d="m2 9 10-5 10 5-10 5-10-5ZM6 11v6c4 3 8 3 12 0v-6M22 9v8"/>',
'<path d="M12 6c-3-2-6-2-10-1v14c4-1 7-1 10 1 3-2 6-2 10-1V5c-4-1-7-1-10 1ZM12 6v14"/>',
'<path d="M20.8 5.5a5.4 5.4 0 0 0-7.6 0L12 6.7l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.9a5.4 5.4 0 0 0 0-7.6Z"/>',
'<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4M9 6h6"/>',
'<path d="M12 2c-3 5-7 9-7 13a7 7 0 0 0 14 0c0-4-4-8-7-13Z"/><path d="M9 16a3 3 0 0 0 3 3"/>'
];
let detailHabit=null;
function iconFor(h){const span=el('span','habit-icon');const index=Number((h.id||'').replace('default-',''));const isDefault=(h.id||'').startsWith('default-')&&index>=0&&index<10;const color=habitColor(h);span.style.setProperty('--habit-color',color);span.style.setProperty('--habit-bg',`color-mix(in srgb,${color} 16%,white)`);if(isDefault){span.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${svgPaths[index]}</svg>`}else span.textContent=h.icon||'✧';return span}
function dateKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`}
// Stored statuses stay compatible with v2.2: 0=empty, 1=red, 2=yellow, 3=green.
// Tap sequence: empty -> green -> yellow -> red -> empty.
// Legacy boolean true is migrated in memory to green, preserving old check-ins.
const statusNames=['Not tracked','Not great','Could be better','Great'];
function markStatus(h,m,d){const v=state.marks[m]?.[h.id]?.[d];return v===true?3:(v===1||v===2||v===3?v:0)}
function isMarked(h,m,d){return markStatus(h,m,d)>0}
function toggleMark(h,m,d){state.marks[m]??={};state.marks[m][h.id]??={};const current=markStatus(h,m,d);const next=({0:3,3:2,2:1,1:0})[current];if(next)state.marks[m][h.id][d]=next;else delete state.marks[m][h.id][d];save();renderTodayView();renderJournal();renderStats()}
function renderTodayView(){const root=$('todayHabits');root.replaceChildren();const today=new Date(),m=dateKey(today),d=today.getDate();$('todayHeading').textContent=today.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});const rated=state.habits.filter(h=>isMarked(h,m,d)).length;const total=state.habits.length;$('todayCount').textContent=`${rated} of ${total} habits rated`;$('todayRing').textContent=`${rated}/${total}`;$('todayRing').style.setProperty('--progress',`${total?rated/total*100:0}%`);for(const h of state.habits){const card=el('div','today-card');card.style.setProperty('--habit-color',habitColor(h));card.append(iconFor(h));const link=el('button','habit-link',h.name);link.type='button';link.addEventListener('click',()=>openDetail(h.id));card.append(link);const status=markStatus(h,m,d),check=el('button','check-circle status-'+status,status?'✓':'');check.type='button';check.setAttribute('aria-label',`${h.name}: ${statusNames[status]}. Tap to change rating`);check.title=statusNames[status];check.addEventListener('click',()=>toggleMark(h,m,d));card.append(check);root.append(card)}if(!total)root.append(el('p','empty','Add your first habit in Settings.'))}
function openTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));for(const n of ['journal','calendar','statistics','settings'])$(n).classList.toggle('hide',n!==name);window.scrollTo(0,0)}
function openDetail(id){detailHabit=id;const d=new Date();year=d.getFullYear();month=d.getMonth();openTab('calendar');renderJournal()}
function renderJournal(){const root=$('habits');root.replaceChildren();$('calendarDetail').classList.toggle('hide',!detailHabit);$('calendarOverview').classList.toggle('hide',!!detailHabit);$('monthLabel').textContent=monthTitle();const max=daysInMonth(),m=key(),first=(new Date(year,month,1).getDay()+6)%7,today=new Date();const habits=detailHabit?state.habits.filter(h=>h.id===detailHabit):state.habits;if(detailHabit&&!habits.length){detailHabit=null;renderJournal();return}if(detailHabit){const h=habits[0],header=$('detailHeader');header.replaceChildren();const r=el('div','detail-title');r.append(iconFor(h));const wrap=el('div');wrap.append(el('h2','',h.name),el('p','small','Your habit history'));r.append(wrap);header.append(r)}for(const habit of habits){const color=habitColor(habit);if(!detailHabit){const row=el('button','overview-item');row.type='button';row.append(iconFor(habit),el('span','name',habit.name));const count=Object.keys(state.marks[m]?.[habit.id]||{}).filter(k=>Number(k)<=max&&isMarked(habit,m,k)).length;row.append(el('span','count',`${count}/${max}`),el('span','arrow','›'));row.addEventListener('click',()=>{detailHabit=habit.id;renderJournal()});root.append(row);continue}const card=el('article','habit calendar-card');card.style.setProperty('--habit-color',color);const grid=el('div','days calendar');for(const dayName of ['M','T','W','T','F','S','S'])grid.append(el('span','weekday',dayName));for(let i=0;i<first;i++)grid.append(el('span','calendar-empty'));for(let d=1;d<=max;d++){const done=isMarked(habit,m,d),isToday=year===today.getFullYear()&&month===today.getMonth()&&d===today.getDate();const b=el('button','day status-'+markStatus(habit,m,d)+(isToday?' today':''),String(d));b.type='button';b.setAttribute('aria-label',`${habit.name}, ${monthTitle()} ${d}: ${statusNames[markStatus(habit,m,d)]}. Tap to change rating`);b.setAttribute('aria-pressed',String(done));b.addEventListener('click',()=>toggleMark(habit,m,d));grid.append(b)}card.append(grid);const count=Object.keys(state.marks[m]?.[habit.id]||{}).filter(k=>Number(k)<=max&&isMarked(habit,m,k)).length;card.append(el('p','small',`${count} of ${max} days rated`));root.append(card)}if(!state.habits.length)root.append(el('p','empty','Add your first habit in Settings.'))}
function renderStats(){const root=$('stats');root.replaceChildren();const max=daysInMonth(),m=key();let total=0;for(const habit of state.habits){const count=Object.keys(state.marks[m]?.[habit.id]||{}).filter(k=>Number(k)<=max&&state.marks[m][habit.id][k]).length;total+=count;const block=el('div','stat'),top=el('div','stat-top');block.style.setProperty('--habit-color',habitColor(habit));top.append(el('span','',habit.name),el('b','',`${count} / ${max}`));const track=el('div','track'),fill=el('div','fill');fill.style.width=`${count/max*100}%`;track.append(fill);block.append(top,track);root.append(block)}const denom=max*state.habits.length;root.prepend(el('p','small',`Days rated: ${denom?Math.round(total/denom*100):0}%`))}
function renderSettings(){const root=$('habitSettings');root.replaceChildren();for(const habit of state.habits){const row=el('div','field');const icon=iconFor(habit);icon.style.alignSelf='center';const input=el('input');input.value=habit.name;input.setAttribute('aria-label',`Rename ${habit.name}`);input.maxLength=45;input.addEventListener('change',()=>{const value=input.value.trim();if(value){habit.name=value;save();render()}else input.value=habit.name});const del=el('button','','×');del.setAttribute('aria-label',`Delete ${habit.name}`);del.addEventListener('click',()=>{if(confirm(`Delete "${habit.name}"? Its marks will no longer be shown.`)){state.habits=state.habits.filter(h=>h.id!==habit.id);save();render()}});row.append(icon,input,del);root.append(row)}}
$('backCalendar').onclick=()=>{detailHabit=null;renderJournal()};$('prev').onclick=()=>changeMonth(-1);$('next').onclick=()=>changeMonth(1);$('statPrev').onclick=()=>changeMonth(-1);$('statNext').onclick=()=>changeMonth(1);
document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));openTab(b.dataset.tab)}));
$('addHabit').onclick=()=>{const input=$('newHabit'),name=input.value.trim();if(!name)return;if(state.habits.length>=30){toast('Maximum 30 habits');return}state.habits.push({id:makeId(),name,icon:'✧'});input.value='';save();render()};
$('export').onclick=()=>{const data=JSON.stringify({version:1,exportedAt:new Date().toISOString(),habits:state.habits,marks:state.marks},null,2);const blob=new Blob([data],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`habit-journal-backup-${new Date().toISOString().slice(0,10)}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)};
$('importBtn').onclick=()=>$('importFile').click();$('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw Error('File too large');const obj=JSON.parse(await file.text());if(!Array.isArray(obj.habits)||!obj.marks||typeof obj.marks!=='object'||obj.habits.length>30||!obj.habits.every(h=>typeof h.id==='string'&&typeof h.name==='string'&&h.name.length<=100))throw Error('Invalid backup');if(!confirm('Replace all current habits and marks with this backup?'))return;state={habits:obj.habits.map(h=>({id:h.id,name:h.name,icon:typeof h.icon==='string'?h.icon.slice(0,5):'○'})),marks:obj.marks};save();render();toast('Backup imported')}catch(err){toast(err.message||'Import failed')}finally{e.target.value=''}};
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&activeUser){renderToday();renderTodayView();renderJournal()}});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
