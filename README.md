# İş Takip

## Jira Cloud entegrasyonu

Jira issue oluşturma ve webhook işlemleri, API token tarayıcıya açılmasın diye
`server/` altındaki Node API üzerinden çalışır.

1. `.env` içindeki Jira değerlerini doldurun. Production ortamında Supabase
   güncellemeleri için `SUPABASE_SERVICE_ROLE_KEY` kullanılması önerilir.
2. API ve arayüzü birlikte başlatın:

   ```bash
   npm run dev:all
   ```

   Ayrı çalıştırmak gerekirse:

   ```bash
   npm run dev:api
   npm run dev
   ```

3. Jira Cloud webhook URL'sini production API adresinizde
   `POST /jira/webhook` olarak tanımlayın, `issue_updated` olayını seçin ve aynı
   `JIRA_WEBHOOK_SECRET` değerini Jira webhook secret alanına girin.

Ticket eklerken veya ticket detayındaki düzenleme ekranında mevcut Jira issue
key'i (`PROJ-123`) girilerek ilişki kurulur. Ticket detay ekranı açıldığında
Jira'nın güncel durumu, özeti ve sorumlusu API üzerinden okunur. `Jira'da Aç`
bağlantısı doğrudan ilgili Jira taskına gider. Webhook geldiğinde kayıt issue
key üzerinden bulunur ve `jiraStatus` alanı güncellenir.

## Komutlar

```bash
npm run lint
npm test
npm run build
```

## Canlı ortam

Repo kökündeki `render.yaml`, frontend ve API'yi tek Render web service olarak
yayınlar. Jira bilgileri daha sonra Render Environment ekranından eklenebilir.
`JIRA_WEBHOOK_SECRET` deployment sırasında otomatik üretilir.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
