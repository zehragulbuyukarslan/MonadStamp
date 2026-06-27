# GitHub Actions → Vercel secret kurulumu

CI hatasının nedeni: `vercel pull` adımı için **VERCEL_TOKEN** GitHub secret olarak tanımlı değil.

## Gerekli secret (zorunlu)

| Secret | Açıklama |
|--------|----------|
| `VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) → Create Token |

## İsteğe bağlı secret

| Secret | Açıklama |
|--------|----------|
| `VITE_CONTRACT_ADDRESS` | Frontend build sırasında kontrat adresi (boş bırakılırsa runtime'da boş kalır) |

`VERCEL_ORG_ID` ve `VERCEL_PROJECT_ID` artık repoda `.vercel/project.json` içinde; ayrı secret gerekmez.

## GitHub'a ekleme

1. Repo → **Settings** → **Secrets and variables** → **Actions**
2. **New repository secret** → Name: `VERCEL_TOKEN`, Value: oluşturduğunuz token
3. Actions sekmesinden başarısız workflow'u **Re-run all jobs** ile tekrar çalıştırın

## Vercel production ortam değişkenleri

API route'ları (`/api/mint`, `/api/health`) için Vercel dashboard'da şunları ekleyin:

- `RELAYER_PRIVATE_KEY`
- `CONTRACT_ADDRESS` (veya `VITE_CONTRACT_ADDRESS`)

Vercel → Project → Settings → Environment Variables → Production
