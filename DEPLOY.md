# Déploiement Vercel — CRM ACLR

Guide pas-à-pas pour mettre le CRM en ligne sur **https://crm.makeyourcom.ch**.

---

## 🎯 Architecture cible

| Composant | Service |
|---|---|
| **Hébergement Next.js** | Vercel (gratuit, plan Hobby) |
| **Base de données** | Neon PostgreSQL (déjà en place) |
| **Stockage fichiers** | Vercel Blob (gratuit jusqu'à 1 GB) |
| **Authentification** | NextAuth v5 (existant) |
| **Domaine** | `crm.makeyourcom.ch` (CNAME → Vercel) |

---

## ✅ Préparation côté code (déjà fait)

- [x] Abstraction `lib/file-storage.ts` (local vs Vercel Blob)
- [x] Actions serveur migrées (charges, RH, contrats signés)
- [x] `@vercel/blob` installé
- [x] `postinstall` ajouté dans `package.json` (génère Prisma au build Vercel)
- [x] `.gitignore` exclut bien `/public/expenses`, `/public/rh`, `/public/signed-contracts`, `.env`
- [x] `.env.example` mis à jour avec `STORAGE_MODE` + `BLOB_READ_WRITE_TOKEN`
- [x] Script `scripts/migrate-files-to-blob.ts` prêt pour migrer les fichiers existants

---

## 🚀 Étapes pour déployer

### 1. Pousser le code sur GitHub

```bash
# Depuis le dossier CRM/
cd "C:/Users/Admin/Desktop/HOME/10. M A K E/04. Make Your Com/CRM"

# Vérifier .gitignore et créer un commit
git add .
git commit -m "feat: déploiement Vercel — abstraction file storage + récurrences + rentabilité"

# Créer un nouveau repo privé sur GitHub :
# → https://github.com/new
# → Nom : crm-aclr (ou autre)
# → Privé
# → NE PAS initialiser avec README

# Connecter et push
git remote add origin https://github.com/<TON-USER>/crm-aclr.git
git branch -M main
git push -u origin main
```

### 2. Créer le projet Vercel

1. Va sur **https://vercel.com/new**
2. **Import Git Repository** → sélectionne `crm-aclr`
3. Vercel détecte automatiquement Next.js. **Ne touche pas aux Build & Output Settings.**
4. **N'IMPORTE PAS encore** — d'abord configure les variables d'env :

#### Environment Variables à ajouter

| Nom | Valeur | Notes |
|---|---|---|
| `DATABASE_URL` | (copier du `.env` local) | Connexion poolée Neon |
| `DIRECT_URL` | (copier du `.env` local) | Connexion directe Neon (pour migrations) |
| `AUTH_SECRET` | (copier du `.env` local) | Idem que dev pour ne pas invalider les sessions |
| `AUTH_URL` | `https://crm.makeyourcom.ch` | URL prod canonique |
| `AUTH_TRUST_HOST` | `true` | |
| `STORAGE_MODE` | `blob` | Active Vercel Blob |
| `EMAIL_MODE` | `dry-run` | À passer en `"live"` quand Resend sera configuré |
| `RESEND_FROM_EMAIL` | `prospects@aclr.ch` | |
| `ANTHROPIC_API_KEY` | (laisser vide pour l'instant) | OCR optionnel |
| `TZ` | `Europe/Zurich` | |
| `NODE_ENV` | `production` | Auto-défini par Vercel |

5. Clique **Deploy** → ~3 minutes → 🎉 premier déploiement actif sur `aclr-crm.vercel.app`

### 3. Créer le Blob Store

1. Sur le dashboard Vercel → projet `crm-aclr` → onglet **Storage**
2. **Create Database** → **Blob** → nom : `crm-files`
3. **Connect to Project** → coche `crm-aclr` → **production** + **preview** + **development**
4. Vercel ajoute automatiquement `BLOB_READ_WRITE_TOKEN` dans les env vars
5. **Re-deploy** le projet (Deployments → ... → Redeploy)

### 4. Migrer les fichiers existants vers Blob

Récupère le `BLOB_READ_WRITE_TOKEN` depuis Vercel (Settings → Environment Variables) et lance LOCALEMENT :

```bash
# Variables temporaires pour ce run
$env:STORAGE_MODE = "blob"
$env:BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_xxx..."

npx tsx scripts/migrate-files-to-blob.ts
```

Le script upload tous les fichiers `/public/expenses/`, `/public/rh/`, `/public/signed-contracts/` vers Vercel Blob, et met à jour les URLs en DB. Idempotent (peut être relancé sans risque).

### 5. Configurer le domaine `crm.makeyourcom.ch`

#### Sur Vercel

1. Projet → **Settings** → **Domains**
2. Ajouter `crm.makeyourcom.ch`
3. Vercel donne 1 enregistrement CNAME à créer

#### Sur ton registrar de `makeyourcom.ch`

Crée un enregistrement DNS :

```
Type    : CNAME
Nom     : crm
Valeur  : cname.vercel-dns.com.
TTL     : 3600 (ou auto)
```

⏱️ Propagation DNS : 2 min à 1h selon le registrar.

Vercel vérifie automatiquement et active le HTTPS (Let's Encrypt). Tu verras un ✅ vert dans Vercel quand c'est OK.

### 6. Tester

- 🔓 Ouvre **https://crm.makeyourcom.ch** → page de login NextAuth
- 🔐 Connecte-toi avec ton compte admin (les credentials sont en DB, identiques au dev)
- 📊 Tout doit fonctionner exactement comme en local

---

## 🔧 Maintenance

### Mises à jour du code

1. `git add .` + `git commit` + `git push` sur la branche `main`
2. Vercel déploie automatiquement (~2-3 min)
3. URL de preview pour chaque branche/PR

### Migrations Prisma

Vercel exécute `npm install` → `postinstall: prisma generate` automatiquement.
Pour pousser un nouveau schéma à la DB de prod :

```bash
# Localement, après avoir mis à jour prisma/schema.prisma
npm run prisma:deploy   # = prisma migrate deploy
```

(ou bien `npx prisma db push` si tu utilises ce flow)

### Backup DB

Neon fait des backups automatiques (Point-in-Time Recovery 7 jours sur le plan Free).
Pour un backup manuel ponctuel :

```bash
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d).sql
```

---

## 💸 Coûts mensuels estimés

| Service | Free tier | Estimation usage CRM |
|---|---|---|
| Vercel Hobby | ✓ Gratuit | Suffisant (1 utilisateur, ~1k requêtes/jour) |
| Vercel Blob | 1 GB storage gratuit | Tu utilises ~50 MB → OK |
| Neon | 0.5 GB storage gratuit | Tu utilises ~20 MB → OK |
| Domaine | Déjà acheté | — |

**Total : 0 €/mois** tant que tu restes sur les free tiers. Aux alentours de 200-500 utilisateurs ou 5 GB de fichiers, il faudra passer à Vercel Pro ($20/mois).

---

## 🆘 Troubleshooting

### « Build failed » sur Vercel
- Vérifie que **toutes** les env vars sont définies (surtout `DATABASE_URL`)
- Regarde les logs Build sur Vercel
- En cas de souci Prisma : assure-toi que `binaryTargets` dans schema.prisma contient `"linux-musl-openssl-3.0.x"` (déjà en place ✓)

### Sessions NextAuth invalides
- Vérifie que `AUTH_URL` correspond exactement à l'URL utilisée
- `AUTH_TRUST_HOST=true` est obligatoire en prod
- `AUTH_SECRET` doit être strictement identique entre dev et prod si tu veux que les sessions existantes restent valides

### Fichiers 404 après déploiement
- Vérifie que tu as bien lancé `migrate-files-to-blob.ts`
- Que `STORAGE_MODE=blob` est dans les env vars Vercel
- Que `BLOB_READ_WRITE_TOKEN` est bien injecté (Vercel le fait automatiquement quand le store est lié)
