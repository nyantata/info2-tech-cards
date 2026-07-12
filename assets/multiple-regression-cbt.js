(function(){
  const $=id=>document.getElementById(id),U=()=>window.__MR_UTILS;
  const predictors={aging_rate_pct:'高齢化率',population_density_per_km2:'人口密度',income_per_capita_thousand_yen:'1人当たり県民所得',recycle_rate_pct:'ごみのリサイクル率',prefecture:'都道府県名（識別用の文字列）',waste_g_per_person_day:'1人1日当たりのごみ排出量（目的変数）'};
  let state={step:0,answers:{},practice:null,started:false};
  const storage={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  const questions=[
    {type:'choice',id:'k1',title:'目的変数と説明変数',q:'「1人1日当たりのごみ排出量」を、高齢化率・人口密度・1人当たり県民所得から予測するとき、目的変数はどれですか。',opts:['高齢化率','人口密度','1人当たり県民所得','1人1日当たりのごみ排出量'],ans:3,exp:'目的変数は、説明したい・予測したい値です。ここでは「1人1日当たりのごみ排出量」が目的変数です。'},
    {type:'choice',id:'k2',title:'回帰係数の読み方',q:'重回帰モデルで人口密度の係数が正だったとき、最も適切な説明はどれですか。',opts:['人口密度が必ずごみ排出量の原因である','ほかの説明変数を一定としたとき、人口密度が大きいほど予測値が大きくなる関係を表す','人口密度が最も重要な変数である','人口密度と目的変数の単純相関係数が必ず正である'],ans:1,exp:'回帰係数は「ほかの説明変数を一定としたとき」の予測値の変化を表します。因果関係や変数の重要度を自動的に意味しません。'},
    {type:'choice',id:'k3',title:'残差',q:'観測値が950、予測値が920のとき、残差 y−ŷ はいくつですか。',opts:['30','-30','920','1870'],ans:0,exp:'残差は観測値−予測値なので、950−920=30です。'},
    {type:'choice',id:'k4',title:'モデル評価',q:'訓練データR²は高いのに、テストデータRMSEが大きい場合にまず考えることはどれですか。',opts:['必ずデータ入力ミスである','説明変数が少なすぎる','訓練データに合わせすぎて、モデル作成に使っていないデータでは予測誤差が大きくなっている可能性','R²は回帰分析では使えない'],ans:2,exp:'訓練データへの当てはまりだけでなく、モデル作成に使っていないテストデータでの予測誤差を確認します。'},
    {type:'practice',id:'p1',title:'実技1：目的変数と説明変数を決める'},
    {type:'practice',id:'p2',title:'実技2：モデルを比較する'},
    {type:'practice',id:'p3',title:'実技3：Pythonコードを完成する'},
    {type:'practice',id:'p4',title:'実技4：結果を解釈する'}
  ];
  function splitData(rows){const rng=U().seeded(42),idx=rows.map((_,i)=>i);for(let i=idx.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}return {train:idx.slice(0,35).map(i=>rows[i]),test:idx.slice(35).map(i=>rows[i])}}
  function crossValidate(keys){
    const rows=SSDSE_MULTI_DATA,rng=U().seeded(42),idx=rows.map((_,i)=>i);
    for(let i=idx.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}
    const folds=5,rmseList=[],r2List=[];
    for(let f=0;f<folds;f++){
      const testIdx=idx.filter((_,i)=>i%folds===f),trainIdx=idx.filter((_,i)=>i%folds!==f);
      const xt=trainIdx.map(i=>keys.map(k=>+rows[i][k])),xe=testIdx.map(i=>keys.map(k=>+rows[i][k]));
      const yt=trainIdx.map(i=>+rows[i].waste_g_per_person_day),ye=testIdx.map(i=>+rows[i].waste_g_per_person_day);
      const z=U().standardizeTrainTest(xt,xe),m=U().fitOLS(z.train,yt),pe=m.predict(z.test);
      rmseList.push(U().rmse(ye,pe));r2List.push(U().r2(ye,pe));
    }
    return{cvRmse:U().mean(rmseList),cvR2:U().mean(r2List),rmseList,r2List};
  }
  function choiceHtml(q){return `<div class="space-y-3">${q.opts.map((o,i)=>`<label class="quiz-option"><input type="radio" name="${q.id}" value="${i}" ${state.answers[q.id]===i?'checked':''}><span>${o}</span></label>`).join('')}</div>`}
  function practiceHtml(id){
    if(id==='p1')return `<div class="rounded-3xl bg-slate-50 border p-5"><p class="font-bold leading-8">SSDSE-E-2026から、目的変数を「1人1日当たりのごみ排出量」として重回帰分析します。説明変数の候補として扱える数値項目をすべて選んでください。</p><div class="grid sm:grid-cols-2 gap-3 mt-5">${Object.entries(predictors).map(([k,n])=>`<label class="quiz-option"><input type="checkbox" class="p1pred" value="${k}" ${(state.answers.p1||[]).includes(k)?'checked':''}><span>${n}</span></label>`).join('')}</div><div class="mt-5 rounded-2xl bg-white border p-4 text-sm leading-7"><b>データの年次：</b>人口・面積 2024、県民所得 2021、ごみ関連 2023。異なる年次を含むため、結果の解釈ではその点を明記します。</div></div>`;
    if(id==='p2')return `<div class="space-y-5"><p class="font-bold leading-8">次の2モデルをブラウザ上で5分割交差検証し、平均RMSEが小さい方を選んでください。</p><button id="run-model-compare" class="btn">公式データで比較を実行</button><div id="model-compare-result" class="grid md:grid-cols-2 gap-4"></div><div class="space-y-3"><label class="quiz-option"><input type="radio" name="p2" value="A" ${state.answers.p2==='A'?'checked':''}><span>モデルA：所得・リサイクル率・高齢化率</span></label><label class="quiz-option"><input type="radio" name="p2" value="B" ${state.answers.p2==='B'?'checked':''}><span>モデルB：モデルA＋人口密度</span></label></div></div>`;
    if(id==='p3')return `<div class="space-y-5"><p class="font-bold">空欄を選び、テストデータで予測するコードを完成してください。</p><pre class="cbt-code">X_train, X_test, y_train, y_test = <select id="code1"><option value="">選択</option><option value="split">train_test_split(X, y, test_size=0.25, random_state=42)</option><option value="fit">model.fit(X, y)</option></select>
model = LinearRegression()
<select id="code2"><option value="">選択</option><option value="fit">model.fit(X_train, y_train)</option><option value="predict">model.predict(X_train)</option></select>
y_pred = <select id="code3"><option value="">選択</option><option value="test">model.predict(X_test)</option><option value="train">model.predict(X_train)</option></select></pre></div>`;
    return `<div class="space-y-5"><p class="font-bold leading-8">公式データの5分割交差検証で、モデルAの平均RMSEはモデルBより小さくなりました。最も適切な解釈を選んでください。</p><div class="space-y-3"><label class="quiz-option"><input type="radio" name="p4" value="0" ${state.answers.p4===0?'checked':''}><span>説明変数を増やしたモデルBの方が必ず正しい</span></label><label class="quiz-option"><input type="radio" name="p4" value="1" ${state.answers.p4===1?'checked':''}><span>今回の交差検証ではモデルBの予測誤差が大きい。人口密度の追加を見直す必要がある</span></label><label class="quiz-option"><input type="radio" name="p4" value="2" ${state.answers.p4===2?'checked':''}><span>R²が負なのでデータは利用できない</span></label></div></div>`
  }
  function render(){
    const q=questions[state.step];$('cbt-progress').style.width=`${(state.step/questions.length)*100}%`;$('cbt-counter').textContent=`${state.step+1} / ${questions.length}`;$('cbt-title').textContent=q.title;$('cbt-question').textContent=q.q||'';$('cbt-body').innerHTML=q.type==='choice'?choiceHtml(q):practiceHtml(q.id);$('cbt-prev').disabled=state.step===0;$('cbt-next').textContent=state.step===questions.length-1?'採点する':'次へ';bindCurrent(q)
  }
  function bindCurrent(q){
    if(q.type==='choice')document.querySelectorAll(`input[name="${q.id}"]`).forEach(el=>el.addEventListener('change',()=>state.answers[q.id]=+el.value));
    if(q.id==='p1')document.querySelectorAll('.p1pred').forEach(el=>el.addEventListener('change',()=>state.answers.p1=[...document.querySelectorAll('.p1pred:checked')].map(x=>x.value)));
    if(q.id==='p2'){
      document.querySelectorAll('input[name="p2"]').forEach(el=>el.addEventListener('change',()=>state.answers.p2=el.value));
      $('run-model-compare').addEventListener('click',()=>{const A=crossValidate(['income_per_capita_thousand_yen','recycle_rate_pct','aging_rate_pct']),B=crossValidate(['income_per_capita_thousand_yen','recycle_rate_pct','aging_rate_pct','population_density_per_km2']);state.practice={A,B};$('model-compare-result').innerHTML=[['A',A],['B',B]].map(([n,m])=>`<div class="rounded-3xl bg-white border p-5"><b>モデル${n}</b><p class="mt-3">5分割交差検証におけるR²の平均：${m.cvR2.toFixed(3)}</p><p class="text-xl font-black text-violet-600">5分割交差検証におけるRMSEの平均：${m.cvRmse.toFixed(1)}</p></div>`).join('')})
    }
    if(q.id==='p3'){const saved=state.answers.p3||{};['code1','code2','code3'].forEach(id=>{if(saved[id])$(id).value=saved[id];$(id).addEventListener('change',()=>state.answers.p3={code1:$('code1').value,code2:$('code2').value,code3:$('code3').value})})}
    if(q.id==='p4')document.querySelectorAll('input[name="p4"]').forEach(el=>el.addEventListener('change',()=>state.answers.p4=+el.value));
  }
  function score(){let knowledge=0,practical=0,details=[];for(const q of questions.slice(0,4)){const ok=state.answers[q.id]===q.ans;if(ok)knowledge+=10;details.push({name:q.title,ok,exp:q.exp})}
    const p1=(state.answers.p1||[]),correctP1=['aging_rate_pct','population_density_per_km2','income_per_capita_thousand_yen','recycle_rate_pct'],p1ok=p1.length===4&&correctP1.every(x=>p1.includes(x));if(p1ok)practical+=15;details.push({name:'実技1',ok:p1ok,exp:'目的変数と識別用の文字列を除き、数値として分析に使う説明変数の候補を区別します。実際にモデルへ入れるかどうかは、目的・理論的根拠・評価結果を踏まえて判断します。'});
    const p2ok=state.answers.p2==='A';if(p2ok)practical+=15;details.push({name:'実技2',ok:p2ok,exp:'5分割交差検証の平均RMSEはモデルAの方が小さく、モデルBよりモデル作成に使っていないデータに対する予測誤差が小さい結果です。'});
    const p3=state.answers.p3||{},p3ok=p3.code1==='split'&&p3.code2==='fit'&&p3.code3==='test';if(p3ok)practical+=15;details.push({name:'実技3',ok:p3ok,exp:'データ分割→訓練データでfit→テストデータでpredictの順です。'});
    const p4ok=state.answers.p4===1;if(p4ok)practical+=15;details.push({name:'実技4',ok:p4ok,exp:'説明変数の追加は必ずしもテストデータに対する評価結果を改善しません。結果を比較し、変数選択を見直します。'});
    const total=knowledge+practical;showResult(total,knowledge,practical,details)
  }
  function showResult(total,k,p,details){$('cbt-panel').hidden=true;$('cbt-result').hidden=false;$('cbt-score').textContent=`${total} / 100`;$('cbt-judge').textContent=total>=70?'到達：基礎理解と実技の両方を確認できました':'再挑戦：解説を確認し、もう一度データ処理を試しましょう';$('cbt-breakdown').innerHTML=`<div class="rounded-3xl bg-sky-50 p-5"><b>知識</b><p class="text-3xl font-black mt-2">${k}/40</p></div><div class="rounded-3xl bg-violet-50 p-5"><b>実技</b><p class="text-3xl font-black mt-2">${p}/60</p></div>`;$('cbt-details').innerHTML=details.map(d=>`<div class="rounded-2xl border p-4 ${d.ok?'bg-emerald-50 border-emerald-200':'bg-rose-50 border-rose-200'}"><b>${d.ok?'○':'×'} ${d.name}</b><p class="mt-2 text-sm leading-7 text-slate-600">${d.exp}</p></div>`).join('');storage.set('mr-cbt-last-score',String(total))}
  window.initMultipleRegressionCBT=function(){
    $('cbt-start').addEventListener('click',()=>{$('cbt-intro').hidden=true;$('cbt-panel').hidden=false;state.started=true;render()});
    $('cbt-prev').addEventListener('click',()=>{if(state.step>0){state.step--;render()}});$('cbt-next').addEventListener('click',()=>{if(state.step<questions.length-1){state.step++;render()}else score()});$('cbt-retry').addEventListener('click',()=>{state={step:0,answers:{},practice:null,started:true};$('cbt-result').hidden=true;$('cbt-panel').hidden=false;render()});
    const last=storage.get('mr-cbt-last-score');if(last)$('cbt-last-score').textContent=`前回スコア：${last}/100`;
  }
})();
