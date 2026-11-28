# 新增与编辑商品统一升级

基于 GitHub 默认分支提交 `ece4125b`。开发分支为 `feat/unified-product-editor`。

## 代码变更

| 文件 | 职责 |
| --- | --- |
| `src/pages/admin/products/new.astro`、`src/pages/admin/products/[id]/edit.astro` | 两个路由分别使用创建模式和编辑模式加载共享组件 |
| `src/features/products/ProductEditor.astro`、`src/features/products/ProductForm.astro` | 共享商品资料、富文本、价格、SEO、相册、规格和附加选项 |
| `src/features/products/productEditorClient.ts`、`src/features/products/editorResponse.ts` | 浏览器内暂存待上传图片及排序，提交失败时保留输入并展示原因 |
| `src/features/admin/handleReorder.ts` | 动态追加的图片共用现有拖拽手柄逻辑 |
| `src/pages/api/admin/products.ts`、`src/pages/api/admin/products/[id].ts` | 同步创建和更新商品字段，沿用已有图片、详情、SEO 和规格规则 |
| `src/features/categories/db.ts`、`src/features/categories/productTaxonomy.ts`、`src/features/products/db.ts` | 验证主分类与子分类关系，保存球衣属性，并维持现有商品分类关联 |
| `migrations/0060_product_editor_fields.sql` | 为现有商品表增加分类引用及属性字段 |
| `test/integration/product-seo.mjs` | 验证创建、编辑、前台和失败清理的 D1／R2 回归测试 |

## 数据和保存行为

- `products.catalog_category_id` 指向选定的子分类，或单独选定的一级分类。存在子分类时可通过现有分类表读取其上级。原有多分类关联仍由 `product_categories` 保存。
- `products.team`、`product_type`、`sleeve_type`、`product_tags` 保存商品属性。继续使用 `release_year`。旧商品的新字段初始为空。
- 商品图片和 SEO 复用现有媒体库、商品相册及图片别名表。第一张为主图。点击创建前，文件留在浏览器内。提交后先以下架状态写入商品，再关联分类、图片、规格和选项。关联全部保存后才应用所选的上架状态。落库失败会清理本次新增的数据库记录和无其他引用的新上传对象。
- 一次创建最多 30 张图片。单张上限 5 MB，本次本地上传合计上限 60 MB。
- Canonical 由现有商品网址和站点域名自动生成，表单提供只读显示。现有站点无逐商品 Robots 配置。

## 验证记录

| 项目 | 覆盖内容 |
| --- | --- |
| 新增商品 | Chrome 实际输入富文本、分类、价格、年份、SEO，上传两张图片、交换主图、填写逐图 SEO、选择规格图片和新增附加选项，保存成功后进入编辑页 |
| 保存失败 | Chrome 提交无效图片文件名后保留了已填写内容和已选图片。D1 在写入规格时模拟异常，确认商品、图片别名、媒体记录和 R2 对象已清理 |
| 编辑商品 | Chrome 修改图片 ALT 时保留未保存的商品标题，继续保存后重新读取验证。集成测试修改分类、描述、价格和 SEO，核对未修改的图片关系、标签、规格和附加选项 |
| 前台 | 集成测试读取商品 HTML，核对图片 ALT、详情、批发价格、分类、Canonical、SEO 和询价入口 |
| 手机端 | Chrome 模拟 390px 触屏，在新增页添加两张图片、切换主图并填写 ALT，在编辑页修改 ALT 后查库确认，同时检查富文本初始化和页面宽度 |

等正式发布获确认后，先应用 D1 增量迁移，再发布对应 Worker。若需回滚，回到上一版 Worker 并保留新增的可空列，避免丢失已经保存的商品属性。本阶段仅在本地测试数据库和对象桶运行。
