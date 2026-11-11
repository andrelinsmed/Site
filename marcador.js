/* Marcador de texto: selecione um trecho e escolha uma cor para pintar a letra.
   As marcações ficam salvas no navegador (localStorage), por página e por conteúdo aberto. */
(function(){
  const CORES = [["vermelho","Vermelho"],["laranja","Laranja"],["verde","Verde"],["azul","Azul"],["roxo","Roxo"]];
  const SKIP = "svg,button,input,textarea,select,iframe,nav,.caiu-box,.video,.fc,.fc-seg,.fc-pane,.mk-bar,[data-nomark]";
  const PREF = "marcador:";

  const css = document.createElement("style");
  css.textContent = `
.mk-vermelho{color:#c8191f}.mk-laranja{color:#c4570a}.mk-verde{color:#17803f}.mk-azul{color:#1859c4}.mk-roxo{color:#7a35d6}
:root[data-theme="dark"] .mk-vermelho{color:#ff6b6b}:root[data-theme="dark"] .mk-laranja{color:#ffa45c}:root[data-theme="dark"] .mk-verde{color:#5fd38d}:root[data-theme="dark"] .mk-azul{color:#6aa8ff}:root[data-theme="dark"] .mk-roxo{color:#b98cff}
.mk-bar{position:fixed;z-index:9999;display:flex;align-items:center;gap:6px;padding:6px 8px;background:#1d1d1f;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.25);transform:translateX(-50%)}
.mk-bar[hidden]{display:none}
.mk-bar button{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.85);cursor:pointer;padding:0;display:grid;place-items:center;font:600 13px/1 -apple-system,system-ui,sans-serif;color:#fff;background:none}
.mk-bar button:hover{transform:scale(1.12)}
.mk-bar .c-vermelho{background:#e5383b}.mk-bar .c-laranja{background:#f07d1a}.mk-bar .c-verde{background:#24a159}.mk-bar .c-azul{background:#2f74e0}.mk-bar .c-roxo{background:#8b4ce8}
.mk-bar .sep{width:1px;height:18px;background:rgba(255,255,255,.3);margin:0 2px}
.mk-bar .er{border-color:rgba(255,255,255,.5)}`;
  document.head.appendChild(css);

  const root = ()=>document.getElementById("doc") || document.querySelector("main");
  const key = ()=>{ const r = root(), h = r && r.querySelector("h1"), p = document.getElementById("pane");
    return PREF + location.pathname + "|" + (h ? h.textContent.trim() : "") + "|" + (p ? p.className : ""); };
  const load = ()=>{ try { return JSON.parse(localStorage.getItem(key()) || "[]"); } catch(e){ return []; } };
  const save = m=>{ try { m.length ? localStorage.setItem(key(), JSON.stringify(m)) : localStorage.removeItem(key()); } catch(e){} };

  // Percorre só o texto "marcável" do conteúdo, na ordem do documento
  function walker(r){
    return document.createTreeWalker(r, NodeFilter.SHOW_TEXT, { acceptNode: n =>
      (n.parentElement && n.parentElement.closest(SKIP)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  }
  function textOf(r){ let s = "", w = walker(r), n; while ((n = w.nextNode())) s += n.data; return s; }
  // Converte um ponto (nó, deslocamento) em posição no texto marcável
  function offsetOf(r, node, off){
    const br = document.createRange(); br.setStart(node, off); br.collapse(true);
    let pos = 0, w = walker(r), n;
    while ((n = w.nextNode())){
      if (br.comparePoint(n, 0) >= 0) break;              // este texto começa depois do ponto
      if (br.comparePoint(n, n.data.length) <= 0) { pos += n.data.length; continue; } // termina antes
      return pos + off;                                   // o ponto está dentro deste texto
    }
    return pos;
  }

  let obs = null;
  function unwrap(r){
    r.querySelectorAll("span.mk").forEach(s=>{ const p = s.parentNode; while (s.firstChild) p.insertBefore(s.firstChild, s); p.removeChild(s); p.normalize(); });
  }
  function apply(){
    const r = root(); if (!r) return;
    unwrap(r);
    const marks = load(); if (marks.length){
      const full = textOf(r);
      marks.forEach(m=>{ // confere se o trecho ainda está no mesmo lugar; se o texto mudou, procura o trecho
        if (full.slice(m.s, m.e) !== m.t){ const i = full.indexOf(m.t); if (i < 0) { m.skip = true; return; } m.s = i; m.e = i + m.t.length; }
      });
      const segs = []; let pos = 0, w = walker(r), n;
      while ((n = w.nextNode())) { segs.push([n, pos, pos + n.data.length]); pos += n.data.length; }
      marks.filter(m=>!m.skip).sort((a,b)=>b.s - a.s).forEach(m=>{
        for (let i = segs.length - 1; i >= 0; i--){
          let [node, a, b] = segs[i];
          const s = Math.max(m.s, a), e = Math.min(m.e, b); if (s >= e) continue;
          let t = node; if (e < b) t.splitText(e - a);
          if (s > a){ t = t.splitText(s - a); }
          const sp = document.createElement("span"); sp.className = "mk mk-" + m.c; t.parentNode.insertBefore(sp, t); sp.appendChild(t);
          if (s > a) segs[i] = [node, a, s];
        }
      });
    }
    if (obs) obs.takeRecords();
  }

  // Barra de cores
  const bar = document.createElement("div"); bar.className = "mk-bar"; bar.hidden = true; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Cor da letra");
  bar.innerHTML = CORES.map(([c, n])=>`<button type="button" class="c-${c}" data-c="${c}" title="${n}" aria-label="Pintar de ${n.toLowerCase()}"></button>`).join("") +
    `<span class="sep"></span><button type="button" class="er" data-c="" title="Tirar a cor" aria-label="Tirar a cor">⌫</button>`;
  document.body.appendChild(bar);
  let cur = null;
  bar.addEventListener("pointerdown", e=>e.preventDefault()); // não perde a seleção ao tocar na barra
  bar.addEventListener("click", e=>{
    const b = e.target.closest("button"); if (!b || !cur) return;
    const r = root(), { s, e: en, t } = cur;
    const old = load(), full = textOf(r);
    const marks = old.filter(m=>m.e <= s || m.s >= en);
    // marcações que cruzam a seleção: guarda só as partes que ficam de fora
    old.forEach(m=>{ if (m.e <= s || m.s >= en) return;
      if (m.s < s) marks.push({s:m.s, e:s, c:m.c, t:full.slice(m.s, s)});
      if (m.e > en) marks.push({s:en, e:m.e, c:m.c, t:full.slice(en, m.e)}); });
    if (b.dataset.c) marks.push({s, e:en, c:b.dataset.c, t});
    save(marks.sort((a,b)=>a.s - b.s)); apply();
    window.getSelection().removeAllRanges(); bar.hidden = true; cur = null;
  });
  function check(){
    const sel = window.getSelection(), r = root();
    if (!r || !sel.rangeCount || sel.isCollapsed){ bar.hidden = true; cur = null; return; }
    const rg = sel.getRangeAt(0);
    if (!r.contains(rg.commonAncestorContainer)){ bar.hidden = true; cur = null; return; }
    const s = offsetOf(r, rg.startContainer, rg.startOffset), e = offsetOf(r, rg.endContainer, rg.endOffset);
    if (e - s < 1){ bar.hidden = true; cur = null; return; }
    cur = { s, e, t: textOf(r).slice(s, e) };
    const box = rg.getBoundingClientRect(), touch = matchMedia("(pointer:coarse)").matches;
    bar.hidden = false;
    const top = touch ? box.bottom + 14 : box.top - bar.offsetHeight - 10;
    bar.style.top = Math.max(8, Math.min(innerHeight - bar.offsetHeight - 8, top < 8 ? box.bottom + 10 : top)) + "px";
    bar.style.left = Math.max(bar.offsetWidth / 2 + 8, Math.min(innerWidth - bar.offsetWidth / 2 - 8, box.left + box.width / 2)) + "px";
  }
  let tm; document.addEventListener("selectionchange", ()=>{ clearTimeout(tm); tm = setTimeout(check, 180); });
  addEventListener("scroll", ()=>{ if (!bar.hidden) check(); }, {passive:true});

  // Reaplica as marcações sempre que o conteúdo da página é trocado
  function watch(){
    const r = root(); if (!r) return;
    let t2; obs = new MutationObserver(()=>{ clearTimeout(t2); t2 = setTimeout(apply, 60); });
    obs.observe(r, {childList:true, subtree:true});
    apply();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watch); else watch();
})();
