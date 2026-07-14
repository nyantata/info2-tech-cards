# v27 検証記録

## 修正内容
- 記録日の入力欄をクリックするとカレンダーが開くように修正
- カレンダーアイコンからも同じカレンダーを開けるように修正
- ブラウザ標準の日付入力を画面外に置く方式を廃止
- yyyy/MM/dd 表示、未来日禁止、今日ボタン、手入力の正規化を維持
- 年・月の選択、前月・次月移動、画面外クリック・Escで閉じる操作を追加

## 更新対象
- submission.html
- assets/submission.js
- assets/site.css

## Google連携
- Apps Script側の変更なし
- assets/gas-config.jsは上書きしない
