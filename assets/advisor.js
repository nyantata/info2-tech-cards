const Q=[
 {id:'goal',title:'まず、何をしたいですか？',sub:'技術名ではなく、最終的に実現したいことを選びます。',multi:false,options:[
  ['measure','現実の状態をセンサで測りたい','fa-microchip'],['explore','データの特徴や傾向を知りたい','fa-chart-column'],['predict','数値を予測したい','fa-arrow-trend-up'],['classify','種類や状態を分類したい','fa-tags'],['group','似たもの同士をグループ分けしたい','fa-object-group'],['survey','アンケートから傾向を見つけたい','fa-list-check'],['system','使いやすい仕組みや画面を作りたい','fa-screwdriver-wrench'],['present','結果を検証して発表したい','fa-person-chalkboard']]},
 {id:'source',title:'どのデータを使いますか？',sub:'もっとも中心になるデータを1つ選びます。',multi:false,options:[
  ['sensor','センサで自分たちが測る','fa-satellite-dish'],['survey','アンケートで集める','fa-list-check'],['official','公式統計・オープンデータを使う','fa-landmark'],['existing','手元にある表やCSVを使う','fa-file-csv'],['unknown','まだ決めていない','fa-circle-question']]},
 {id:'output',title:'最終的に何を出したいですか？',sub:'成果物の中心に近いものを選びます。',multi:false,options:[
  ['graph','グラフと説明','fa-chart-simple'],['number','数値の予測','fa-calculator'],['label','分類結果','fa-tags'],['clusters','似たデータのグループ','fa-object-group'],['factors','アンケート項目の背後にある特徴','fa-circle-nodes'],['prototype','動く試作品・画面','fa-laptop-code'],['story','根拠のある発表','fa-person-chalkboard']]},
 {id:'structure',title:'データの形はどれに近いですか？',sub:'分からない場合は「まだ分からない」で大丈夫です。',multi:false,options:[
  ['one','1つの数値Xと1つの数値Y','fa-arrow-trend-up'],['many','複数の入力Xと1つの数値Y','fa-chart-line'],['labeled','正解ラベル付きのデータ','fa-tags'],['unlabeled','正解ラベルのないデータ','fa-circle-nodes'],['items','複数のアンケート項目','fa-list-check'],['unknown','まだ分からない','fa-circle-question']]},
 {id:'support',title:'今、特に必要な支援はどれですか？',sub:'まず優先したいものを1つ選びます。ほかのカードは結果画面から追加できます。',multi:false,options:[
  ['basic','基礎から順に学びたい','fa-stairs'],['code','Pythonコードを動かしたい','fa-code'],['design','UIや仕組みも作りたい','fa-pen-ruler'],['ai','生成AIを補助に使いたい','fa-wand-magic-sparkles'],['evaluation','評価方法をしっかり確認したい','fa-shield-halved'],['presentation','最後に発表したい','fa-person-chalkboard']]}
];
let step=0,answers={};
const el=id=>document.getElementById(id);
function card(k){return INFO2_CARDS.find(c=>c.key===k)}
function renderQ(){
 const q=Q[step],saved=answers[q.id]||null;
 el('advisor-step').textContent=`${step+1} / ${Q.length}`;
 el('advisor-bar').style.width=`${(step+1)/Q.length*100}%`;
 el('advisor-question').innerHTML=`<div class="advisor-question"><p class="section-kicker">QUESTION ${step+1}</p><h3 class="mt-2 text-3xl md:text-4xl font-black">${q.title}</h3><p class="mt-3 text-slate-600 leading-7">${q.sub}</p><div class="mt-6 grid md:grid-cols-2 gap-3">${q.options.map(o=>{const on=saved===o[0];return `<button type="button" class="choice-card ${on?'selected':''}" data-value="${o[0]}" aria-pressed="${on}"><span class="choice-icon"><i class="fa-solid ${o[2]}"></i></span><span>${o[1]}</span></button>`}).join('')}</div></div>`;
 el('advisor-prev').disabled=step===0;
 el('advisor-next').disabled=!saved;
 el('advisor-next').innerHTML=step===Q.length-1
  ? '<i class="fa-solid fa-route mr-2"></i>結果を見る'
  : '次の質問へ<i class="fa-solid fa-arrow-right ml-2"></i>';
 el('advisor-alert').textContent=saved?'選択内容を確認し、「次の質問へ」を押してください。':'';
 el('advisor-question').querySelectorAll('[data-value]').forEach(b=>b.addEventListener('click',()=>selectChoice(q,b)));
}
function selectChoice(q,button){
 const v=button.dataset.value; answers[q.id]=v;
 const buttons=[...el('advisor-question').querySelectorAll('[data-value]')];
 buttons.forEach(b=>{
  const selected=b===button;
  b.classList.toggle('selected',selected);
  b.setAttribute('aria-pressed',selected?'true':'false');
 });
 el('advisor-next').disabled=false;
 el('advisor-alert').className='mt-4 text-emerald-700 font-black';
 el('advisor-alert').innerHTML='<i class="fa-solid fa-circle-check mr-2"></i>選択しました。内容を確認してから次へ進んでください。';
}
function recommend(){
 let req=[],support=[],reason={}; const add=(arr,k,r)=>{if(!arr.includes(k)){arr.push(k);reason[k]=r}};
 const g=answers.goal,s=answers.source,o=answers.output,st=answers.structure,sp=answers.support;
 if(g==='measure'||s==='sensor'){add(req,'product-analysis','測る対象・入力・処理・出力を整理する');add(req,'iot','センサで観測値を取得し、記録方法を設計する');add(req,'visualization','時系列や分布を可視化してデータの特徴を確認する')}
 if(g==='explore'||o==='graph')add(req,'visualization','データの分布・時間変化・関係を最初に確認する');
 if(g==='predict'||o==='number'||st==='one'||st==='many'){add(req,'visualization','モデル作成前に散布図や分布を確認する');add(req,'regression','目的変数・説明変数・回帰係数の基礎を学ぶ');if(st==='many')add(req,'multiple-regression','複数の説明変数を使うモデルを作る')}
 if(g==='classify'||o==='label'||st==='labeled'){add(req,'visualization','特徴量とクラスの分布を確認する');add(req,'knn','距離にもとづく分類の基本を試す');add(support,'decision-tree','条件分岐が見える分類方法と比較する')}
 if(g==='group'||o==='clusters'||st==='unlabeled'){add(req,'visualization','グループ分け前に特徴量の分布を確認する');add(req,'kmeans','正解ラベルなしで似たデータを分ける')}
 if(g==='survey'||s==='survey'||st==='items'||o==='factors'){add(req,'survey','質問文・尺度・対象・偏りを設計する');add(req,'visualization','回答分布と項目間の関係を確認する');if(st==='items'||o==='factors')add(req,'factor','複数項目の背後にある共通因子を検討する')}
 if(g==='system'||o==='prototype'||sp==='design'){add(req,'product-analysis','利用者・目的・データの流れを整理する');add(req,'uiux','利用者の操作とフィードバックを試作する')}
 if(s==='official')add(support,'visualization','公式データの単位・年次・分布を確認する');
 if(sp==='ai')add(support,'ai','コード・説明・発想の補助として、検証方法とセットで使う');
 if(sp==='code'&&!req.some(k=>['regression','multiple-regression','kmeans','knn','decision-tree','factor','iot'].includes(k)))add(support,'visualization','PythonでCSVを読み、グラフを作る入口にする');
 const analytic=req.some(k=>['visualization','regression','multiple-regression','kmeans','knn','decision-tree','factor','survey','iot'].includes(k));
 if(analytic||sp==='evaluation'||g==='present')add(req,'verification','データ・方法・評価指標・解釈を分けて確かめる');
 add(req,'devlog','選んだ理由、作業内容、判断、次にすることを残す');
 if(sp==='presentation'||g==='present'||o==='story')add(req,'pitch','問題・根拠・提案・限界を短く伝える');else add(support,'pitch','成果を共有するときの構成に使う');
 if(sp==='basic'){const order=['product-analysis','iot','survey','visualization','regression','multiple-regression','kmeans','knn','decision-tree','factor','uiux','ai','verification','devlog','pitch'];req.sort((a,b)=>order.indexOf(a)-order.indexOf(b));support.sort((a,b)=>order.indexOf(a)-order.indexOf(b))}
 support=support.filter(k=>!req.includes(k)); return{req,support,reason};
}
function showResult(){
 const r=recommend(); el('advisor-form').classList.add('hidden');el('advisor-result').classList.remove('hidden');
 const make=(k,i,type)=>{const c=card(k);return `<article class="result-card ${type}"><span class="result-order">${i+1}</span><div><div class="flex items-center gap-2"><i class="fa-solid ${c.icon}" style="color:${c.color}"></i><h4 class="font-black text-lg">${c.title}</h4></div><p class="text-sm leading-7 text-slate-600 mt-1">${r.reason[k]||c.desc}</p></div><a class="btn-light" href="${c.href}">開く</a></article>`};
 el('required-list').innerHTML=r.req.map((k,i)=>make(k,i,'required')).join('');
 el('support-list').innerHTML=r.support.map((k,i)=>make(k,i,'support')).join('')||'<p class="text-slate-500">追加でおすすめするカードはありません。</p>';
 localStorage.setItem('info2_advisor_result',JSON.stringify({answers,required:r.req,support:r.support,createdAt:new Date().toISOString()}));
 el('use-submission').onclick=()=>location.href='submission.html?from=advisor';
}
function reset(){answers={};step=0;el('advisor-result').classList.add('hidden');el('advisor-form').classList.remove('hidden');renderQ()}
document.addEventListener('DOMContentLoaded',()=>{
 renderQ();
 el('advisor-prev').addEventListener('click',()=>{if(step>0){step--;renderQ()}});
 el('advisor-next').addEventListener('click',()=>{
  const q=Q[step];
  if(!answers[q.id]){
   el('advisor-alert').className='mt-4 text-rose-600 font-bold';
   el('advisor-alert').textContent='選択肢を1つ選んでください。';
   return;
  }
  if(step<Q.length-1){step++;renderQ()}else{showResult()}
 });
 el('advisor-reset').addEventListener('click',reset);
});
