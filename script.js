// Client script for Shukla GPT Dashboard
// - supports click + touch on mic button
// - calls serverless function at /.netlify/functions/chat
// - speech recognition + synthesis
// - UI state saved to localStorage

// ---------- state ----------
const SKEY = 'shukla_gpt_state_v3';
let state = {
  name: localStorage.getItem('name') || '',
  cls: localStorage.getItem('cls') || 'Class 12 (PCM + English)',
  total: +(localStorage.getItem('total')||0),
  done: +(localStorage.getItem('done')||0),
  focus: +(localStorage.getItem('focus')||0),
  disc: +(localStorage.getItem('disc')||0),
  level: +(localStorage.getItem('level')||0),
  weeklyXP: JSON.parse(localStorage.getItem('weeklyXP') || '[0,0,0,0,0,0,0]')
};

// ---------- DOM refs ----------
const nameInput = document.getElementById('nameInput');
const classInput = document.getElementById('classInput');
const totalChInput = document.getElementById('totalChInput');
const doneChInput = document.getElementById('doneChInput');
const levelVal = document.getElementById('levelVal');
const focusVal = document.getElementById('focusVal');
const discVal = document.getElementById('discVal');
const leftVal = document.getElementById('leftVal');
const levelBar = document.getElementById('levelBar');
const focusBar = document.getElementById('focusBar');
const discBar = document.getElementById('discBar');
const leftBar = document.getElementById('leftBar');
const badgesEl = document.getElementById('badges');
const chatLog = document.getElementById('chatLog');
const promptInput = document.getElementById('promptInput');
const modeSelect = document.getElementById('mode');
const orbState = document.getElementById('orbState');
const orbCore = document.getElementById('orbCore');
const orbGlow = document.getElementById('orbGlow');

function saveLocal(){
  localStorage.setItem('name', state.name);
  localStorage.setItem('cls', state.cls);
  localStorage.setItem('total', state.total);
  localStorage.setItem('done', state.done);
  localStorage.setItem('focus', state.focus);
  localStorage.setItem('disc', state.disc);
  localStorage.setItem('level', state.level);
  localStorage.setItem('weeklyXP', JSON.stringify(state.weeklyXP));
}

// --------- render UI ----------
function calcLevel(){
  const score = state.done + state.focus/10 + state.disc/10;
  state.level = Math.floor(score/3);
}
function renderUI(){
  nameInput.value = state.name; classInput.value = state.cls;
  totalChInput.value = state.total; doneChInput.value = state.done;
  focusVal.textContent = state.focus; discVal.textContent = state.disc;
  leftVal.textContent = Math.max(0, state.total - state.done);
  calcLevel(); levelVal.textContent = state.level;
  levelBar.style.width = Math.min(100, (state.level%10)*10)+'%';
  focusBar.style.width = Math.min(100, state.focus)+'%';
  discBar.style.width = Math.min(100, state.disc)+'%';
  leftBar.style.width = state.total? Math.min(100, ((state.total - state.done)/state.total)*100) + '%' : '0%';
  renderBadges();
}
function renderBadges(){
  const earned = [];
  if(state.done >= 1) earned.push({name:'First Chapter', color:'#35ff9b'});
  if(state.done >= 5) earned.push({name:'5 Chapters', color:'#67ffd7'});
  if(state.done >= 10) earned.push({name:'10 Chapters', color:'#ffd54d'});
  if(state.focus >= 50) earned.push({name:'Laser Focus', color:'#7df2ff'});
  if(state.disc >= 50) earned.push({name:'Steel Discipline', color:'#ffb84d'});
  badgesEl.innerHTML = earned.map(b=>`<span class="badge" style="border-color:${b.color};color:${b.color};">${b.name}</span>`).join('') || '<div class="muted">No badges yet — start studying!</div>';
}
renderUI();

// ---------- simple helpers ----------
function notify(msg){
  const el = document.createElement('div'); el.textContent = `${new Date().toLocaleTimeString()} — ${msg}`;
  el.style.padding = '6px 8px'; el.style.fontSize='13px';
  chatLog.prepend(el);
}
function appendChat(role, text){
  const p = document.createElement('div');
  p.innerHTML = `<b>${role}:</b> ${text}`;
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// ---------- XP add ----------
function addXP(n){
  const d = new Date(); const wd = (d.getDay() + 6) % 7;
  state.weeklyXP[wd] = (state.weeklyXP[wd]||0) + Math.max(0, n);
  state.xp = (state.xp||0) + n;
  saveLocal(); renderUI();
}

// ---------- Chart ----------
let xpChart = null;
function drawChart(){
  const ctx = document.getElementById('xpChart').getContext('2d');
  if(xpChart) xpChart.destroy();
  xpChart = new Chart(ctx, {
    type:'line',
    data:{ labels:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'], datasets:[{label:'XP', data: state.weeklyXP, borderColor:'#00ffd7', tension:0.3, fill:false}]},
    options:{plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
  });
}
drawChart();

// ---------- Voice: recognition + speak ----------
const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let recog = null;
function setOrb(mode){
  if(mode==='idle'){ orbState.textContent='Idle'; orbCore.style.transform='scale(1)'; orbGlow.style.opacity=0.6; }
  if(mode==='listen'){ orbState.textContent='Listening…'; orbCore.style.transform='scale(.7)'; orbGlow.style.opacity=1.0; }
  if(mode==='talk'){ orbState.textContent='Speaking…'; }
}
setOrb('idle');

async function speakText(text){
  try{
    setOrb('talk');
    const u = new SpeechSynthesisUtterance(text);
    // hint language: if contains Devanagari -> hi-IN
    u.lang = /[\u0900-\u097F]/.test(text) ? 'hi-IN' : 'en-IN';
    // adapt voice parameters by mode
    const mode = modeSelect.value;
    if(mode === 'friend'){ u.rate = 1.03; u.pitch = 1.05; }
    if(mode === 'teacher'){ u.rate = 0.95; u.pitch = 0.95; }
    if(mode === 'gym'){ u.rate = 1.1; u.pitch = 1.15; }
    if(mode === 'mentor'){ u.rate = 0.92; u.pitch = 0.9; }
    u.onend = ()=> setOrb('idle');
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }catch(e){ console.error(e); setOrb('idle'); }
}

// ---------- Serverless chat call ----------
async function askServer(prompt, mode){
  appendChat('You', prompt);
  notify('Asking server...');
  try{
    setOrb('listen');
    const resp = await fetch('/.netlify/functions/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: prompt, mode })
    });
    const j = await resp.json();
    const reply = j.reply || j.error || 'No reply from server.';
    appendChat('Shukla ('+mode+')', reply);
    await speakText(reply);
    addXP(10);
    drawChart();
    return reply;
  }catch(err){
    appendChat('System', 'Server request failed: ' + err.message);
    setOrb('idle');
    console.error(err);
    return null;
  }
}

// ---------- Touch + Click support for mic & Arise ----------
const micBtn = document.getElementById('micBtn');
const ariseBtn = document.getElementById('ariseBtn');

function initRecognition(){
  if(!SpeechRec) { alert('SpeechRecognition not supported. Use Chrome.'); return; }
  recog = new SpeechRec();
  recog.lang = 'en-IN';
  recog.interimResults = false;
  recog.continuous = false;
  recog.onstart = ()=> setOrb('listen');
  recog.onend = ()=> setOrb('idle');
  recog.onerror = (e)=> { console.warn('rec error', e); setOrb('idle'); };
  recog.onresult = async (e)=> {
    const text = e.results[0][0].transcript.trim();
    appendChat('You', text);
    // handle local commands quickly
    if(/\barise\b/i.test(text)) { appendChat('System','Woke by voice'); speakText('Shukla online.'); return; }
    if(/done|complete|khatam|ho gaya/i.test(text)){ state.done++; saveLocal(); renderUI(); appendChat('System','Marked chapter done'); speakText('Good job!'); return; }
    // otherwise call server
    await askServer(text, modeSelect.value);
  };
}

function startListeningFromUser(ev){
  ev && ev.preventDefault();
  // ensure mic permission
  navigator.mediaDevices.getUserMedia({ audio: true }).then(()=> {
    if(!recog) initRecognition();
    try{ recog.start(); }catch(e){ console.warn(e); }
  }).catch(err=>{
    alert('Microphone access blocked. Allow mic permission and try again.');
    console.error(err);
  });
}

micBtn.addEventListener('click', startListeningFromUser);
micBtn.addEventListener('touchstart', startListeningFromUser, {passive:false});
ariseBtn.addEventListener('click', ()=> { speakText('Arise Shukla. System is active.'); setOrb('listen'); });
ariseBtn.addEventListener('touchstart', ()=> { speakText('Arise Shukla. System is active.'); setOrb('listen'); }, {passive:false});

// ---------- chat controls ----------
document.getElementById('sendBtn').addEventListener('click', ()=> {
  const v = promptInput.value.trim(); if(!v) return;
  askServer(v, modeSelect.value); promptInput.value='';
});
document.getElementById('speakBtn').addEventListener('click', ()=> {
  const v = promptInput.value.trim(); if(!v) return;
  askServer(v, modeSelect.value).then(()=> promptInput.value='');
});

// ---------- basic UI bindings ----------
nameInput.oninput = ()=> { state.name = nameInput.value; saveLocal(); }
classInput.oninput = ()=> { state.cls = classInput.value; saveLocal(); }
totalChInput.oninput = ()=> { state.total = Math.max(0, +totalChInput.value || 0); saveLocal(); renderUI(); }
doneChInput.oninput = ()=> { state.done = Math.max(0, +doneChInput.value || 0); saveLocal(); renderUI(); }

document.getElementById('saveBtn').addEventListener('click', ()=> { saveLocal(); notify('Saved locally'); });
document.getElementById('addDone').addEventListener('click', ()=> { state.done++; saveLocal(); renderUI(); notify('Chapter added'); });
document.getElementById('boostFocus').addEventListener('click', ()=> { state.focus = Math.min(100, state.focus+5); saveLocal(); renderUI(); });
document.getElementById('boostDisc').addEventListener('click', ()=> { state.disc = Math.min(100, state.disc+5); saveLocal(); renderUI(); });

// ---------- floating formula background (simple) ----------
(function spawnFormulas(){
  const formulas = ['F = ma','v = u + at','s = ut + 1/2 at²','PV = nRT','ΔG = ΔH - TΔS','∫ x^n dx = x^{n+1}/(n+1)','d/dx(sin x)=cos x','pH = -log[H+]','Metaphor','Alliteration'];
  const layer = document.getElementById('formulaLayer');
  const W = window.innerWidth, H = window.innerHeight;
  for(let i=0;i<26;i++){
    const el = document.createElement('div'); el.className='formula';
    el.textContent = formulas[Math.floor(Math.random()*formulas.length)];
    el.style.left = Math.random()*W + 'px';
    el.style.top = Math.random()*H + 'px';
    el.style.fontSize = (12 + Math.random()*20)+'px';
    el.style.setProperty('--x', (Math.random()*60 - 30)+'px');
    el.style.animationDuration = (18 + Math.random()*28)+'s';
    layer.appendChild(el);
  }
})();

// ---------- init ----------
drawChart();
renderUI();
notify('Shukla GPT ready.');
