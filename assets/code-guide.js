(()=>{
  const q=(r,s)=>r.querySelector(s), qa=(r,s)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function svgWrap(inner){return `<svg viewBox="0 0 640 180" role="img" aria-label="コード処理の可視化">${inner}</svg>`}
  function renderVisual(type,step,total){
    const k=Math.max(0,Math.min(step,total-1));
    if(type==='regression'||type==='multiple'){
      const pts=[[60,135],[105,118],[150,128],[195,95],[240,108],[285,75],[330,83],[375,58],[420,67],[465,40]];
      const colors=pts.map((_,i)=>i<Math.ceil(pts.length*.75)?'#38bdf8':'#f97316');
      let inner=`<line x1="38" y1="150" x2="600" y2="150" stroke="#94a3b8"/><line x1="38" y1="150" x2="38" y2="18" stroke="#94a3b8"/>`;
      if(k<=1) inner+=pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${colors[i]}" opacity="${k===0?1:.75}"/>`).join('');
      else if(k===2) inner+=pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${colors[i]}"/><text x="${p[0]-4}" y="${p[1]-12}" font-size="10" fill="#475569">${i<8?'訓':'テ'}</text>`).join('');
      else {inner+=pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="${colors[i]}" opacity=".8"/>`).join('');inner+=`<line x1="55" y1="140" x2="500" y2="32" stroke="#7c3aed" stroke-width="4"/><text x="350" y="28" font-size="13" font-weight="700" fill="#6d28d9">予測モデル</text>`;}
      if(k>=total-2) inner+=`<rect x="505" y="42" width="112" height="72" rx="12" fill="#ecfdf5" stroke="#10b981"/><text x="561" y="68" text-anchor="middle" font-size="12" font-weight="700">評価</text><text x="561" y="91" text-anchor="middle" font-size="11">R² / RMSE</text>`;
      return svgWrap(inner);
    }
    if(type==='cluster'){
      const a=[[80,55],[105,42],[120,70],[95,82],[145,58]],b=[[300,110],[330,92],[350,120],[315,135],[375,100]],c=[[495,48],[520,70],[545,43],[565,78],[510,95]];
      const all=[a,b,c];let inner='';all.forEach((g,gi)=>g.forEach(p=>inner+=`<circle cx="${p[0]}" cy="${p[1]}" r="7" fill="${k<3?'#94a3b8':['#38bdf8','#f97316','#8b5cf6'][gi]}"/>`));
      if(k>=3) [[110,60],[335,112],[530,66]].forEach((p,gi)=>inner+=`<path d="M${p[0]-8},${p[1]}h16M${p[0]},${p[1]-8}v16" stroke="${['#0284c7','#ea580c','#7c3aed'][gi]}" stroke-width="4"/>`);
      if(k>=4) inner+=`<text x="110" y="25" text-anchor="middle" font-size="12" font-weight="700">cluster 0</text><text x="335" y="165" text-anchor="middle" font-size="12" font-weight="700">cluster 1</text><text x="530" y="25" text-anchor="middle" font-size="12" font-weight="700">cluster 2</text>`;
      return svgWrap(inner);
    }
    if(type==='classification'||type==='knn'||type==='tree'){
      const pts=[[90,45,0],[120,70,0],[150,42,0],[190,82,0],[350,110,1],[390,85,1],[430,120,1],[470,95,1],[530,55,2],[555,78,2],[500,38,2]];
      let inner=pts.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="8" fill="${['#38bdf8','#f97316','#8b5cf6'][p[2]]}" opacity="${k<2?.65:1}"/>`).join('');
      if(type==='knn'&&k>=3){inner+=`<circle cx="300" cy="72" r="10" fill="#0f172a"/><circle cx="300" cy="72" r="85" fill="none" stroke="#0f172a" stroke-dasharray="7 6"/><text x="300" y="58" text-anchor="middle" font-size="11" font-weight="700">新しいデータ</text>`;}
      if(type==='tree'&&k>=2){inner+=`<line x1="280" y1="15" x2="280" y2="165" stroke="#0f172a" stroke-width="3"/><line x1="470" y1="15" x2="470" y2="165" stroke="#0f172a" stroke-width="3"/><text x="280" y="14" text-anchor="middle" font-size="11">条件1</text><text x="470" y="14" text-anchor="middle" font-size="11">条件2</text>`;}
      if(k>=total-2) inner+=`<rect x="40" y="140" width="150" height="30" rx="10" fill="#ecfdf5" stroke="#10b981"/><text x="115" y="160" text-anchor="middle" font-size="11" font-weight="700">正解率を確認</text>`;
      return svgWrap(inner);
    }
    if(type==='iot'){
      const raw=[105,55,115,70,125,78,118,68,110,73],ma=[90,87,90,89,97,92,100,87,91,84];
      const path=a=>a.map((y,i)=>`${i?'L':'M'}${55+i*55},${y}`).join(' ');
      let inner=`<line x1="35" y1="150" x2="610" y2="150" stroke="#94a3b8"/><path d="${path(raw)}" fill="none" stroke="#f97316" stroke-width="3"/>`;
      if(k>=2)inner+=`<path d="${path(ma)}" fill="none" stroke="#0ea5e9" stroke-width="4"/><text x="430" y="45" font-size="12" font-weight="700" fill="#0369a1">移動平均</text>`;
      return svgWrap(inner);
    }
    if(type==='histogram'){
      const h=[45,85,130,105,62,30,15,8];return `<div class="guide-visual-title">値を階級に分けて数える</div><div class="guide-mini-table">${h.map((v,i)=>`<div class="guide-bar" style="height:${k<2?Math.max(12,v*.45):v}px;opacity:${k>=2?1:.72}" title="階級${i+1}"></div>`).join('')}</div>`;
    }
    if(type==='survey'){
      const vals=[2,5,9,7,3];return `<div class="guide-visual-title">回答を集計して割合を見る</div><div class="grid grid-cols-5 gap-3 items-end h-36">${vals.map((v,i)=>`<div class="text-center"><div class="rounded-t-xl bg-sky-500" style="height:${30+v*9}px"></div><b class="text-xs">${i+1}</b></div>`).join('')}</div>${k>=3?'<div class="mt-3 rounded-xl bg-violet-50 p-3 text-sm font-bold">学年別の割合へクロス集計</div>':''}`;
    }
    if(type==='factor'){
      let inner=`<circle cx="320" cy="50" r="28" fill="#ede9fe" stroke="#8b5cf6"/><text x="320" y="55" text-anchor="middle" font-size="12" font-weight="700">因子</text>`;[80,170,260,380,470,560].forEach((x,i)=>{inner+=`<rect x="${x-34}" y="125" width="68" height="30" rx="9" fill="#f8fafc" stroke="#94a3b8"/><text x="${x}" y="145" text-anchor="middle" font-size="11">Q${i+1}</text>${k>=2?`<line x1="320" y1="78" x2="${x}" y2="125" stroke="${i<3?'#8b5cf6':'#0ea5e9'}" stroke-width="${i<3?4:2}"/>`:''}`});return svgWrap(inner);
    }
    if(type==='uiux'){
      return `<div class="guide-visual-title">クリックでDOMの文字が変わる</div><div class="rounded-2xl bg-sky-50 p-5 text-center"><button class="guide-control primary" data-demo-ui-button>最新値を表示</button><p data-demo-ui-status class="mt-5 text-xl font-black">未更新</p><p class="mt-2 text-xs text-slate-500">JavaScriptがイベントを待ち、textContentを書き換えます</p></div>`;
    }
    if(type==='prompt'){
      return `<div class="guide-visual-title">入力 → 生成 → 検証</div><div class="grid md:grid-cols-3 gap-3"><div class="rounded-xl bg-sky-50 border p-3"><b>依頼文</b><p class="text-xs mt-2">目的・条件・禁止事項</p></div><div class="rounded-xl bg-violet-50 border p-3"><b>生成結果</b><p class="text-xs mt-2">コード案・説明</p></div><div class="rounded-xl bg-amber-50 border p-3"><b>人が確認</b><p class="text-xs mt-2">列名・出典・実行結果</p></div></div>`;
    }
    if(type==='folds'){
      return `<div class="guide-visual-title">5分割交差検証</div><div class="grid gap-2">${[0,1,2,3,4].map(i=>`<div class="grid grid-cols-5 gap-1">${[0,1,2,3,4].map(j=>`<span class="h-7 rounded-md ${j===((k+i)%5)?'bg-orange-400':'bg-sky-400'}"></span>`).join('')}</div>`).join('')}</div><div class="mt-3 flex gap-4 text-xs font-bold"><span><i class="inline-block w-3 h-3 bg-sky-400 rounded-sm"></i> 訓練</span><span><i class="inline-block w-3 h-3 bg-orange-400 rounded-sm"></i> 評価</span></div>`;
    }
    if(type==='log'){
      const lines=['"task": "データ整形"','"evidence": "47 rows"','"decision": "人口当たり"','"issue": "年次未確認"','"next_action": "解説PDF確認"'];return `<div class="guide-visual-title">作業を構造化してJSONへ</div><pre class="rounded-xl bg-slate-950 text-emerald-200 p-4 text-xs leading-7">{\n${lines.slice(0,Math.max(1,k+1)).map(x=>'  '+x).join(',\n')}\n}</pre>`;
    }
    if(type==='timeline'){
      const names=['問題','データ','結果','デモ','限界'];const widths=[13,20,20,30,17];return `<div class="guide-visual-title">5分を役割ごとに配分</div><div class="flex h-20 rounded-xl overflow-hidden border">${names.map((n,i)=>`<div class="grid place-items-center text-white text-xs font-black" style="width:${widths[i]}%;background:${['#0ea5e9','#8b5cf6','#ec4899','#f97316','#059669'][i]};opacity:${i<=k?1:.28}">${n}</div>`).join('')}</div>`;
    }
    if(type==='rule'){
      return svgWrap(`<rect x="235" y="12" width="170" height="36" rx="12" fill="#e0f2fe" stroke="#0ea5e9"/><text x="320" y="35" text-anchor="middle" font-size="12" font-weight="700">センサ値を入力</text><line x1="320" y1="48" x2="320" y2="78" stroke="#64748b"/><polygon points="320,78 270,110 320,142 370,110" fill="#fff7ed" stroke="#f97316"/><text x="320" y="114" text-anchor="middle" font-size="11">条件?</text><line x1="270" y1="110" x2="130" y2="110" stroke="#64748b"/><line x1="370" y1="110" x2="510" y2="110" stroke="#64748b"/><text x="200" y="100" font-size="10">Yes</text><text x="435" y="100" font-size="10">No</text><rect x="55" y="92" width="110" height="36" rx="10" fill="#fee2e2"/><text x="110" y="115" text-anchor="middle" font-size="11">条件を確認</text><rect x="475" y="92" width="110" height="36" rx="10" fill="#dcfce7"/><text x="530" y="115" text-anchor="middle" font-size="11">記録を継続</text>`);
    }
    return `<div class="guide-visual-title">処理の流れ</div><div class="guide-chip-row">${Array.from({length:total},(_,i)=>`<span class="guide-chip ${i<=k?'active':''}">STEP ${i+1}</span>`).join('')}</div>`;
  }

  function initGuide(root){
    const dataEl=q(root,'.code-guide-data'); if(!dataEl)return;
    let data;try{data=JSON.parse(dataEl.textContent)}catch(e){console.error(e);return}
    const toggle=q(root,'.code-guide-toggle'),panel=q(root,'.code-guide-panel'),flow=q(root,'.guide-flow'),stage=q(root,'.guide-stage-body'),title=q(root,'.guide-stage-title'),count=q(root,'.guide-stage-count'),progress=q(root,'.guide-progress span'),acc=q(root,'.guide-accordion');
    let idx=0,timer=null;
    flow.innerHTML=data.steps.map((s,i)=>`<button class="guide-flow-node" data-step="${i}"><span class="guide-step-no">${i+1}</span><span><b>${esc(s.title)}</b><small class="block mt-1">${esc(s.lines||'')}</small></span><i class="fa-solid fa-chevron-right text-slate-400"></i></button>`).join('');
    acc.innerHTML=data.steps.map((s,i)=>`<article class="guide-acc-item"><button class="guide-acc-btn" aria-expanded="false"><span><span class="guide-line-label">${esc(s.lines||`STEP ${i+1}`)}</span><span class="ml-2">${esc(s.title)}</span></span><i class="fa-solid fa-chevron-down"></i></button><div class="guide-acc-panel"><div><p><b>何をしている？</b><br>${esc(s.what)}</p><p class="mt-3"><b>初心者が確認すること</b><br>${esc(s.watch||'入力値と出力値が何を表しているか確認します。')}</p>${s.warn?`<p class="warn"><b>注意：</b>${esc(s.warn)}</p>`:''}</div></div></article>`).join('');
    function render(){
      const s=data.steps[idx]; title.textContent=s.title;count.textContent=`${idx+1} / ${data.steps.length}`;
      stage.innerHTML=`<p class="guide-stage-summary">${esc(s.what)}</p><div class="guide-io-grid"><div class="guide-io"><b>INPUT / この段階へ入るもの</b><p>${esc(s.input||'前の段階の結果')}</p></div><div class="guide-io"><b>OUTPUT / この段階から出るもの</b><p>${esc(s.output||'次の段階で使う結果')}</p></div></div>${s.code?`<pre class="guide-code-fragment">${esc(s.code)}</pre>`:''}<div class="guide-visual">${renderVisual(data.visual,idx,data.steps.length)}</div>`;
      if(data.visual==='uiux'){const b=q(stage,'[data-demo-ui-button]'),st=q(stage,'[data-demo-ui-status]');if(b&&st)b.onclick=()=>st.textContent='更新しました 10:30'}
      qa(flow,'.guide-flow-node').forEach((n,i)=>{n.classList.toggle('active',i===idx);n.classList.toggle('done',i<idx)});progress.style.width=`${(idx+1)/data.steps.length*100}%`;
      q(root,'[data-prev]').disabled=idx===0;q(root,'[data-next]').disabled=idx===data.steps.length-1;
    }
    qa(flow,'.guide-flow-node').forEach(n=>n.addEventListener('click',()=>{idx=+n.dataset.step;stop();render()}));
    qa(acc,'.guide-acc-btn').forEach(b=>b.addEventListener('click',()=>{const p=b.nextElementSibling,open=b.getAttribute('aria-expanded')==='true';b.setAttribute('aria-expanded',String(!open));p.style.maxHeight=open?'0px':p.scrollHeight+'px'}));
    const openPanel=()=>{panel.classList.add('open');requestAnimationFrame(()=>panel.style.maxHeight=panel.scrollHeight+'px')};
    const closePanel=()=>{panel.style.maxHeight='0px';panel.classList.remove('open');stop()};
    toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')==='true';toggle.setAttribute('aria-expanded',String(!open));open?closePanel():openPanel()});
    q(root,'[data-prev]').addEventListener('click',()=>{idx=Math.max(0,idx-1);stop();render()});
    q(root,'[data-next]').addEventListener('click',()=>{idx=Math.min(data.steps.length-1,idx+1);stop();render()});
    function stop(){if(timer){clearInterval(timer);timer=null;q(root,'[data-play]').innerHTML='<i class="fa-solid fa-play"></i> 自動再生'}}
    q(root,'[data-play]').addEventListener('click',()=>{if(timer){stop();return}q(root,'[data-play]').innerHTML='<i class="fa-solid fa-pause"></i> 停止';timer=setInterval(()=>{idx=(idx+1)%data.steps.length;render();panel.style.maxHeight=panel.scrollHeight+'px'},2200)});
    render();
  }
  window.addEventListener('DOMContentLoaded',()=>document.querySelectorAll('[data-code-guide-root]').forEach(initGuide));
})();
