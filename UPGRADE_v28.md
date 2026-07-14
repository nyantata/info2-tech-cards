# v28 画像アップロード導入手順

## GitHub Pages

次のファイルを上書きします。

- submission.html
- history.html
- setup.html
- assets/submission.js
- assets/site.css
- README.txt

`assets/gas-config.js`は学校固有の設定が入っているため、上書き・削除しません。

## Google Apps Script

次のファイルをv28版へ置き換えます。

- gas/Code.gs
- gas/appsscript.json

保存後、次の順に再デプロイします。

1. 「デプロイ」
2. 「デプロイを管理」
3. 既存デプロイの鉛筆アイコン
4. 「新バージョン」
5. 「デプロイ」
6. Google Driveへのアクセス権限を許可

既存のウェブアプリURLは通常そのまま利用します。

## 初回の画像提出

`IMAGE_FOLDER_ID`を設定していない場合、先生のGoogle Driveへ「情報II_活動ログ画像」フォルダを自動作成し、フォルダIDをスクリプトプロパティへ保存します。

スプレッドシートには以下が自動追加されます。

- 「提出ログ」シートの画像管理列
- 「添付画像」シート

## 確認

1. 学校アカウントでログイン
2. 画像を1枚選択
3. プレビューを確認
4. 確認画面から提出
5. スプレッドシートとDriveを確認
6. 自分のログから画像を開く
7. 同じ内容を再送し、重複登録されないことを確認
