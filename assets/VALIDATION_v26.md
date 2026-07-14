# v26 検証記録

- Googleログイン不可の直接原因を確認：`assets/gas-config.js` の `webAppUrl` と `googleClientId` が空欄になっていた。
- 更新用配布物から `assets/gas-config.js` を除外し、学校固有設定を上書きしない構成に変更。
- 設定例 `assets/gas-config.example.js` を追加。
- `history.js` と `submission.js` の警告文を、設定ファイルの上書き・削除を疑える内容に変更。
- `setup.html` と README に更新時の保持ルールを追記。
- Apps Script の再デプロイは不要。GitHub Pages 側の設定ファイル復元のみで復旧可能。
