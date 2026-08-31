const agendaTemplate = [
  { name: 'Welcome & settle in', duration: 5, type: 'done' },
  { name: 'Quick write', duration: 8, type: 'done' },
  { name: 'Primary source analysis', duration: 20, type: 'current' },
  { name: 'Partner discussion', duration: 12, type: '' },
  { name: 'Notebook reflection', duration: 8, type: '', fixed: true },
  { name: 'Clean up & closing', duration: 2, type: '', protected: true }
];
const saved = JSON.parse(localStorage.getItem('lessondeck-live-state') || '{}');
let state = { current: saved.current ?? 2, adjustments: saved.adjustments || {}, paused: saved.paused || false, timerRemaining: saved.timerRemaining ?? 300, timerRunning: false, timerStamp: Date.now(), slide: saved.slide || 8, undo: null };
let toastTimer;
const $ = (id) => document.getElementById(id);
function persist(){ localStorage.setItem('lessondeck-live-state', JSON.stringify({...state, timerRunning:false})); }
function fmt(seconds){ seconds=Math.max(0,Math.round(seconds)); return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; }
function remainingFor(i){ return agendaTemplate[i].duration*60 + (state.adjustments[i]||0)*60; }
function renderAgenda(){
  $('agendaList').innerHTML=agendaTemplate.map((item,i)=>{
    const type=i<state.current?'done':i===state.current?'current':'';
    const icon=type==='done'?'✓':type==='current'?'▶':'○';
    const tag=item.protected?'<span class="protected">PROTECTED</span>':item.fixed?'<span class="protected">FIXED</span>':'';
    return `<div class="agenda-item ${type}"><span class="state">${icon}</span><div><h3>${item.name}${tag}</h3><p>${item.duration+(state.adjustments[i]||0)} min${type==='current'?' • In progress':''}</p>${type==='current'?'<div class="item-progress"><i></i></div>':''}</div>${type==='current'?`<time id="agendaTime">${fmt(remainingFor(i))}</time>`:`<time>${item.duration} min</time>`}</div>`;
  }).join('');
  $('agendaCount').textContent=`${Math.min(state.current+1,6)} of 6`;
  persist();
}
function showToast(message, undo=true){$('toastText').textContent=message;$('toastUndo').style.display=undo?'inline':'none';$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4200);}
function adjust(minutes){const i=state.current;state.undo={kind:'adjust',i,previous:state.adjustments[i]||0};state.adjustments[i]=(state.adjustments[i]||0)+minutes;renderAgenda();showToast(`${minutes>0?'Added':'Removed'} ${Math.abs(minutes)} minute${Math.abs(minutes)>1?'s':''} ${minutes>0?'to':'from'} ${agendaTemplate[i].name}`);}
function moveAgenda(direction){const previous=state.current;state.undo={kind:'move',previous};state.current=Math.max(0,Math.min(agendaTemplate.length-1,state.current+direction));renderAgenda();showToast(`${direction>0?'Advanced to':'Returned to'} ${agendaTemplate[state.current].name}`);}
function undo(){if(!state.undo)return showToast('Nothing to undo',false);if(state.undo.kind==='adjust')state.adjustments[state.undo.i]=state.undo.previous;else state.current=state.undo.previous;state.undo=null;renderAgenda();showToast('Last timer change undone',false);}
function sync(){state.undo={kind:'move',previous:state.current};state.current=2;state.adjustments={};state.paused=false;renderAgenda();showToast('Agenda synced to class clock');}
function toggleFocus(id){const card=$(id);const on=card.classList.toggle('focused');$('dashboard').classList.toggle('focusing',on);document.querySelectorAll('.card.focused').forEach(el=>{if(el!==card)el.classList.remove('focused')});}
document.querySelectorAll('[data-adjust]').forEach(b=>b.onclick=()=>adjust(Number(b.dataset.adjust)));
document.querySelectorAll('.focus-btn').forEach(b=>b.onclick=()=>toggleFocus(b.dataset.focus));
$('nextAgenda').onclick=()=>moveAgenda(1);$('prevAgenda').onclick=()=>moveAgenda(-1);$('undoBtn').onclick=undo;$('toastUndo').onclick=undo;$('syncBtn').onclick=sync;
$('pauseAgenda').onclick=()=>{state.paused=!state.paused;$('pauseAgenda').textContent=state.paused?'▶':'Ⅱ';$('agendaList').classList.toggle('paused',state.paused);showToast(state.paused?'Agenda paused':'Agenda resumed',false);persist()};
$('focusCurrent').onclick=()=>toggleFocus('slidesCard');
$('scheduleBtn').onclick=()=>$('scheduleMenu').classList.toggle('open');
document.querySelectorAll('[data-schedule]').forEach(b=>b.onclick=()=>{$('scheduleBtn').firstChild.textContent=b.dataset.schedule+' ';$('scheduleMenu').classList.remove('open');showToast(`Today changed to ${b.dataset.schedule}`,false)});
$('remoteBtn').onclick=()=>{$('remoteBtn').classList.toggle('active');showToast('Remote mode ready — arrow keys control the lesson',false)};
$('editBtn').onclick=()=>showToast('Lesson builder would open here — live state is saved',false);$('settingsBtn').onclick=()=>showToast('Keyboard: → advance • ← previous • Space pause • U undo',false);
function changeSlide(delta){state.slide=Math.max(1,Math.min(24,state.slide+delta));$('slideNum').textContent=state.slide;persist()}
$('nextSlide').onclick=()=>changeSlide(1);$('prevSlide').onclick=()=>changeSlide(-1);
$('timerPlay').onclick=()=>{state.timerRunning=!state.timerRunning;state.timerStamp=Date.now();$('timerPlay').innerHTML=state.timerRunning?'Ⅱ <span>PAUSE</span>':'▶ <span>START</span>'};
$('timerReset').onclick=()=>{state.timerRemaining=300;state.timerRunning=false;$('timerPlay').innerHTML='▶ <span>START</span>';updateTimer()};
$('timerAdd').onclick=()=>{state.timerRemaining+=60;updateTimer()};
function updateTimer(){if(state.timerRunning){const now=Date.now();state.timerRemaining-=Math.floor((now-state.timerStamp)/1000);state.timerStamp=now;if(state.timerRemaining<=0){state.timerRemaining=0;state.timerRunning=false;showToast('Quick timer finished',false)}}$('timerDisplay').textContent=fmt(state.timerRemaining);$('timerProgress').style.width=`${Math.min(100,state.timerRemaining/300*100)}%`;}
function tick(){const now=new Date();$('clock').textContent=now.toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'});updateTimer();const el=$('agendaTime');if(el&&!state.paused){const base=remainingFor(state.current);const elapsed=Math.floor((Date.now()/1000)%base);el.textContent=fmt(base-elapsed)} }
document.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;if(e.key==='ArrowRight')moveAgenda(1);if(e.key==='ArrowLeft')moveAgenda(-1);if(e.key==='u')undo();if(e.key===' '){e.preventDefault();$('pauseAgenda').click()}if(e.key==='Escape'&&document.querySelector('.focused'))toggleFocus(document.querySelector('.focused').id)});
window.addEventListener('beforeunload',persist);window.addEventListener('online',()=>showToast('Connection restored',false));window.addEventListener('offline',()=>showToast('Offline — lesson timing is still running',false));
renderAgenda();$('slideNum').textContent=state.slide;setInterval(tick,1000);tick();
