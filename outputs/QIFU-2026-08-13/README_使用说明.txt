QIFU 商品数据导出
导出日期：2026-08-13（America/Los_Angeles）
来源：https://yiwuqifu.com

一、数据范围
- 在售商品：733 个
- 商品款式：8,919 个
- 分类记录：66 条（包含父分类和子分类）
- 商品图片：7,277 张
- 商品详情失败：0
- 图片下载失败：0

二、文件说明
- products.xlsx
  - Summary：数量、汇率和价格字段说明
  - Products：商品 SKU、名称、材质、MOQ、价格、分类、摊位代码、描述、图片目录等
  - Variants：款式 SKU、款式 MOQ、款式价格等
  - Images：图片网址、本地路径、下载状态和文件大小
- categories.xlsx：分类层级和商品数量
- products.json：完整的结构化商品与款式数据
- categories.json：扁平化分类数据
- images/<SKU>/：按商品 SKU 整理的图片
- download_report.json：本次下载与失败统计

三、价格字段
- Base Price CNY：接口返回的供应商基础人民币价格。
- Buyer Tier Price CNY：买家等级调整后的人民币价格。网站接口原字段名是 salePriceUsd，
  但商城前端会先把该值当作人民币，再按汇率换算成美元，因此导出表按实际含义标为 CNY。
- Display Price USD：products.xlsx 中的公式列，使用导出时汇率 1 USD = 6.757039 CNY 计算。
- USD Price Override：款式明确设置的美元覆盖价；等级价为空时使用。
- Show Price = No：商城前台不一定展示价格，但导出仍保留接口返回的原始价格字段。

四、MOQ
- Products 表的 MOQ 是商品级 MOQ。
- Variants 表的 MOQ 是款式级 MOQ；它可能与商品级 MOQ 不同，下单时应优先核对具体款式。

五、注意
- 这是 2026-08-13 的数据快照，网站之后新增或修改的商品不会自动出现在本次文件中。
- Excel 中的 SKU、商品 ID 和款式 SKU 按文本保存，避免长编号被自动改写。
