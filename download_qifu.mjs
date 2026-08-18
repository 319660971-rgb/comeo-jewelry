import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const BASE_URL = "https://yiwuqifu.com";
const EXPORT_DATE = "2026-08-13";
const OUTPUT_DIR = path.resolve("outputs", `QIFU-${EXPORT_DATE}`);
const VERIFY_DIR = path.resolve(".artifacts", `qifu-verification-${EXPORT_DATE}`);
const PRODUCTS_API = `${BASE_URL}/api/products?status=ACTIVE&page=1&pageSize=1000`;
const CATEGORIES_API = `${BASE_URL}/api/categories`;
const EXCHANGE_RATE_API = `${BASE_URL}/api/exchange-rate`;
const REQUEST_HEADERS = {
  Accept: "application/json",
  "User-Agent": "QIFU catalog export for authorized buyer (contact via yiwuqifu.com)",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: { ...REQUEST_HEADERS, ...(options.headers || {}) },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 700);
    }
  }
  throw new Error(`${lastError?.message || "Request failed"}: ${url}`);
}

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetchWithRetry(url, {}, 2);
      const body = await response.text();
      return JSON.parse(body);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 900);
    }
  }
  throw new Error(`${lastError?.message || "JSON request failed"}: ${url}`);
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

function asNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function joinValues(value) {
  return Array.isArray(value) ? value.filter(Boolean).join(", ") : text(value);
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function excelDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function safeFolderName(value) {
  const cleaned = text(value)
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "unknown-sku";
}

function extensionFrom(url, contentType = "") {
  const pathname = new URL(url).pathname;
  const ext = path.extname(pathname).toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return ext;
  const byType = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/avif": ".avif",
  };
  return byType[contentType.split(";")[0].trim().toLowerCase()] || ".jpg";
}

async function isCompleteImage(filePath) {
  let handle;
  try {
    const stat = await fs.stat(filePath);
    if (stat.size < 12) return false;
    handle = await fs.open(filePath, "r");
    const head = Buffer.alloc(16);
    const tailLength = Math.min(32, stat.size);
    const tail = Buffer.alloc(tailLength);
    await handle.read(head, 0, head.length, 0);
    await handle.read(tail, 0, tailLength, stat.size - tailLength);
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".jpg" || ext === ".jpeg") {
      if (head[0] !== 0xff || head[1] !== 0xd8) return false;
      for (let index = tail.length - 2; index >= 0; index -= 1) {
        if (tail[index] === 0xff && tail[index + 1] === 0xd9) return true;
      }
      return false;
    }
    if (ext === ".png") {
      const pngSignature = head.subarray(0, 8).toString("hex") === "89504e470d0a1a0a";
      return pngSignature && tail.includes(Buffer.from("IEND"));
    }
    if (ext === ".webp") {
      return head.subarray(0, 4).toString("ascii") === "RIFF"
        && head.subarray(8, 12).toString("ascii") === "WEBP"
        && head.readUInt32LE(4) + 8 === stat.size;
    }
    if (ext === ".gif") {
      return head.subarray(0, 3).toString("ascii") === "GIF" && tail[tail.length - 1] === 0x3b;
    }
    return true;
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

function curlConfigValue(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function bulkDownloadWithCurl(jobs) {
  const pending = [];
  for (const job of jobs) {
    const folderPath = path.join(OUTPUT_DIR, "images", job.folder);
    await fs.mkdir(folderPath, { recursive: true });
    const fileName = `${String(job.index).padStart(2, "0")}${extensionFrom(job.url)}`;
    const outputPath = path.join(folderPath, fileName);
    if (await isCompleteImage(outputPath)) continue;
    pending.push({ url: job.url, outputPath });
  }
  if (!pending.length) return;

  const configPath = path.join(VERIFY_DIR, "images.curl.conf");
  const config = [
    "parallel",
    "parallel-max = 50",
    "parallel-immediate",
    "http1.1",
    "location",
    "fail",
    "remove-on-error",
    "silent",
    "show-error",
    "retry = 2",
    "retry-all-errors",
    "connect-timeout = 20",
    "max-time = 180",
    `user-agent = ${curlConfigValue(REQUEST_HEADERS["User-Agent"])}`,
    ...pending.flatMap(({ url, outputPath }) => [
      `url = ${curlConfigValue(url)}`,
      `output = ${curlConfigValue(outputPath)}`,
    ]),
  ].join("\n");
  await fs.writeFile(configPath, config);
  console.log(`curl bulk download: ${pending.length} remaining images`);

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn("/usr/bin/curl", ["--config", configPath], { stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.on("error", reject);
    child.on("close", resolve);
  });
  console.log(`curl bulk download finished with exit code ${exitCode}; verifying every file...`);
}

function sanitizeStall(stall) {
  if (!stall) return null;
  return {
    id: stall.id ?? null,
    code: stall.code ?? null,
    name: stall.name ?? null,
    location: stall.location ?? null,
    market: stall.market ?? null,
  };
}

function sanitizeCategory(category) {
  if (!category) return null;
  return {
    id: category.id ?? null,
    name: category.name ?? null,
    parentId: category.parentId ?? null,
    groupId: category.groupId ?? null,
    image: category.image ?? null,
    isHidden: Boolean(category.isHidden),
    showOnHome: Boolean(category.showOnHome),
  };
}

function sanitizeImage(image) {
  return {
    id: image?.id ?? null,
    url: image?.url ?? null,
    order: image?.order ?? 0,
    album: image?.album ?? null,
  };
}

function sanitizeVariant(variant) {
  return {
    id: variant.id ?? null,
    sku: variant.sku ?? null,
    name: variant.name ?? null,
    color: variant.color ?? null,
    salePrice: asNumber(variant.salePrice),
    buyerTierPriceCny: asNumber(variant.salePriceUsd),
    usdPriceOverride: asNumber(variant.usdPrice),
    stock: asNumber(variant.stock),
    moq: variant.moq ?? null,
    limitQty: asNumber(variant.limitQty),
    weight: asNumber(variant.weight),
    volume: variant.volume ?? null,
    sortOrder: asNumber(variant.sortOrder),
    stall: sanitizeStall(variant.stall),
    images: (variant.images || []).map(sanitizeImage),
  };
}

function sanitizeProduct(product) {
  return {
    id: product.id,
    sku: product.sku ?? null,
    name: product.name ?? null,
    status: product.status ?? null,
    color: product.color ?? null,
    style: product.style ?? null,
    materials: product.materials || [],
    crafts: product.crafts || [],
    salePrice: asNumber(product.salePrice),
    buyerTierPriceCny: asNumber(product.salePriceUsd),
    usdPriceOverride: asNumber(product.usdPrice),
    showPrice: Boolean(product.showPrice),
    priceTier: product.priceTier ?? null,
    estimatedPrice: asNumber(product.estimatedPrice),
    estimatedPriceCurrency: product.estimatedPriceCurrency ?? null,
    stock: asNumber(product.stock),
    soldCount: asNumber(product.soldCount),
    moq: product.moq ?? null,
    weight: asNumber(product.weight),
    unit: product.unit ?? null,
    description: product.description ?? null,
    notes: product.notes ?? null,
    boxSpecs: product.boxSpecs ?? null,
    packaging: product.packaging ?? null,
    shippingNotes: product.shippingNotes ?? null,
    tags: product.tags || [],
    country: product.country ?? null,
    presale: Boolean(product.presale),
    customOrder: Boolean(product.customOrder),
    createdAt: product.createdAt ?? null,
    updatedAt: product.updatedAt ?? null,
    category: sanitizeCategory(product.category),
    stall: sanitizeStall(product.stall),
    images: (product.images || []).map(sanitizeImage),
    variants: (product.variants || []).map(sanitizeVariant),
    productUrl: `${BASE_URL}/products-store/${product.id}`,
    apiUrl: `${BASE_URL}/api/products/${product.id}?buyerView=1`,
  };
}

function flattenCategories(categories) {
  const rows = [];
  function visit(category, parentName = "", parentPath = "", depth = 0) {
    const fullPath = parentPath ? `${parentPath} > ${category.name}` : category.name;
    rows.push({
      id: category.id,
      name: category.name,
      parentId: category.parentId,
      parentName,
      groupId: category.groupId,
      depth,
      fullPath,
      productCount: category._count?.products ?? null,
      childCount: category._count?.children ?? (category.children || []).length,
      skuCount: category.skuCount ?? null,
      hidden: Boolean(category.isHidden),
      showOnHome: Boolean(category.showOnHome),
      homeOrder: category.homeOrder ?? null,
      order: category.order ?? null,
      image: category.image ? new URL(category.image, BASE_URL).href : "",
      createdAt: category.createdAt ?? null,
      updatedAt: category.updatedAt ?? null,
    });
    for (const child of category.children || []) visit(child, category.name, fullPath, depth + 1);
  }
  for (const category of categories) visit(category);
  return rows;
}

function categoryPath(product, categoryById) {
  const names = [];
  let current = product.category;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? categoryById.get(current.parentId) : null;
  }
  return names.join(" > ");
}

function columnLetter(index) {
  let number = index + 1;
  let letters = "";
  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
}

function styleTitle(sheet, range, title) {
  sheet.getRange(range).merge();
  const cell = sheet.getRange(range.split(":")[0]);
  cell.values = [[title]];
  cell.format = {
    fill: "#7A1F2A",
    font: { bold: true, color: "#FFFFFF", size: 18 },
    verticalAlignment: "center",
  };
  sheet.getRange(range).format.rowHeight = 34;
}

function styleHeader(range) {
  range.format = {
    fill: "#2F343A",
    font: { bold: true, color: "#FFFFFF", size: 10 },
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "outside", style: "thin", color: "#C8CDD2" },
  };
  range.format.rowHeight = 30;
}

function styleDataSheet(sheet, lastColumn, lastRow) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  styleHeader(sheet.getRange(`A1:${lastColumn}1`));
  if (lastRow >= 2) {
    sheet.getRange(`A2:${lastColumn}${lastRow}`).format = {
      font: { size: 9, color: "#202428" },
      verticalAlignment: "top",
      borders: { insideHorizontal: { style: "thin", color: "#E7E9EC" } },
    };
    sheet.getRange(`A2:${lastColumn}${lastRow}`).format.rowHeight = 22;
  }
}

async function downloadImages(products, skuFolderById) {
  const jobs = [];
  for (const product of products) {
    const sourcesByUrl = new Map();
    for (const image of product.images || []) {
      if (!image.url) continue;
      const absoluteUrl = new URL(image.url, BASE_URL).href;
      sourcesByUrl.set(absoluteUrl, {
        productId: product.id,
        sku: product.sku,
        variantSkus: new Set(),
        productImage: true,
        order: image.order ?? 0,
        album: image.album ?? "",
        url: absoluteUrl,
      });
    }
    for (const variant of product.variants || []) {
      for (const image of variant.images || []) {
        if (!image.url) continue;
        const absoluteUrl = new URL(image.url, BASE_URL).href;
        const existing = sourcesByUrl.get(absoluteUrl) || {
          productId: product.id,
          sku: product.sku,
          variantSkus: new Set(),
          productImage: false,
          order: image.order ?? 0,
          album: image.album ?? "",
          url: absoluteUrl,
        };
        existing.variantSkus.add(variant.sku || variant.name || "unknown-variant");
        sourcesByUrl.set(absoluteUrl, existing);
      }
    }
    const uniqueImages = Array.from(sourcesByUrl.values()).sort((a, b) => a.order - b.order || a.url.localeCompare(b.url));
    uniqueImages.forEach((job, index) => {
      job.folder = skuFolderById.get(product.id);
      job.index = index + 1;
      jobs.push(job);
    });
  }

  console.log(`Downloading ${jobs.length} unique images...`);
  await bulkDownloadWithCurl(jobs);
  let finished = 0;
  const results = await mapConcurrent(jobs, 80, async (job) => {
    const folderPath = path.join(OUTPUT_DIR, "images", job.folder);
    await fs.mkdir(folderPath, { recursive: true });
    let response;
    try {
      const expectedFileName = `${String(job.index).padStart(2, "0")}${extensionFrom(job.url)}`;
      const expectedPath = path.join(folderPath, expectedFileName);
      try {
        if (await isCompleteImage(expectedPath)) {
          const existing = await fs.stat(expectedPath);
          finished += 1;
          if (finished % 100 === 0 || finished === jobs.length) {
            console.log(`Images: ${finished}/${jobs.length}`);
          }
          return {
            ...job,
            localPath: path.relative(OUTPUT_DIR, expectedPath),
            status: "Downloaded",
            bytes: existing.size,
            error: "",
          };
        }
      } catch {
        // File does not exist yet; download it below.
      }
      response = await fetchWithRetry(job.url, { headers: { Accept: "image/*" } }, 3);
      const contentType = response.headers.get("content-type") || "";
      const extension = extensionFrom(job.url, contentType);
      const fileName = `${String(job.index).padStart(2, "0")}${extension}`;
      const absolutePath = path.join(folderPath, fileName);
      const relativePath = path.relative(OUTPUT_DIR, absolutePath);
      const bytes = new Uint8Array(await response.arrayBuffer());
      await fs.writeFile(absolutePath, bytes);
      finished += 1;
      if (finished % 100 === 0 || finished === jobs.length) {
        console.log(`Images: ${finished}/${jobs.length}`);
      }
      return { ...job, localPath: relativePath, status: "Downloaded", bytes: bytes.length, error: "" };
    } catch (error) {
      finished += 1;
      return { ...job, localPath: "", status: "Failed", bytes: 0, error: error.message };
    }
  });
  return results;
}

async function buildProductsWorkbook(products, categories, exchangeRate, imageResults, skuFolderById) {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add("Summary");
  const productsSheet = workbook.worksheets.add("Products");
  const variantsSheet = workbook.worksheets.add("Variants");
  const imagesSheet = workbook.worksheets.add("Images");

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const imagesByProductId = new Map();
  for (const result of imageResults) {
    const list = imagesByProductId.get(result.productId) || [];
    list.push(result);
    imagesByProductId.set(result.productId, list);
  }

  const productHeaders = [
    "Product ID", "SKU", "Name", "Status", "Category", "Category Path", "Materials", "Crafts", "Color", "Style",
    "MOQ", "Base Price CNY", "Buyer Tier Price CNY", "Display Price USD", "Show Price", "Price Tier", "Estimated Price",
    "Estimated Currency", "Stock", "Sold Count", "Variant Count", "Image Count", "Stall Code", "Stall Name", "Stall Location",
    "Description", "Notes", "Packaging", "Shipping Notes", "Tags", "Presale", "Custom Order", "Created At", "Updated At",
    "Product URL", "API URL", "Image Folder", "Downloaded Images", "Failed Images",
  ];
  const productRows = products.map((product) => {
    const imageDownloads = imagesByProductId.get(product.id) || [];
    return [
      product.id, product.sku || "", product.name || "", product.status || "", product.category?.name || "",
      categoryPath(product, categoryById), joinValues(product.materials), joinValues(product.crafts), product.color || "", product.style || "",
      product.moq || "", asNumber(product.salePrice), asNumber(product.buyerTierPriceCny), null, yesNo(product.showPrice), product.priceTier || "",
      asNumber(product.estimatedPrice), product.estimatedPriceCurrency || "", asNumber(product.stock), asNumber(product.soldCount),
      (product.variants || []).length, imageDownloads.length, product.stall?.code || "", product.stall?.name || "", product.stall?.location || "",
      product.description || "", product.notes || "", text(product.packaging), product.shippingNotes || "", joinValues(product.tags), yesNo(product.presale),
      yesNo(product.customOrder), excelDate(product.createdAt), excelDate(product.updatedAt), product.productUrl, product.apiUrl,
      path.join("images", skuFolderById.get(product.id)), imageDownloads.filter((item) => item.status === "Downloaded").length,
      imageDownloads.filter((item) => item.status === "Failed").length,
    ];
  });

  productsSheet.getRangeByIndexes(0, 0, 1, productHeaders.length).values = [productHeaders];
  if (productRows.length) productsSheet.getRangeByIndexes(1, 0, productRows.length, productHeaders.length).values = productRows;
  const productLastCol = columnLetter(productHeaders.length - 1);
  const productLastRow = productRows.length + 1;
  styleDataSheet(productsSheet, productLastCol, productLastRow);
  const productTable = productsSheet.tables.add(`A1:${productLastCol}${productLastRow}`, true, "ProductsTable");
  productTable.style = "TableStyleMedium2";
  const displayPriceCol = columnLetter(productHeaders.indexOf("Display Price USD"));
  const tierPriceCol = columnLetter(productHeaders.indexOf("Buyer Tier Price CNY"));
  const showPriceCol = columnLetter(productHeaders.indexOf("Show Price"));
  if (productRows.length) {
    productsSheet.getRange(`${displayPriceCol}2`).formulas = [[`=IF(AND(${showPriceCol}2="Yes",${tierPriceCol}2>0),${tierPriceCol}2/'Summary'!$B$7,"")`]];
    productsSheet.getRange(`${displayPriceCol}2:${displayPriceCol}${productLastRow}`).fillDown();
  }
  productsSheet.getRange(`B2:B${productLastRow}`).format.numberFormat = "@";
  productsSheet.getRange(`L2:N${productLastRow}`).format.numberFormat = "0.00";
  productsSheet.getRange(`Q2:Q${productLastRow}`).format.numberFormat = "0.00";
  productsSheet.getRange(`S2:V${productLastRow}`).format.numberFormat = "#,##0";
  productsSheet.getRange(`AG2:AH${productLastRow}`).format.numberFormat = "yyyy-mm-dd hh:mm";
  productsSheet.getRange(`Z2:AC${productLastRow}`).format.wrapText = true;
  const productWidths = [22, 14, 28, 11, 20, 34, 24, 20, 14, 16, 12, 14, 18, 16, 11, 10, 14, 14, 10, 11, 12, 11, 13, 20, 24, 36, 28, 24, 28, 24, 10, 12, 18, 18, 40, 44, 28, 12, 11];
  productWidths.forEach((width, index) => {
    productsSheet.getRange(`${columnLetter(index)}:${columnLetter(index)}`).format.columnWidth = width;
  });

  const variantHeaders = [
    "Product ID", "Product SKU", "Variant ID", "Variant SKU", "Variant Name", "Color", "MOQ", "Base Price CNY",
    "Buyer Tier Price CNY", "Display Price USD", "USD Price Override", "Stock", "Limit Qty", "Weight", "Volume",
    "Stall Code", "Stall Name", "Image Count",
  ];
  const variantRows = [];
  for (const product of products) {
    for (const variant of product.variants || []) {
      variantRows.push([
        product.id, product.sku || "", variant.id || "", variant.sku || "", variant.name || "", variant.color || "", variant.moq || "",
        asNumber(variant.salePrice), asNumber(variant.buyerTierPriceCny), null, asNumber(variant.usdPriceOverride), asNumber(variant.stock),
        asNumber(variant.limitQty), asNumber(variant.weight), text(variant.volume), variant.stall?.code || product.stall?.code || "",
        variant.stall?.name || product.stall?.name || "", (variant.images || []).length,
      ]);
    }
  }
  variantsSheet.getRangeByIndexes(0, 0, 1, variantHeaders.length).values = [variantHeaders];
  if (variantRows.length) variantsSheet.getRangeByIndexes(1, 0, variantRows.length, variantHeaders.length).values = variantRows;
  const variantLastCol = columnLetter(variantHeaders.length - 1);
  const variantLastRow = variantRows.length + 1;
  styleDataSheet(variantsSheet, variantLastCol, variantLastRow);
  const variantTable = variantsSheet.tables.add(`A1:${variantLastCol}${variantLastRow}`, true, "VariantsTable");
  variantTable.style = "TableStyleMedium2";
  if (variantRows.length) {
    variantsSheet.getRange("J2").formulas = [[`=IF(I2>0,I2/'Summary'!$B$7,IF(K2>0,K2,""))`]];
    variantsSheet.getRange(`J2:J${variantLastRow}`).fillDown();
  }
  variantsSheet.getRange(`B2:D${variantLastRow}`).format.numberFormat = "@";
  variantsSheet.getRange(`H2:K${variantLastRow}`).format.numberFormat = "0.00";
  variantsSheet.getRange(`L2:N${variantLastRow}`).format.numberFormat = "#,##0.00";
  const variantWidths = [22, 14, 22, 18, 18, 14, 12, 15, 18, 16, 16, 10, 11, 10, 18, 14, 22, 11];
  variantWidths.forEach((width, index) => {
    variantsSheet.getRange(`${columnLetter(index)}:${columnLetter(index)}`).format.columnWidth = width;
  });

  const imageHeaders = ["Product ID", "SKU", "Variant SKU(s)", "Kind", "Order", "Album", "Source URL", "Local Path", "Status", "Bytes", "Error"];
  const imageRows = imageResults.map((result) => [
    result.productId, result.sku || "", Array.from(result.variantSkus || []).join(", "),
    result.productImage && result.variantSkus?.size ? "Product + Variant" : result.productImage ? "Product" : "Variant",
    result.order ?? 0, result.album || "", result.url, result.localPath, result.status, result.bytes, result.error,
  ]);
  imagesSheet.getRangeByIndexes(0, 0, 1, imageHeaders.length).values = [imageHeaders];
  if (imageRows.length) imagesSheet.getRangeByIndexes(1, 0, imageRows.length, imageHeaders.length).values = imageRows;
  const imageLastCol = columnLetter(imageHeaders.length - 1);
  const imageLastRow = imageRows.length + 1;
  styleDataSheet(imagesSheet, imageLastCol, imageLastRow);
  const imagesTable = imagesSheet.tables.add(`A1:${imageLastCol}${imageLastRow}`, true, "ImagesTable");
  imagesTable.style = "TableStyleMedium2";
  imagesSheet.getRange(`B2:C${imageLastRow}`).format.numberFormat = "@";
  imagesSheet.getRange(`E2:E${imageLastRow}`).format.numberFormat = "#,##0";
  imagesSheet.getRange(`J2:J${imageLastRow}`).format.numberFormat = "#,##0";
  const imageWidths = [22, 14, 26, 18, 9, 13, 52, 38, 13, 12, 42];
  imageWidths.forEach((width, index) => {
    imagesSheet.getRange(`${columnLetter(index)}:${columnLetter(index)}`).format.columnWidth = width;
  });

  summary.showGridLines = false;
  styleTitle(summary, "A1:F1", "QIFU Active Product Export");
  summary.getRange("A3:B10").values = [
    ["Metric", "Value"],
    ["Export date", new Date(`${EXPORT_DATE}T00:00:00-07:00`)],
    ["Active products", null],
    ["Variants", null],
    ["USD to CNY rate", exchangeRate.usdToCny],
    ["Downloaded images", null],
    ["Failed images", null],
    ["Source", BASE_URL],
  ];
  summary.getRange("B5").formulas = [[`=COUNTA('Products'!$A$2:$A$${productLastRow})`]];
  summary.getRange("B6").formulas = [[`=COUNTA('Variants'!$A$2:$A$${variantLastRow})`]];
  summary.getRange("B8").formulas = [[`=COUNTIF('Images'!$I$2:$I$${imageLastRow},"Downloaded")`]];
  summary.getRange("B9").formulas = [[`=COUNTIF('Images'!$I$2:$I$${imageLastRow},"Failed")`]];
  styleHeader(summary.getRange("A3:B3"));
  summary.getRange("A4:A10").format = { font: { bold: true, color: "#34383D" }, fill: "#F2F3F5" };
  summary.getRange("A3:B10").format.borders = { preset: "outside", style: "thin", color: "#C8CDD2" };
  summary.getRange("B4").format.numberFormat = "yyyy-mm-dd";
  summary.getRange("B5:B6").format.numberFormat = "#,##0";
  summary.getRange("B7").format.numberFormat = "0.000000";
  summary.getRange("B8:B9").format.numberFormat = "#,##0";
  summary.getRange("A:A").format.columnWidth = 24;
  summary.getRange("B:B").format.columnWidth = 42;
  summary.getRange("D3:F8").values = [
    ["Price field", "Meaning", "Workbook handling"],
    ["Base Price CNY", "Supplier base price in CNY", "Raw API value"],
    ["Buyer Tier Price CNY", "Tier-adjusted buyer price in CNY", "Raw API value"],
    ["Display Price USD", "Buyer price converted using current rate", "Excel formula"],
    ["USD Price Override", "Explicit per-variant USD override", "Used when tier price is absent"],
    ["Show Price", "Whether storefront may show a price", "Yes / No"],
  ];
  styleHeader(summary.getRange("D3:F3"));
  summary.getRange("D4:F8").format = { wrapText: true, verticalAlignment: "top", font: { size: 10, color: "#34383D" } };
  summary.getRange("D:D").format.columnWidth = 22;
  summary.getRange("E:E").format.columnWidth = 36;
  summary.getRange("F:F").format.columnWidth = 26;
  summary.freezePanes.freezeRows(1);

  return { workbook, ranges: { productLastRow, variantLastRow, imageLastRow } };
}

async function buildCategoriesWorkbook(categoryRows) {
  const workbook = Workbook.create();
  const summary = workbook.worksheets.add("Summary");
  const sheet = workbook.worksheets.add("Categories");
  const headers = [
    "Category ID", "Name", "Parent ID", "Parent Name", "Group ID", "Depth", "Full Path", "Product Count", "Child Count",
    "SKU Count", "Hidden", "Show On Home", "Home Order", "Order", "Image URL", "Created At", "Updated At",
  ];
  const rows = categoryRows.map((category) => [
    category.id, category.name, category.parentId || "", category.parentName || "", category.groupId || "", category.depth,
    category.fullPath, asNumber(category.productCount), asNumber(category.childCount), asNumber(category.skuCount), yesNo(category.hidden),
    yesNo(category.showOnHome), asNumber(category.homeOrder), asNumber(category.order), category.image, excelDate(category.createdAt), excelDate(category.updatedAt),
  ]);
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  if (rows.length) sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  const lastCol = columnLetter(headers.length - 1);
  const lastRow = rows.length + 1;
  styleDataSheet(sheet, lastCol, lastRow);
  const table = sheet.tables.add(`A1:${lastCol}${lastRow}`, true, "CategoriesTable");
  table.style = "TableStyleMedium2";
  sheet.getRange(`F2:F${lastRow}`).format.numberFormat = "#,##0";
  sheet.getRange(`H2:J${lastRow}`).format.numberFormat = "#,##0";
  sheet.getRange(`M2:N${lastRow}`).format.numberFormat = "#,##0";
  sheet.getRange(`P2:Q${lastRow}`).format.numberFormat = "yyyy-mm-dd hh:mm";
  const widths = [22, 24, 22, 22, 22, 9, 42, 14, 12, 12, 10, 14, 12, 10, 48, 18, 18];
  widths.forEach((width, index) => {
    sheet.getRange(`${columnLetter(index)}:${columnLetter(index)}`).format.columnWidth = width;
  });

  summary.showGridLines = false;
  styleTitle(summary, "A1:D1", "QIFU Category Export");
  summary.getRange("A3:B7").values = [
    ["Metric", "Value"],
    ["Export date", new Date(`${EXPORT_DATE}T00:00:00-07:00`)],
    ["Category rows", null],
    ["Top-level categories", null],
    ["Source", CATEGORIES_API],
  ];
  summary.getRange("B5").formulas = [[`=COUNTA('Categories'!$A$2:$A$${lastRow})`]];
  summary.getRange("B6").formulas = [[`=COUNTIF('Categories'!$F$2:$F$${lastRow},0)`]];
  styleHeader(summary.getRange("A3:B3"));
  summary.getRange("A4:A7").format = { font: { bold: true, color: "#34383D" }, fill: "#F2F3F5" };
  summary.getRange("A3:B7").format.borders = { preset: "outside", style: "thin", color: "#C8CDD2" };
  summary.getRange("B4").format.numberFormat = "yyyy-mm-dd";
  summary.getRange("B5:B6").format.numberFormat = "#,##0";
  summary.getRange("A:A").format.columnWidth = 24;
  summary.getRange("B:B").format.columnWidth = 58;
  summary.freezePanes.freezeRows(1);
  return { workbook, lastRow, lastCol };
}

async function verifyAndExportProducts(workbook, outputPath) {
  const inspect = await workbook.inspect({
    kind: "table",
    range: "Summary!A1:F10",
    include: "values,formulas",
    tableMaxRows: 12,
    tableMaxCols: 8,
    maxChars: 5000,
  });
  console.log(`Products workbook check:\n${inspect.ndjson}`);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: "products workbook formula error scan",
  });
  console.log(`Products formula errors:\n${errors.ndjson}`);
  const renders = [
    ["Summary", "A1:F10", "products-summary.png"],
    ["Products", "A1:W12", "products-left.png"],
    ["Products", "X1:AM12", "products-right.png"],
    ["Variants", "A1:R12", "variants.png"],
    ["Images", "A1:K12", "images.png"],
  ];
  for (const [sheetName, range, fileName] of renders) {
    const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
    await fs.writeFile(path.join(VERIFY_DIR, fileName), new Uint8Array(await preview.arrayBuffer()));
  }
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
}

async function verifyAndExportCategories(workbook, outputPath) {
  const inspect = await workbook.inspect({
    kind: "table",
    range: "Categories!A1:Q12",
    include: "values,formulas",
    tableMaxRows: 12,
    tableMaxCols: 17,
    maxChars: 5000,
  });
  console.log(`Categories workbook check:\n${inspect.ndjson}`);
  const errors = await workbook.inspect({
    kind: "match",
    searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
    options: { useRegex: true, maxResults: 100 },
    summary: "categories workbook formula error scan",
  });
  console.log(`Categories formula errors:\n${errors.ndjson}`);
  for (const [sheetName, range, fileName] of [
    ["Summary", "A1:D7", "categories-summary.png"],
    ["Categories", "A1:Q15", "categories.png"],
  ]) {
    const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
    await fs.writeFile(path.join(VERIFY_DIR, fileName), new Uint8Array(await preview.arrayBuffer()));
  }
  const output = await SpreadsheetFile.exportXlsx(workbook);
  await output.save(outputPath);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(VERIFY_DIR, { recursive: true });

  console.log("Fetching product index, categories, and exchange rate...");
  const [productIndex, rawCategories, exchangeRate] = await Promise.all([
    fetchJson(PRODUCTS_API),
    fetchJson(CATEGORIES_API),
    fetchJson(EXCHANGE_RATE_API),
  ]);
  if (!Array.isArray(productIndex.products) || productIndex.products.length === 0) {
    throw new Error("The active-products API returned no products.");
  }
  console.log(`Active products reported: ${productIndex.total}; received: ${productIndex.products.length}`);

  const detailFailures = [];
  const detailCachePath = path.join(VERIFY_DIR, "product-details.json");
  let rawDetails;
  try {
    const cached = JSON.parse(await fs.readFile(detailCachePath, "utf8"));
    const currentIds = new Set(productIndex.products.map((product) => product.id));
    if (Array.isArray(cached) && cached.length === productIndex.products.length && cached.every((product) => currentIds.has(product.id))) {
      rawDetails = cached;
      console.log(`Product details: reused ${cached.length} cached records`);
    }
  } catch {
    // No valid cache is available yet.
  }
  if (!rawDetails) {
    let detailFinished = 0;
    rawDetails = await mapConcurrent(productIndex.products, 8, async (product) => {
      try {
        const detail = await fetchJson(`${BASE_URL}/api/products/${product.id}?buyerView=1`);
        detailFinished += 1;
        if (detailFinished % 50 === 0 || detailFinished === productIndex.products.length) {
          console.log(`Product details: ${detailFinished}/${productIndex.products.length}`);
        }
        return detail;
      } catch (error) {
        detailFailures.push({ id: product.id, sku: product.sku, error: error.message });
        detailFinished += 1;
        return product;
      }
    });
    await fs.writeFile(detailCachePath, JSON.stringify(rawDetails));
  }

  const products = rawDetails.map(sanitizeProduct);
  const skuCounts = new Map();
  for (const product of products) skuCounts.set(product.sku || "", (skuCounts.get(product.sku || "") || 0) + 1);
  const skuFolderById = new Map(products.map((product) => {
    const base = safeFolderName(product.sku || product.id);
    return [product.id, skuCounts.get(product.sku || "") > 1 ? `${base}__${product.id}` : base];
  }));

  const categoryRows = flattenCategories(rawCategories);
  const imageResults = await downloadImages(products, skuFolderById);

  const downloadedImages = imageResults.filter((item) => item.status === "Downloaded").length;
  const failedImages = imageResults.filter((item) => item.status === "Failed");
  const report = {
    exportedAt: new Date().toISOString(),
    source: BASE_URL,
    activeProductsReported: productIndex.total,
    productsExported: products.length,
    productDetailFailures: detailFailures,
    categoriesExported: categoryRows.length,
    variantsExported: products.reduce((sum, product) => sum + product.variants.length, 0),
    uniqueImagesFound: imageResults.length,
    imagesDownloaded: downloadedImages,
    imageFailures: failedImages.map((item) => ({ sku: item.sku, url: item.url, error: item.error })),
    exchangeRate,
  };

  await fs.writeFile(path.join(OUTPUT_DIR, "products.json"), JSON.stringify({ metadata: report, products }, null, 2));
  await fs.writeFile(path.join(OUTPUT_DIR, "categories.json"), JSON.stringify({ metadata: report, categories: categoryRows }, null, 2));
  await fs.writeFile(path.join(OUTPUT_DIR, "download_report.json"), JSON.stringify(report, null, 2));

  console.log("Building Excel workbooks...");
  const productsResult = await buildProductsWorkbook(products, categoryRows, exchangeRate, imageResults, skuFolderById);
  const categoriesResult = await buildCategoriesWorkbook(categoryRows);
  await verifyAndExportProducts(productsResult.workbook, path.join(OUTPUT_DIR, "products.xlsx"));
  await verifyAndExportCategories(categoriesResult.workbook, path.join(OUTPUT_DIR, "categories.xlsx"));

  console.log(JSON.stringify(report, null, 2));
}

await main();
