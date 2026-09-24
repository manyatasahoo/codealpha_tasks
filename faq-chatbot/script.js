(function(){
  // ---------- FAQ dataset ----------
  const FAQS = [
    {q:"What are your opening hours?", a:"We're open Monday to Saturday, 8am–7pm, and Sunday 10am–4pm."},
    {q:"Do you repair all bike brands?", a:"Yes — we service every brand and type, including e-bikes and cargo bikes."},
    {q:"How much does a basic tune-up cost?", a:"A basic tune-up is $45. It covers gear and brake adjustment, wheel truing, and a full lubrication."},
    {q:"How long does a repair usually take?", a:"Most repairs are done same-day. More involved jobs (like a full overhaul) take 2–3 business days."},
    {q:"Do you offer bike rentals?", a:"Yes — $8/hour, $30/day, or $120/week, and every rental includes a helmet and lock."},
    {q:"Can I rent an electric bike?", a:"Yes, e-bike rentals are available for $55/day, subject to availability."},
    {q:"Do you sell new bikes?", a:"We stock road, mountain, hybrid, and kids' bikes from several brands — come test ride one."},
    {q:"Do you buy or trade in used bikes?", a:"Yes, bring it in for a free inspection and we'll offer trade-in credit or cash."},
    {q:"Is there a warranty on repairs?", a:"All labor is covered by a 30-day warranty; parts follow the manufacturer's own warranty."},
    {q:"Can you fix a flat tire while I wait?", a:"Yes, walk-in flat repairs take about 15 minutes and cost $12."},
    {q:"Do you offer bike fitting sessions?", a:"Yes, a professional fitting session is $60 and takes about 45 minutes."},
    {q:"What safety gear do you sell?", a:"Helmets, lights, locks, reflective gear, and gloves — all in stock."},
    {q:"Do you host group rides?", a:"Yes, a free group ride leaves every Saturday at 9am, all levels welcome."},
    {q:"How do I book a repair appointment?", a:"Book online, call the shop, or just walk in — same-day slots are usually available."},
    {q:"Do you have a student discount?", a:"Yes, 10% off repairs and accessories with a valid student ID."}
  ];
  const SUGGESTED = [0,4,5,9,14,2];

  // ---------- preprocessing ----------
  const STOP = new Set("a an the is are was were do does did you your can could would i we my me to of for and or in on at with about how much does it".split(" "));
  function stem(w){
    return w.replace(/(ing|ed|es|s)$/,"").length>2 ? w.replace(/(ing|ed|es|s)$/,"") : w;
  }
  function tokenize(str){
    return str.toLowerCase()
      .replace(/[^a-z0-9\s]/g," ")
      .split(/\s+/)
      .filter(w=>w && !STOP.has(w))
      .map(stem);
  }

  // ---------- TF-IDF ----------
  const docsTokens = FAQS.map(f=>tokenize(f.q));
  const vocab = Array.from(new Set(docsTokens.flat()));
  const idf = {};
  vocab.forEach(term=>{
    const df = docsTokens.filter(d=>d.includes(term)).length;
    idf[term] = Math.log((docsTokens.length+1)/(df+1)) + 1;
  });
  function vectorize(tokens){
    const tf = {};
    tokens.forEach(t=>{ tf[t]=(tf[t]||0)+1; });
    return vocab.map(term=> (tf[term]||0) * idf[term]);
  }
  const docVectors = docsTokens.map(vectorize);
  function cosine(a,b){
    let dot=0,na=0,nb=0;
    for(let i=0;i<a.length;i++){ dot+=a[i]*b[i]; na+=a[i]*a[i]; nb+=b[i]*b[i]; }
    if(na===0||nb===0) return 0;
    return dot/(Math.sqrt(na)*Math.sqrt(nb));
  }
  function bestMatch(query){
    const qv = vectorize(tokenize(query));
    let best=-1, score=0;
    docVectors.forEach((dv,i)=>{
      const s = cosine(qv,dv);
      if(s>score){ score=s; best=i; }
    });
    return {index:best, score};
  }

  // ---------- UI ----------
  const messagesEl = document.getElementById('messages');
  const chipsEl = document.getElementById('chips');
  const form = document.getElementById('composer');
  const input = document.getElementById('q');

  function addMsg(text, who, confidence){
    const div = document.createElement('div');
    div.className = 'msg ' + who;
    div.textContent = text;
    if(confidence !== undefined){
      const c = document.createElement('span');
      c.className = 'conf';
      c.textContent = 'match confidence: ' + Math.round(confidence*100) + '%';
      div.appendChild(c);
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function respond(query){
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    setTimeout(()=>{
      typing.remove();
      const {index, score} = bestMatch(query);
      if(index === -1 || score < 0.18){
        addMsg("I'm not confident I have that one. Try asking about hours, repairs, rentals, or trade-ins — or call the shop directly.", 'bot');
      } else {
        addMsg(FAQS[index].a, 'bot', score);
      }
    }, 480 + Math.random()*260);
  }

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const val = input.value.trim();
    if(!val) return;
    addMsg(val, 'user');
    input.value = '';
    respond(val);
  });

  // horizontal scroll for the chips row: mouse wheel + click-and-drag
  (function(){
    let isDown=false, startX=0, startScroll=0, moved=false;
    chipsEl.addEventListener('wheel', e=>{
      if(Math.abs(e.deltaY) > Math.abs(e.deltaX)){
        chipsEl.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    }, {passive:false});
    chipsEl.addEventListener('mousedown', e=>{
      isDown = true; moved = false;
      startX = e.pageX; startScroll = chipsEl.scrollLeft;
      chipsEl.classList.add('dragging');
    });
    window.addEventListener('mouseup', ()=>{ isDown=false; chipsEl.classList.remove('dragging'); });
    window.addEventListener('mousemove', e=>{
      if(!isDown) return;
      const dx = e.pageX - startX;
      if(Math.abs(dx) > 4) moved = true;
      chipsEl.scrollLeft = startScroll - dx;
    });
    // suppress the click that fires right after a drag, so it doesn't fire a chip's own click
    chipsEl.addEventListener('click', e=>{ if(moved){ e.stopPropagation(); e.preventDefault(); } }, true);
  })();

  SUGGESTED.forEach(i=>{
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.type = 'button';
    chip.textContent = FAQS[i].q;
    chip.addEventListener('click', ()=>{
      addMsg(FAQS[i].q, 'user');
      respond(FAQS[i].q);
    });
    chipsEl.appendChild(chip);
  });

  addMsg("Hi! Ask me anything about repairs, rentals, hours, or trade-ins — I'll match it against our FAQs.", 'bot');
})();
