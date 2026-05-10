# React + TypeScript + Vite

## 部署到公网（前后端都可用）

### 1. 后端部署（Render）
1. 在 Render 新建 `Blueprint`，选择本仓库（会自动读取 `render.yaml`）。
2. 在 Render 环境变量中填写：
   - `PLATO_BASE_URL=https://api.bltcy.ai/`
   - `PLATO_API_KEY=你的柏拉图密钥`
   - `AUTH_EMAIL_FROM=你的发件邮箱（需在 Resend 验证）`
   - `AUTH_RESEND_API_KEY=你的 Resend API Key`
   - `AUTH_JWT_SECRET=一个足够长的随机密钥`
   - `UPSTASH_REDIS_REST_URL=你的 Upstash REST URL`
   - `UPSTASH_REDIS_REST_TOKEN=你的 Upstash REST Token`
   - （可选兜底）`AUTH_SMTP_HOST/AUTH_SMTP_PORT/AUTH_SMTP_USER/AUTH_SMTP_PASS`
   - （可选本地文件兜底）`APP_DATA_DIR=./api/data`
3. 部署完成后拿到后端 URL，例如 `https://xxx.onrender.com`。
> 若配置了 Upstash Redis，发布/重启后账号与额度数据不会被重置。

### 2. 前端部署（GitHub Pages）
1. 在 GitHub 仓库 `Settings -> Pages` 中选择 `Source: GitHub Actions`。
2. 在 `Settings -> Secrets and variables -> Actions -> Variables` 新建：
   - `VITE_API_BASE_URL=https://你的后端域名`
3. 推送到 `main` 分支后，工作流 `Deploy Frontend To GitHub Pages` 会自动发布前端。

### 3. 访问链接
- 前端 URL：`https://<你的GitHub用户名>.github.io/<仓库名>/#/`
- 后端健康检查：`https://<你的Render域名>/api/health`

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  extends: [
    // other configs...
    // Enable lint rules for React
    reactX.configs['recommended-typescript'],
    // Enable lint rules for React DOM
    reactDom.configs.recommended,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```
