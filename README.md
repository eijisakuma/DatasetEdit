# DataSet XML エディター (DatasetEdit)

C# 等の `DataSet.WriteXml` で出力された XML ファイルをブラウザ上で読み込み、直感的に表示・編集・保存（XMLダウンロード）できるシングルページ Web アプリケーションです。

---

## 主な特徴

- **完全ローカル動作**: Webサーバー不要で、`index.html` をブラウザで直接開くだけで安全に利用できます。外部サーバーへデータが送信されることはありません。
- **Excel出力（各シート1テーブル・ListObject形式）**:
  - DataSet全体の各テーブルを1つのExcelファイル（.xlsx）として一括エクスポート。
  - **各シート1テーブル** で作成され、Excelネイティブの **ListObject（構造化テーブル形式）** として出力（オートフィルター・縞模様スタイル適用）。
  - DataColumn の `Caption`（表示名）が列名として反映され、列幅も自動調整。
- **テーブル別 CSV エクスポート**:
  - 各テーブルを単体で CSV 形式でダウンロード。
  - 日本語環境の Excel で開いても文字化けしない **UTF-8 with BOM** 形式。
  - RFC 4180 準拠のエスケープ処理に対応。
- **DataColumn.Caption プロパティ対応**:
  - スキーマ内に `msdata:Caption`（日本語の論理名など）が定義されている場合、スプレッドシートの列名として自動表示。
  - XML保存時は元の物理カラム名（XML要素タグ名）のまま出力されるため、C# 側の `DataSet.ReadXml` との完全な整合性を維持。
  - 列ヘッダーにホバーすることで元の物理列名をツールチップで確認可能。
- **高機能スプレッドシート UI**:
  - セルのダブルクリックまたは Enter キーによる直接インライン編集
  - 列ヘッダーのクリックによるソート（昇順 / 降順）
  - 各列ごとのリアルタイム絞り込み検索ボックス
  - 行の追加、チェックボックスによる選択行の一括削除
  - 元に戻す（Undo） / やり直す（Redo）

---

## 画面構成

```
+-----------------------------------------------------------------------------------+
|  [ヘッダー] DataSet XML エディター   [サンプル読込]  [XML保存（ダウンロード）]      |
+-------------------+---------------------------------------------------------------+
|  [左ペイン]       |  [メインコンテンツ]                                             |
|                   |  選択中テーブル: Customers (5列 / 3行)                         |
|  [XMLファイル選択] |  [+ 行を追加] [- 選択行を削除] [元に戻す] [やり直す] [CSV出力]   |
|  (D&D対応エリア)  |  +----+--------------+---------------------+--------------+    |
|                   |  | No | 顧客コード   | 会社名              | 国           |    |
|  --- テーブル一覧 -|  +----+--------------+---------------------+--------------+    |
|  - Customers (3)  |  | 1  | ALFKI        | Alfreds Futterkiste | Germany      |    |
|  - Orders (3)     |  | 2  | ANATR        | Ana Trujillo Emp... | Mexico       |    |
|  - Products (3)   |  +----+--------------+---------------------+--------------+    |
+-------------------+---------------------------------------------------------------+
```

---

## ファイル構成

```
DatasetEdit/
├── index.html           # メイン画面HTML
├── style.css            # スタイルシート（レスポンシブ・モダンUI）
├── app.js               # XMLパース・編集・生成ロジック
├── sample_dataset.xml   # 動作確認用サンプルデータ（Customers, Orders, Products）
├── .gitignore           # Git 除外設定
└── README.md            # 本ドキュメント
```

---

## 使い方

1. `index.html` をお使いのWebブラウザ（Google Chrome, Microsoft Edge など）で開きます。
2. 左ペインのファイル選択エリアにお手元の XML ファイルをドラッグ＆ドロップ（またはファイルを選択）します。
   - ※画面右上の「サンプル読込」を押すことで、付属のサンプルデータですぐにお試しいただけます。
3. 左ペインに検出されたテーブル一覧が表示されるので、編集したいテーブルをクリックします。
4. メインコンテンツのスプレッドシート上で、データの編集や行の追加・削除を行います。
5. 右上の **「XML保存（ダウンロード）」** ボタンをクリックすると、編集内容が反映された XML ファイルがダウンロードされます。

---

## C# 側での利用例

### XML 出力時 (WriteXml)
```csharp
DataSet ds = new DataSet("NewDataSet");

DataTable dt = new DataTable("Customers");
DataColumn colId = dt.Columns.Add("CustomerID", typeof(string));
colId.Caption = "顧客コード"; // ← この Caption が Web 画面の列名になります

DataColumn colName = dt.Columns.Add("CompanyName", typeof(string));
colName.Caption = "会社名";

ds.Tables.Add(dt);

// スキーマを含めて XML 出力
ds.WriteXml("dataset.xml", XmlWriteMode.WriteSchema);
```

### 編集後 XML の読み込み時 (ReadXml)
```csharp
DataSet ds = new DataSet();
// ダウンロードした XML ファイルを読み込み
ds.ReadXml("dataset_edited.xml");
```

---

## ライセンス

MIT License
