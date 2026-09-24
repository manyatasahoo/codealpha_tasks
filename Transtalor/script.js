(function(){
  const GEMINI_API_KEY = "AIzaSyBHn8D8h8lY-qVm4X0NYrhCYMTvKSZHssw";
  const GEMINI_MODEL = "gemini-3.6-flash";
  const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const LANGS = [
    ["en","English"],["es","Spanish"],["fr","French"],["de","German"],["it","Italian"],
    ["pt","Portuguese"],["nl","Dutch"],["ru","Russian"],["pl","Polish"],["tr","Turkish"],
    ["ar","Arabic"],["hi","Hindi"],["bn","Bengali"],["ur","Urdu"],["ta","Tamil"],
    ["te","Telugu"],["mr","Marathi"],["gu","Gujarati"],["zh","Chinese (Simplified)"],
    ["ja","Japanese"],["ko","Korean"],["vi","Vietnamese"],["th","Thai"],["id","Indonesian"],
    ["ms","Malay"],["sv","Swedish"],["no","Norwegian"],["da","Danish"],["fi","Finnish"],
    ["el","Greek"],["he","Hebrew"],["cs","Czech"],["ro","Romanian"],["hu","Hungarian"],
    ["uk","Ukrainian"],["sw","Swahili"]
  ];

  const srcLang = document.getElementById('srcLang');
  const tgtLang = document.getElementById('tgtLang');
  const srcText = document.getElementById('srcText');
  const outputText = document.getElementById('outputText');
  const charCount = document.getElementById('charCount');
  const translateBtn = document.getElementById('translateBtn');
  const swapBtn = document.getElementById('swapBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyBtn = document.getElementById('copyBtn');
  const copiedTag = document.getElementById('copiedTag');
  const listenSrcBtn = document.getElementById('listenSrcBtn');
  const listenTgtBtn = document.getElementById('listenTgtBtn');
  const errorBanner = document.getElementById('errorBanner');

  LANGS.forEach(([code,name])=>{
    srcLang.add(new Option(name, code));
    tgtLang.add(new Option(name, code));
  });
  srcLang.value = 'en';
  tgtLang.value = 'es';

  function langName(code){
    const hit = LANGS.find(([c]) => c === code);
    return hit ? hit[1] : code;
  }

  // BCP-47 locale for each language code, used to pick a matching speech voice
  const SPEECH_LOCALE = {
    en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE', it:'it-IT', pt:'pt-PT',
    nl:'nl-NL', ru:'ru-RU', pl:'pl-PL', tr:'tr-TR', ar:'ar-SA', hi:'hi-IN',
    bn:'bn-BD', ur:'ur-PK', ta:'ta-IN', te:'te-IN', mr:'mr-IN', gu:'gu-IN',
    zh:'zh-CN', ja:'ja-JP', ko:'ko-KR', vi:'vi-VN', th:'th-TH', id:'id-ID',
    ms:'ms-MY', sv:'sv-SE', no:'nb-NO', da:'da-DK', fi:'fi-FI', el:'el-GR',
    he:'he-IL', cs:'cs-CZ', ro:'ro-RO', hu:'hu-HU', uk:'uk-UA', sw:'sw-KE'
  };

  let availableVoices = [];
  function loadVoices(){
    if('speechSynthesis' in window){
      availableVoices = window.speechSynthesis.getVoices();
    }
  }
  loadVoices();
  if('speechSynthesis' in window){
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  function pickVoice(locale){
    if(!availableVoices.length) return null;
    const base = locale.split('-')[0];
    return availableVoices.find(v => v.lang === locale)
      || availableVoices.find(v => v.lang && v.lang.toLowerCase().startsWith(base))
      || null;
  }

  let debounceTimer = null;
  let currentController = null;
  let lastTranslated = '';

  function setError(msg){
    if(!msg){ errorBanner.classList.remove('show'); errorBanner.textContent=''; return; }
    errorBanner.textContent = msg;
    errorBanner.classList.add('show');
  }

  function updateCharCount(){
    const len = srcText.value.length;
    charCount.textContent = len + ' / 480';
    charCount.classList.toggle('warn', len > 440);
  }

  function setLoading(isLoading){
    translateBtn.classList.toggle('loading', isLoading);
    translateBtn.disabled = isLoading;
    if(isLoading){
      outputText.classList.remove('empty');
      outputText.innerHTML = '<span class="skeleton"><span></span><span></span><span></span></span>';
    }
  }

  function showOutput(text){
    outputText.classList.remove('empty');
    outputText.textContent = text;
    copyBtn.disabled = false;
    listenTgtBtn.disabled = false;
    lastTranslated = text;
  }

  function showEmptyOutput(){
    outputText.classList.add('empty');
    outputText.textContent = 'Your translation will appear here.';
    copyBtn.disabled = true;
    listenTgtBtn.disabled = true;
    lastTranslated = '';
  }

  async function translate(){
    const text = srcText.value.trim();
    setError(null);
    if(!text){ showEmptyOutput(); return; }
    if(srcLang.value === tgtLang.value){
      showOutput(text);
      return;
    }

    if(currentController) currentController.abort();
    currentController = new AbortController();
    setLoading(true);

    const fromName = langName(srcLang.value);
    const toName = langName(tgtLang.value);
    const prompt = `Translate the following text from ${fromName} to ${toName}. `
      + `Reply with only the translated text — no quotes, no explanation, no notes.\n\n${text}`;

    try{
      const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: currentController.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });

      const data = await res.json();

      if(!res.ok){
        const apiMsg = data && data.error && data.error.message;
        throw new Error(apiMsg || ('Request failed with status ' + res.status));
      }

      const translated = data
        && data.candidates && data.candidates[0]
        && data.candidates[0].content && data.candidates[0].content.parts
        && data.candidates[0].content.parts.map(p => p.text || '').join('').trim();

      if(!translated) throw new Error('No translation returned');
      showOutput(translated);
    }catch(err){
      if(err.name === 'AbortError') return;
      setError(err.message ? `Translation failed: ${err.message}` : "Couldn't reach the translation service. Check your connection and try again.");
      showEmptyOutput();
    }finally{
      setLoading(false);
    }
  }

  function scheduleAutoTranslate(){
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(translate, 650);
  }

  srcText.addEventListener('input', ()=>{
    updateCharCount();
    scheduleAutoTranslate();
  });

  srcText.addEventListener('keydown', (e)=>{
    if((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
      e.preventDefault();
      clearTimeout(debounceTimer);
      translate();
    }
  });

  translateBtn.addEventListener('click', ()=>{
    clearTimeout(debounceTimer);
    translate();
  });

  [srcLang, tgtLang].forEach(sel=>{
    sel.addEventListener('change', ()=>{
      clearTimeout(debounceTimer);
      if(srcText.value.trim()) translate();
    });
  });

  swapBtn.addEventListener('click', ()=>{
    const s = srcLang.value;
    srcLang.value = tgtLang.value;
    tgtLang.value = s;
    if(lastTranslated){
      srcText.value = lastTranslated;
      updateCharCount();
    }
    if(srcText.value.trim()) translate();
  });

  clearBtn.addEventListener('click', ()=>{
    srcText.value = '';
    updateCharCount();
    setError(null);
    showEmptyOutput();
    srcText.focus();
  });

  copyBtn.addEventListener('click', async ()=>{
    if(!lastTranslated) return;
    try{
      await navigator.clipboard.writeText(lastTranslated);
      copiedTag.classList.add('show');
      setTimeout(()=>copiedTag.classList.remove('show'), 1400);
    }catch(err){
      setError('Copy failed — you can select the text manually.');
    }
  });

  function speak(text, langCode){
    if(!text) return;
    if(!('speechSynthesis' in window)){
      setError('Text-to-speech is not supported in this browser.');
      return;
    }

    // Safari/Chrome sometimes report an empty voice list on the very first
    // call because they load voices asynchronously — force a reload once.
    if(!availableVoices.length){
      loadVoices();
    }

    window.speechSynthesis.cancel();

    const locale = SPEECH_LOCALE[langCode] || langCode;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = locale;
    utter.rate = 0.95;

    const voice = pickVoice(locale);
    if(voice){
      utter.voice = voice;
    } else if(availableVoices.length){
      // Voices are loaded but none match this language on this device/OS.
      setError(`No installed voice found for ${langName(langCode)} on this device. You may need to add that language's voice in your system's accessibility/speech settings.`);
      return;
    }

    utter.onerror = () => {
      setError('Playback was interrupted. Try again.');
    };

    // A tiny delay avoids a known Chrome/Safari race where cancel() + speak()
    // fired in the same tick drops the very next utterance.
    setTimeout(() => window.speechSynthesis.speak(utter), 30);
  }

  listenSrcBtn.addEventListener('click', ()=> speak(srcText.value.trim(), srcLang.value));
  listenTgtBtn.addEventListener('click', ()=> speak(lastTranslated, tgtLang.value));

  updateCharCount();
})();
