/**
 * ==========================================================================
 * DataSet XML エディター - メインスクリプト (app.js)
 * 
 * 本スクリプトは、C# の DataSet.WriteXml で出力された XML を読み込み、
 * スプレッドシート形式で表示・編集し、再度 C# で読み込み可能な XML として
 * ダウンロード保存するためのフロントエンドロジックです。
 * 初心者の方でも理解しやすいよう、処理の流れに沿って日本語コメントを付与しています。
 * ==========================================================================
 */

// --- アプリケーションの状態（State）を保持するオブジェクト ---
const appState = {
  fileName: "dataset.xml",       // 読み込んだファイル名
  rawXmlText: "",               // 生のXML文字列
  xmlDoc: null,                 // DOMParser でパースした XMLDocument オブジェクト
  rootTagName: "NewDataSet",    // DataSet のルート要素名（通常は NewDataSet や DataSet名）
  schemaNode: null,             // <xs:schema> などのスキーマノード（あれば保持）
  tables: {},                   // テーブル別データ: { [tableName]: { columns: string[], rows: object[] } }
  currentTable: null,           // 現在スプレッドシートに表示中のテーブル名
  tabulator: null,              // Tabulator インスタンス
  isModified: false             // 編集されたかどうかのフラグ
};

// ==========================================================================
// 1. 初期化処理 (DOM 読み込み完了時)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  updateStatus("準備完了。XMLファイルを選択するか、サンプルを読み込んでください。");
});

/**
 * ボタンクリックやファイル選択などの各種イベントリスナーを登録します。
 */
function setupEventListeners() {
  // ファイル入力要素とドラッグ＆ドロップエリア
  const fileInput = document.getElementById("file-input");
  const dropZone = document.getElementById("drop-zone");

  // ファイル選択ボタン押下時
  dropZone.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);

  // ドラッグ＆ドロップのイベント制御
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processXmlFile(e.dataTransfer.files[0]);
    }
  });

  // ヘッダーアクション
  document.getElementById("btn-save-xml").addEventListener("click", saveXmlFile);
  document.getElementById("btn-load-sample").addEventListener("click", loadSampleData);

  // ツールバーアクション（行の追加・削除など）
  document.getElementById("btn-add-row").addEventListener("click", addNewRow);
  document.getElementById("btn-delete-row").addEventListener("click", deleteSelectedRows);
  document.getElementById("btn-undo").addEventListener("click", () => {
    if (appState.tabulator) appState.tabulator.undo();
  });
  document.getElementById("btn-redo").addEventListener("click", () => {
    if (appState.tabulator) appState.tabulator.redo();
  });
  document.getElementById("btn-export-csv").addEventListener("click", exportCurrentTableCsv);
}

// ==========================================================================
// 2. ファイル読み込み & XML 解析処理
// ==========================================================================

/**
 * ファイル選択時のハンドラ
 */
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processXmlFile(file);
  }
}

/**
 * XMLファイルを FileReader でテキストとして読み込みます。
 * @param {File} file 
 */
function processXmlFile(file) {
  appState.fileName = file.name;
  updateStatus(`ファイル "${file.name}" を読み込み中...`);

  const reader = new FileReader();
  reader.onload = (e) => {
    const xmlContent = e.target.result;
    parseAndLoadXml(xmlContent, file.name, file.size);
  };
  reader.onerror = () => {
    alert("ファイルの読み込み中にエラーが発生しました。");
    updateStatus("ファイル読み込みエラー", true);
  };
  reader.readAsText(file, "UTF-8");
}

/**
 * サンプルXMLデータを fetch して読み込みます。
 * file:// プロトコル等で CORS 制限がある場合でも動作するように
 * フォールバック用の埋め込みXMLデータを用意しています。
 */
function loadSampleData() {
  updateStatus("サンプルXMLを読み込み中...");
  fetch("sample_dataset.xml")
    .then((response) => {
      if (!response.ok) throw new Error("Fetch failed");
      return response.text();
    })
    .then((xmlText) => {
      parseAndLoadXml(xmlText, "sample_dataset.xml", xmlText.length);
    })
    .catch((err) => {
      console.warn("fetch に失敗したため、埋め込みサンプルデータを使用します:", err);
      // ローカル file:// 直開き時のフォールバック用 XML
      const fallbackXml = `<?xml version="1.0" standalone="yes"?>
<NewDataSet>
  <xs:schema id="NewDataSet" xmlns="" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:msdata="urn:schemas-microsoft-com:xml-msdata">
    <xs:element name="NewDataSet" msdata:IsDataSet="true" msdata:UseCurrentLocale="true">
      <xs:complexType>
        <xs:choice minOccurs="0" maxOccurs="unbounded">
          <xs:element name="Customers">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="CustomerID" msdata:Caption="顧客コード" type="xs:string" minOccurs="0" />
                <xs:element name="CompanyName" msdata:Caption="会社名" type="xs:string" minOccurs="0" />
                <xs:element name="ContactName" msdata:Caption="担当者名" type="xs:string" minOccurs="0" />
                <xs:element name="City" msdata:Caption="都市" type="xs:string" minOccurs="0" />
                <xs:element name="Country" msdata:Caption="国" type="xs:string" minOccurs="0" />
              </xs:sequence>
            </xs:complexType>
          </xs:element>
          <xs:element name="Orders">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="OrderID" msdata:Caption="注文番号" type="xs:int" minOccurs="0" />
                <xs:element name="CustomerID" msdata:Caption="顧客コード" type="xs:string" minOccurs="0" />
                <xs:element name="OrderDate" msdata:Caption="注文日" type="xs:string" minOccurs="0" />
                <xs:element name="Amount" msdata:Caption="金額" type="xs:decimal" minOccurs="0" />
                <xs:element name="Status" msdata:Caption="ステータス" type="xs:string" minOccurs="0" />
              </xs:sequence>
            </xs:complexType>
          </xs:element>
          <xs:element name="Products">
            <xs:complexType>
              <xs:sequence>
                <xs:element name="ProductID" msdata:Caption="商品ID" type="xs:int" minOccurs="0" />
                <xs:element name="ProductName" msdata:Caption="商品名" type="xs:string" minOccurs="0" />
                <xs:element name="UnitPrice" msdata:Caption="単価" type="xs:decimal" minOccurs="0" />
                <xs:element name="UnitsInStock" msdata:Caption="在庫数" type="xs:int" minOccurs="0" />
              </xs:sequence>
            </xs:complexType>
          </xs:element>
        </xs:choice>
      </xs:complexType>
    </xs:element>
  </xs:schema>
  <Customers>
    <CustomerID>ALFKI</CustomerID>
    <CompanyName>Alfreds Futterkiste</CompanyName>
    <ContactName>Maria Anders</ContactName>
    <City>Berlin</City>
    <Country>Germany</Country>
  </Customers>
  <Customers>
    <CustomerID>ANATR</CustomerID>
    <CompanyName>Ana Trujillo Emparedados</CompanyName>
    <ContactName>Ana Trujillo</ContactName>
    <City>México D.F.</City>
    <Country>Mexico</Country>
  </Customers>
  <Customers>
    <CustomerID>ANTON</CustomerID>
    <CompanyName>Antonio Moreno Taquería</CompanyName>
    <ContactName>Antonio Moreno</ContactName>
    <City>México D.F.</City>
    <Country>Mexico</Country>
  </Customers>
  <Orders>
    <OrderID>10248</OrderID>
    <CustomerID>ALFKI</CustomerID>
    <OrderDate>2026-08-01</OrderDate>
    <Amount>440.00</Amount>
    <Status>Shipped</Status>
  </Orders>
  <Orders>
    <OrderID>10249</OrderID>
    <CustomerID>ANATR</CustomerID>
    <OrderDate>2026-08-05</OrderDate>
    <Amount>1865.30</Amount>
    <Status>Pending</Status>
  </Orders>
  <Orders>
    <OrderID>10250</OrderID>
    <CustomerID>ANTON</CustomerID>
    <OrderDate>2026-08-10</OrderDate>
    <Amount>670.50</Amount>
    <Status>Shipped</Status>
  </Orders>
  <Products>
    <ProductID>1</ProductID>
    <ProductName>Chai</ProductName>
    <UnitPrice>18.00</UnitPrice>
    <UnitsInStock>39</UnitsInStock>
  </Products>
  <Products>
    <ProductID>2</ProductID>
    <ProductName>Chang</ProductName>
    <UnitPrice>19.00</UnitPrice>
    <UnitsInStock>17</UnitsInStock>
  </Products>
  <Products>
    <ProductID>3</ProductID>
    <ProductName>Aniseed Syrup</ProductName>
    <UnitPrice>10.00</UnitPrice>
    <UnitsInStock>13</UnitsInStock>
  </Products>
</NewDataSet>`;
      parseAndLoadXml(fallbackXml, "sample_dataset.xml", fallbackXml.length);
    });
}

/**
 * XMLテキストをパースし、DataSetの構造（テーブルと行）を解析します。
 * @param {string} xmlString 
 * @param {string} fileName 
 * @param {number} fileSize 
 */
function parseAndLoadXml(xmlString, fileName, fileSize) {
  appState.rawXmlText = xmlString;
  appState.fileName = fileName;

  // DOMParser を使って XML をオブジェクトに変換
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, "application/xml");

  // XMLパースエラーの確認
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    console.error("XML Parse Error:", parserError.textContent);
    alert("XMLファイルのパースに失敗しました。正しいXML形式か確認してください。");
    updateStatus("パースエラー", true);
    return;
  }

  appState.xmlDoc = doc;
  appState.rootTagName = doc.documentElement.tagName;

  // スキーマノード（<xs:schema> 等）の退避
  // C# の WriteXml(WriteSchema) で出力されたスキーマ定義があれば退避して保存時に再利用します
  appState.schemaNode = null;
  for (let i = 0; i < doc.documentElement.children.length; i++) {
    const child = doc.documentElement.children[i];
    if (child.localName === "schema" || child.tagName.includes("schema")) {
      appState.schemaNode = child.cloneNode(true);
      break;
    }
  }

  // スキーマノードから各テーブル・各列の Caption（msdata:Caption）を抽出
  const schemaCaptions = extractSchemaCaptions(appState.schemaNode);

  // テーブルデータの抽出
  // ルート直下の子要素のうち、スキーマ以外の要素タグがテーブル名になります
  const tables = {};
  const children = doc.documentElement.children;

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const tagName = child.tagName;

    // スキーマ要素はデータテーブルではないため除外
    if (child.localName === "schema" || tagName.includes("schema")) {
      continue;
    }

    // テーブル初期化（初めて検出したテーブル名の場合）
    if (!tables[tagName]) {
      tables[tagName] = {
        columns: [],                      // カラム名の配列（XMLタグ名）
        rows: [],                         // 行データのオブジェクト配列
        captions: schemaCaptions[tagName] || {} // 列名Captionのマッピング { [colName]: "表示名" }
      };
    }

    const rowObj = {};

    // 1. 子要素からカラムと値を取得 (<ColumnName>Value</ColumnName>)
    const rowChildren = child.children;
    if (rowChildren.length > 0) {
      for (let j = 0; j < rowChildren.length; j++) {
        const colNode = rowChildren[j];
        const colName = colNode.tagName;
        const colVal = colNode.textContent || "";
        rowObj[colName] = colVal;

        // まだカラム一覧に無ければ追加
        if (!tables[tagName].columns.includes(colName)) {
          tables[tagName].columns.push(colName);
        }
      }
    }

    // 2. 属性からカラムと値を取得 (<TableName Column="Value" /> のパターンにも対応)
    if (child.attributes && child.attributes.length > 0) {
      for (let k = 0; k < child.attributes.length; k++) {
        const attr = child.attributes[k];
        // xmlns などの名前空間宣言はデータ列から除外
        if (attr.name.startsWith("xmlns") || attr.name.startsWith("diffgr:") || attr.name.startsWith("msdata:")) {
          continue;
        }
        rowObj[attr.name] = attr.value;
        if (!tables[tagName].columns.includes(attr.name)) {
          tables[tagName].columns.push(attr.name);
        }
      }
    }

    tables[tagName].rows.push(rowObj);
  }

  appState.tables = tables;
  appState.isModified = false;

  // ファイル情報バッジの更新
  displayFileInfo(fileName, fileSize, appState.rootTagName);

  // テーブル一覧 UI の更新
  renderTableList();

  // 最初のテーブルを選択して表示
  const tableNames = Object.keys(tables);
  if (tableNames.length > 0) {
    selectTable(tableNames[0]);
    updateStatus(`XMLを読み込みました。(${tableNames.length}個のテーブル)`);
  } else {
    clearSpreadsheet();
    updateStatus("XML内にデータテーブルが見つかりませんでした。", true);
  }

  // 保存ボタンを有効化
  document.getElementById("btn-save-xml").disabled = false;
}

/**
 * <xs:schema> 要素から各テーブルおよび各列の Caption（msdata:Caption）を抽出します。
 * C# の DataColumn.Caption を設定して WriteXml(WriteSchema) した場合、
 * スキーマ定義の各 xs:element に msdata:Caption="表示名" が付与されます。
 * @param {Element|null} schemaNode 
 * @returns {Object} { [tableName]: { [columnName]: captionString } }
 */
function extractSchemaCaptions(schemaNode) {
  const result = {};
  if (!schemaNode) return result;

  // スキーマ内の全要素を取得
  const allElements = schemaNode.getElementsByTagName ? schemaNode.getElementsByTagName("*") : [];

  for (let i = 0; i < allElements.length; i++) {
    const el = allElements[i];
    // xs:element かどうか（localNameが "element"）
    if (el.localName === "element") {
      const tableName = el.getAttribute("name");
      if (!tableName) continue;

      // この要素配下にある子孫の xs:element（列定義）を走査
      const colElements = el.getElementsByTagName ? el.getElementsByTagName("*") : [];
      for (let j = 0; j < colElements.length; j++) {
        const colEl = colElements[j];
        if (colEl.localName === "element") {
          const colName = colEl.getAttribute("name");
          if (!colName) continue;

          // msdata:Caption 属性、または Caption 属性を検索
          let caption = null;
          if (colEl.attributes) {
            for (let a = 0; a < colEl.attributes.length; a++) {
              const attr = colEl.attributes[a];
              // "msdata:Caption", "Caption", またはローカル名が "caption"
              if (attr.localName.toLowerCase() === "caption" || attr.name.toLowerCase().endsWith(":caption")) {
                caption = attr.value;
                break;
              }
            }
          }

          if (caption) {
            if (!result[tableName]) {
              result[tableName] = {};
            }
            result[tableName][colName] = caption;
          }
        }
      }
    }
  }

  return result;
}

/**
 * 読み込んだファイル情報をサイドバーに表示します。
 */
function displayFileInfo(name, size, rootTag) {
  const badge = document.getElementById("file-info-badge");
  badge.style.display = "flex";

  const sizeFormatted = size > 1024 * 1024
    ? (size / (1024 * 1024)).toFixed(2) + " MB"
    : (size / 1024).toFixed(1) + " KB";

  badge.innerHTML = `
    <span><strong class="file-info-label">ファイル:</strong> <span>${escapeHtml(name)}</span></span>
    <span><strong class="file-info-label">サイズ:</strong> <span>${sizeFormatted}</span></span>
    <span><strong class="file-info-label">ルート要素:</strong> <span>&lt;${escapeHtml(rootTag)}&gt;</span></span>
  `;
}

// ==========================================================================
// 3. 左ペイン: テーブル一覧表示
// ==========================================================================

/**
 * 解析したテーブル一覧をサイドバーに描画します。
 */
function renderTableList() {
  const tableListElem = document.getElementById("table-list");
  tableListElem.innerHTML = "";

  const tableNames = Object.keys(appState.tables);
  if (tableNames.length === 0) {
    tableListElem.innerHTML = `<li class="empty-state">テーブルが見つかりません</li>`;
    return;
  }

  tableNames.forEach((tableName) => {
    const tableData = appState.tables[tableName];
    const li = document.createElement("li");
    li.className = "table-list-item";
    li.dataset.tableName = tableName;

    li.innerHTML = `
      <div class="table-name">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
        </svg>
        <span>${escapeHtml(tableName)}</span>
      </div>
      <span class="table-badge">${tableData.rows.length} 件</span>
    `;

    li.addEventListener("click", () => selectTable(tableName));
    tableListElem.appendChild(li);
  });
}

/**
 * テーブルを選択し、スプレッドシートを切り替えます。
 * @param {string} tableName 
 */
function selectTable(tableName) {
  if (!appState.tables[tableName]) return;

  // 直前に編集していたテーブルの最新データを取得して保持
  syncCurrentTableData();

  appState.currentTable = tableName;

  // サイドバーのアクティブ表示を更新
  document.querySelectorAll(".table-list-item").forEach((el) => {
    el.classList.toggle("active", el.dataset.tableName === tableName);
  });

  // メインペインのタイトル・統計情報を更新
  const tableData = appState.tables[tableName];
  document.getElementById("current-table-name").textContent = tableName;
  document.getElementById("current-table-stats").textContent = 
    `${tableData.columns.length} 列 / ${tableData.rows.length} 行`;

  // スプレッドシート未選択表示を非表示にする
  document.getElementById("no-table-placeholder").style.display = "none";
  document.getElementById("main-toolbar").style.display = "flex";

  // Tabulator スプレッドシートを描画
  renderSpreadsheet(tableName);
}

// ==========================================================================
// 4. メインコンテンツ: スプレッドシート描画・編集 (Tabulator)
// ==========================================================================

/**
 * Tabulator を使ってテーブルデータをグリッド表示します。
 * @param {string} tableName 
 */
function renderSpreadsheet(tableName) {
  const tableData = appState.tables[tableName];
  const columns = tableData.columns;

  // Tabulator のカラム定義を作成
  const tabulatorColumns = [
    // 行番号（1-based index）列
    {
      formatter: "rownum",
      hozAlign: "center",
      width: 50,
      headerSort: false,
      frozen: true,
      resizable: false
    },
    // 行選択チェックボックス列
    {
      formatter: "rowSelection",
      titleFormatter: "rowSelection",
      hozAlign: "center",
      headerSort: false,
      width: 40,
      frozen: true,
      cellClick: (e, cell) => cell.getRow().toggleSelect()
    }
  ];

  // データ列の追加（CaptionがあればCaptionを列名にし、すべてインライン編集・フィルタ・ソート可能）
  columns.forEach((colName) => {
    // DataColumnにCaptionプロパティ（msdata:Caption）が定義されていれば表示名として使用
    const caption = (tableData.captions && tableData.captions[colName])
      ? tableData.captions[colName]
      : colName;

    tabulatorColumns.push({
      title: caption,
      field: colName,           // データキーは元のXMLタグ名のまま（保存時の整合性を維持）
      headerTooltip: caption !== colName ? `列名: ${colName}` : undefined,
      editor: "input",          // ダブルクリックやEnterキーでセル編集可能
      headerFilter: "input",    // ヘッダーでのキーワード絞り込み検索
      headerFilterPlaceholder: "検索...",
      sorter: "string",         // 列クリックで並び替え
      resizable: true,
      minWidth: 110
    });
  });

  // 既存の Tabulator があれば破棄して再生成
  if (appState.tabulator) {
    appState.tabulator.destroy();
  }

  // Tabulator インスタンスの生成
  appState.tabulator = new Tabulator("#table-grid", {
    data: JSON.parse(JSON.stringify(tableData.rows)), // 独立したディープコピーを渡す
    layout: "fitDataFill",
    history: true,              // Undo/Redo を有効化
    movableColumns: true,       // 列のドラッグ移動を許可
    columns: tabulatorColumns,
    placeholder: "データが存在しません（「行を追加」で行を作成できます）",
    selectable: true,           // 行選択可能

    // セルが編集されたときのイベント
    cellEdited: () => {
      markModified();
    },

    // 行が削除されたときのイベント
    rowDeleted: () => {
      markModified();
      updateTableStats();
    },

    // 行が追加されたときのイベント
    rowAdded: () => {
      markModified();
      updateTableStats();
    }
  });
}

/**
 * 編集フラグをONにし、ステータスバーに反映します。
 */
function markModified() {
  appState.isModified = true;
  updateStatus("編集済み（未保存の変更があります）");
}

/**
 * 現在表示中の Tabulator からデータを吸い上げ、appState.tables に同期します。
 */
function syncCurrentTableData() {
  if (appState.currentTable && appState.tabulator) {
    const updatedRows = appState.tabulator.getData();
    appState.tables[appState.currentTable].rows = updatedRows;
  }
}

/**
 * 現在のテーブル行数・列数表示を最新化します。
 */
function updateTableStats() {
  if (!appState.currentTable || !appState.tabulator) return;
  const count = appState.tabulator.getDataCount();
  const colCount = appState.tables[appState.currentTable].columns.length;
  document.getElementById("current-table-stats").textContent = `${colCount} 列 / ${count} 行`;

  // サイドバーのバッジも更新
  const item = document.querySelector(`.table-list-item[data-table-name="${appState.currentTable}"] .table-badge`);
  if (item) {
    item.textContent = `${count} 件`;
  }
}

/**
 * スプレッドシート領域をクリアします。
 */
function clearSpreadsheet() {
  if (appState.tabulator) {
    appState.tabulator.destroy();
    appState.tabulator = null;
  }
  document.getElementById("no-table-placeholder").style.display = "flex";
  document.getElementById("main-toolbar").style.display = "none";
  document.getElementById("current-table-name").textContent = "未選択";
  document.getElementById("current-table-stats").textContent = "-";
}

// ==========================================================================
// 5. 行の操作（新規追加・削除）
// ==========================================================================

/**
 * 現在のテーブルに新規の空行を追加します。
 */
function addNewRow() {
  if (!appState.tabulator || !appState.currentTable) return;

  const tableInfo = appState.tables[appState.currentTable];
  const newRow = {};
  tableInfo.columns.forEach((col) => {
    newRow[col] = ""; // 初期値は空文字
  });

  // 末尾に行を追加
  appState.tabulator.addRow(newRow, false).then((row) => {
    // 追加した行までスクロールし、ハイライト
    row.scrollTo();
    markModified();
    updateTableStats();
  });
}

/**
 * チェックボックス等で選択されている行を削除します。
 */
function deleteSelectedRows() {
  if (!appState.tabulator || !appState.currentTable) return;

  const selectedRows = appState.tabulator.getSelectedRows();
  if (selectedRows.length === 0) {
    alert("削除したい行の左端にあるチェックボックスを選択してください。");
    return;
  }

  if (confirm(`選択された ${selectedRows.length} 件の行を削除しますか？`)) {
    selectedRows.forEach((row) => row.delete());
    markModified();
    updateTableStats();
  }
}

/**
 * 現在のテーブルデータを CSV 形式でダウンロードエクスポートします。
 */
function exportCurrentTableCsv() {
  if (!appState.tabulator || !appState.currentTable) return;
  appState.tabulator.download("csv", `${appState.currentTable}.csv`);
}

// ==========================================================================
// 6. XML の再生成 & 保存（ダウンロード）
// ==========================================================================

/**
 * 編集後のデータから C# DataSet 互換の XML を構築し、ダウンロードします。
 */
function saveXmlFile() {
  // 現在開いているテーブルの編集内容を確実に同期
  syncCurrentTableData();

  updateStatus("XMLファイルを生成中...");

  try {
    const xmlString = buildDataSetXml();

    // Blob を生成してダウンロードリンクをトリガー
    const blob = new Blob([xmlString], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = appState.fileName || "dataset_edited.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    appState.isModified = false;
    updateStatus(`XMLファイルを保存しました: ${a.download}`);
  } catch (err) {
    console.error(err);
    alert("XMLの生成に失敗しました: " + err.message);
    updateStatus("保存失敗", true);
  }
}

/**
 * 最新の tables データから C# DataSet 形式の XML 文字列を構築します。
 * @returns {string} フォーマットされた XML 文字列
 */
function buildDataSetXml() {
  // DOMImplementation を使って新しい XML ドキュメントを作成
  const doc = document.implementation.createDocument(null, appState.rootTagName, null);
  const root = doc.documentElement;

  // 1. 元のルート要素の属性（名前空間等）があれば引き継ぐ
  if (appState.xmlDoc && appState.xmlDoc.documentElement.attributes) {
    const origAttrs = appState.xmlDoc.documentElement.attributes;
    for (let i = 0; i < origAttrs.length; i++) {
      const attr = origAttrs[i];
      root.setAttribute(attr.name, attr.value);
    }
  }

  // 2. スキーマ（<xs:schema>）が存在した場合は先頭に再配置
  if (appState.schemaNode) {
    const importedSchema = doc.importNode(appState.schemaNode, true);
    root.appendChild(importedSchema);
  }

  // 3. 各テーブルの行データをXML要素として追加
  const tableNames = Object.keys(appState.tables);
  tableNames.forEach((tableName) => {
    const tableInfo = appState.tables[tableName];
    const rows = tableInfo.rows;

    rows.forEach((row) => {
      const rowElem = doc.createElement(tableName);

      tableInfo.columns.forEach((colName) => {
        const val = row[colName];
        // 値が存在する場合、または定義されている場合に要素を作成
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          const colElem = doc.createElement(colName);
          colElem.textContent = String(val);
          rowElem.appendChild(colElem);
        }
      });

      root.appendChild(rowElem);
    });
  });

  // XML をシリアライズ
  const serializer = new XMLSerializer();
  let rawXml = serializer.serializeToString(doc);

  // XML宣言を先頭に追加（C# の WriteXml に合わせた宣言）
  if (!rawXml.startsWith("<?xml")) {
    rawXml = '<?xml version="1.0" standalone="yes"?>\n' + rawXml;
  }

  // 読みやすいようにインデント整形
  return formatXml(rawXml);
}

/**
 * XML文字列を階層に合わせて美しくインデント整形（Prettify）します。
 * @param {string} xml 
 * @returns {string} 整形されたXML
 */
function formatXml(xml) {
  let formatted = "";
  let indent = "";
  const tab = "  "; // 2スペース

  // タグとテキストを分割
  const nodes = xml.replace(/(>)(<)(\/*)/g, "$1\r\n$2$3").split("\r\n");

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i].trim();
    if (!node) continue;

    if (node.match(/^<\/\w/)) {
      // 閉じタグ: </...> の場合はインデントを1段階戻す
      indent = indent.substring(tab.length);
      formatted += indent + node + "\r\n";
    } else if (node.match(/^<\w[^>]*[^\/]>.*<\/\w[^>]*>$/)) {
      // 1行に収まるタグ: <tag>text</tag> の場合はそのまま同じインデントで出力
      formatted += indent + node + "\r\n";
    } else if (node.match(/^<\w[^>]*[^\/]>$/)) {
      // 開始タグ: <tag> の場合はインデントを出力後に深める
      formatted += indent + node + "\r\n";
      indent += tab;
    } else if (node.match(/^<\w[^>]*\/>$/)) {
      // 単一空タグ: <tag/> の場合はインデント変更なし
      formatted += indent + node + "\r\n";
    } else {
      // コメントや宣言、テキストノード
      formatted += indent + node + "\r\n";
    }
  }

  return formatted.trim();
}

// ==========================================================================
// 7. ユーティリティ関数
// ==========================================================================

/**
 * ステータスバーのメッセージを更新します。
 * @param {string} message 
 * @param {boolean} isError 
 */
function updateStatus(message, isError = false) {
  const statusMsg = document.getElementById("status-message");
  const statusDot = document.getElementById("status-dot");
  if (statusMsg) statusMsg.textContent = message;
  if (statusDot) {
    statusDot.style.backgroundColor = isError ? "#ef4444" : (appState.isModified ? "#f59e0b" : "#22c55e");
  }
}

/**
 * HTMLエスケープ処理（XSS防止）
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
