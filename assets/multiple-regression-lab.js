(function(){
  const $ = (id)=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function mean(a){return a.reduce((s,x)=>s+x,0)/a.length}
  function variance(a){const m=mean(a);return a.reduce((s,x)=>s+(x-m)**2,0)/a.length}
  function stdev(a){return Math.sqrt(variance(a))||1}
  function seeded(seed){let s=seed>>>0;return ()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296}}
  function normal(rng){const u=Math.max(rng(),1e-12),v=Math.max(rng(),1e-12);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
  function transpose(A){return A[0].map((_,j)=>A.map(r=>r[j]))}
  function matMul(A,B){return A.map(r=>B[0].map((_,j)=>r.reduce((s,x,k)=>s+x*B[k][j],0)))}
  function inverse(A){
    const n=A.length,M=A.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)]);
    for(let i=0;i<n;i++){
      let p=i; for(let r=i+1;r<n;r++) if(Math.abs(M[r][i])>Math.abs(M[p][i])) p=r;
      if(Math.abs(M[p][i])<1e-10) throw new Error('行列がほぼ特異です');
      [M[i],M[p]]=[M[p],M[i]];
      const d=M[i][i]; for(let j=0;j<2*n;j++) M[i][j]/=d;
      for(let r=0;r<n;r++) if(r!==i){const f=M[r][i];for(let j=0;j<2*n;j++)M[r][j]-=f*M[i][j]}
    }
    return M.map(r=>r.slice(n));
  }
  function fitOLS(X,y){
    const X1=X.map(r=>[1,...r]);
    const Xt=transpose(X1), XtX=matMul(Xt,X1), Xty=matMul(Xt,y.map(v=>[v]));
    const beta=matMul(inverse(XtX),Xty).map(r=>r[0]);
    return {beta,predict:(rows)=>rows.map(r=>beta[0]+r.reduce((s,x,i)=>s+x*beta[i+1],0))};
  }
  function r2(y,p){const m=mean(y),ssr=y.reduce((s,v,i)=>s+(v-p[i])**2,0),sst=y.reduce((s,v)=>s+(v-m)**2,0);return 1-ssr/(sst||1)}
  function rmse(y,p){return Math.sqrt(mean(y.map((v,i)=>(v-p[i])**2)))}
  function standardizeTrainTest(train,test){
    const cols=train[0].length, mus=[],sds=[];
    for(let j=0;j<cols;j++){const c=train.map(r=>r[j]);mus[j]=mean(c);sds[j]=stdev(c)}
    const z=(rows)=>rows.map(r=>r.map((v,j)=>(v-mus[j])/sds[j]));
    return {train:z(train),test:z(test),mus,sds};
  }
  function makeChart(id,type,data,options={}){
    if(window.__mrCharts?.[id]) window.__mrCharts[id].destroy();
    window.__mrCharts=window.__mrCharts||{};
    window.__mrCharts[id]=new Chart($(id),{type,data,options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},...options}})
  }
  function renderEquationBuilder(){
    const count=+$('mr-var-count').value;
    $('mr-var-count-label').textContent=count;
    const defaults=[{x:5,b:.8},{x:4,b:-.3},{x:6,b:.5},{x:3,b:0},{x:7,b:.2}];
    const existing=[...document.querySelectorAll('.mr-var-row')].map(row=>({x:+row.querySelector('.mr-x').value,b:+row.querySelector('.mr-b').value}));
    const vals=Array.from({length:count},(_,i)=>existing[i]||defaults[i]);
    $('mr-variable-controls').innerHTML=vals.map((v,i)=>`<div class="mr-var-row rounded-3xl bg-white border border-slate-200 p-4"><div class="flex items-center justify-between gap-3"><b>X${i+1}</b><span class="text-sm text-slate-500">加算分 <span class="mr-contrib font-black text-violet-600"></span></span></div><label class="block mt-3 text-sm font-bold">入力値 <span class="mr-x-label"></span><input class="mr-x range" type="range" min="0" max="10" step="0.1" value="${v.x}"></label><label class="block mt-3 text-sm font-bold">係数 <span class="mr-b-label"></span><input class="mr-b range" type="range" min="-2" max="2" step="0.05" value="${v.b}"></label></div>`).join('');
    [...document.querySelectorAll('.mr-x,.mr-b')].forEach(el=>el.addEventListener('input',updateEquation));
    updateEquation();
  }
  function updateEquation(){
    const intercept=+$('mr-intercept').value;$('mr-intercept-label').textContent=intercept.toFixed(1);
    const rows=[...document.querySelectorAll('.mr-var-row')];
    const labels=[],contribs=[],terms=[];
    rows.forEach((r,i)=>{const x=+r.querySelector('.mr-x').value,b=+r.querySelector('.mr-b').value,c=x*b;r.querySelector('.mr-x-label').textContent=x.toFixed(1);r.querySelector('.mr-b-label').textContent=b.toFixed(2);r.querySelector('.mr-contrib').textContent=c.toFixed(2);labels.push(`X${i+1}`);contribs.push(c);terms.push(`${b<0?'−':'+'} ${Math.abs(b).toFixed(2)}×X${i+1}`)});
    const pred=intercept+contribs.reduce((s,x)=>s+x,0);
    $('mr-equation').textContent=`ŷ = ${intercept.toFixed(1)} ${terms.join(' ')}`;
    $('mr-prediction').textContent=pred.toFixed(2);
    const strongest=contribs.map((v,i)=>({v:Math.abs(v),i})).sort((a,b)=>b.v-a.v)[0];
    $('mr-equation-comment').textContent=strongest?`現在の入力では、X${strongest.i+1} の「係数×入力値」の絶対値が最も大きくなっています。係数の符号を変えると、予測値を増やす方向か減らす方向かが変わります。`:'変数を追加してください。';
    makeChart('mr-contrib-chart','bar',{labels:[...labels,'切片'],datasets:[{label:'予測式で加算される値（係数×入力値）',data:[...contribs,intercept],borderRadius:10,backgroundColor:[...labels.map((_,i)=>['#38bdf8','#f59e0b','#fb7185','#10b981','#8b5cf6'][i]),'#0f172a']}]},{scales:{y:{grid:{color:'#e2e8f0'}}}})
  }
  function complexityData(k){
    const rng=seeded(42),n=36,X=[],y=[];
    for(let i=0;i<n;i++){const row=Array.from({length:5},()=>normal(rng));X.push(row);y.push(3+1.8*row[0]+normal(rng)*1.6)}
    const idx=Array.from({length:n},(_,i)=>i);for(let i=n-1;i>0;i--){const j=Math.floor(rng()*(i+1));[idx[i],idx[j]]=[idx[j],idx[i]]}
    const tr=idx.slice(0,24),te=idx.slice(24),Xtr=tr.map(i=>X[i].slice(0,k)),Xte=te.map(i=>X[i].slice(0,k)),ytr=tr.map(i=>y[i]),yte=te.map(i=>y[i]);
    const z=standardizeTrainTest(Xtr,Xte),model=fitOLS(z.train,ytr),ptr=model.predict(z.train),pte=model.predict(z.test);
    return {trainR2:r2(ytr,ptr),testR2:r2(yte,pte),rmse:rmse(yte,pte),actual:yte,pred:pte,beta:model.beta};
  }
  function updateComplexity(){
    const k=+$('mr-complexity-count').value;$('mr-complexity-count-label').textContent=k;
    const m=complexityData(k);
    $('mr-train-r2').textContent=m.trainR2.toFixed(3);$('mr-test-r2').textContent=m.testR2.toFixed(3);$('mr-test-rmse').textContent=m.rmse.toFixed(3);
    $('mr-complexity-message').textContent=k===1?'この教材用データは、目的変数を作るときにX1だけを使っています。':'追加したX2〜X5は、目的変数を作るときに使っていないランダムな変数です。訓練データR²は上がる場合がありますが、テストデータR²やテストデータRMSEが改善するとは限りません。';
    makeChart('mr-complexity-chart','scatter',{datasets:[{label:'テストデータ',data:m.actual.map((a,i)=>({x:a,y:m.pred[i]})),pointRadius:6,backgroundColor:'#8b5cf6'},{label:'理想線',type:'line',data:[{x:Math.min(...m.actual),y:Math.min(...m.actual)},{x:Math.max(...m.actual),y:Math.max(...m.actual)}],pointRadius:0,borderColor:'#0f172a',borderDash:[6,6]}]},{scales:{x:{title:{display:true,text:'実測値'}},y:{title:{display:true,text:'予測値'}}}})
  }
  function collinearityTrial(rho,seed){
    const rng=seeded(seed),X=[],y=[];
    for(let i=0;i<40;i++){const x1=normal(rng),e=normal(rng),x2=rho*x1+Math.sqrt(Math.max(0,1-rho*rho))*e;X.push([x1,x2]);y.push(2+1.2*x1+1.2*x2+normal(rng)*.8)}
    return fitOLS(X,y).beta.slice(1)
  }
  function updateCollinearity(){
    const rho=+$('mr-rho').value;$('mr-rho-label').textContent=rho.toFixed(2);
    const b1=[],b2=[];for(let s=1;s<=18;s++){const b=collinearityTrial(rho,100+s);b1.push(b[0]);b2.push(b[1])}
    const sd1=stdev(b1),sd2=stdev(b2);$('mr-b1-sd').textContent=sd1.toFixed(3);$('mr-b2-sd').textContent=sd2.toFixed(3);
    $('mr-collinearity-message').textContent=rho>.85?'説明変数が非常によく似ています。合計としての予測はできても、個々の係数の解釈は不安定になりやすい状態です。':rho>.55?'相関が強まり、係数のばらつきが増え始めています。':'説明変数の重なりは比較的小さい状態です。';
    makeChart('mr-collinearity-chart','line',{labels:Array.from({length:18},(_,i)=>`試行${i+1}`),datasets:[{label:'係数1',data:b1,borderColor:'#38bdf8',backgroundColor:'#38bdf8',tension:.25},{label:'係数2',data:b2,borderColor:'#f59e0b',backgroundColor:'#f59e0b',tension:.25}]},{scales:{y:{title:{display:true,text:'推定係数'}}}})
  }
  function initTabs(){document.querySelectorAll('[data-mr-tab]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-mr-tab]').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.querySelectorAll('.mr-tab-panel').forEach(p=>p.hidden=true);$(btn.dataset.mrTab).hidden=false;setTimeout(()=>window.dispatchEvent(new Event('resize')),50)}))}
  window.initMultipleRegressionLab=function(){
    initTabs();
    $('mr-var-count').addEventListener('input',renderEquationBuilder);$('mr-intercept').addEventListener('input',updateEquation);renderEquationBuilder();
    $('mr-complexity-count').addEventListener('input',updateComplexity);updateComplexity();
    $('mr-rho').addEventListener('input',updateCollinearity);updateCollinearity();
  }
  window.__MR_UTILS={fitOLS,r2,rmse,standardizeTrainTest,mean,stdev,seeded};
})();
