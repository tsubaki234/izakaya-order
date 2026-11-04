# myonga v2.0.0 表示修正パッチ

## 変更内容
- ロゴの `g` を独自SVGで8のように描く処理を廃止し、通常の小文字 `g` を使う `myonga` 表記に戻しました。
- スタッフ画面の「番号札QRを印刷」リンクを削除しました。
- QRコード印刷ページと、こちらで作成していた卓番QR画像は削除対象です。QRのデザイン・印刷レイアウトは主催者側で決めてください。

## 適用方法
1. このZIPを既存プロジェクトのルート `C:\Users\inaba\izakaya-order` に展開し、`app/page.tsx` と `app/admin/page.tsx` を上書きします。
2. PowerShellでプロジェクトルートに移動し、次を実行します。

```powershell
.\remove-old-qr.ps1
```

3. ローカル確認:

```powershell
npx.cmd tsc --noEmit
npx.cmd eslint app lib
npm.cmd run build
```

## QRコードを主催者側で作る方法

卓番号ごとに、次のURLをQRコード化してください。`N` を卓番号の `1`〜`20` に置き換えます。

```text
https://izakaya-order-pearl.vercel.app/?table=N
```

例:
- 卓番1: `https://izakaya-order-pearl.vercel.app/?table=1`
- 卓番2: `https://izakaya-order-pearl.vercel.app/?table=2`
- 卓番20: `https://izakaya-order-pearl.vercel.app/?table=20`

QRコード生成サイトやデザイン、用紙への配置は主催者側で選択してください。ロゴや色を含むデザイン指定はこのパッチでは行いません。印刷後は各QRを実機で読み取り、卓番が正しく入ることを確認してください。
