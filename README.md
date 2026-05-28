# CRM ACLR Sàrl — Make Your Com

CRM commercial interne pour **ACLR Sàrl** (marque commerciale **Make Your Com**),
agence de communication digitale en Suisse romande.

Utilisateurs cibles :

- **Sophie Salvan** — commerciale terrain
- **Arthur Chazelle** — fondateur, admin

> Pour la spec complète, voir [`docs/Prompt_Claude_Code_CRM_MYC.md`](docs/Prompt_Claude_Code_CRM_MYC.md).

---

## Stack technique

- **Framework** : Next.js 16 (App Router) + TypeScript strict
- **UI** : Tailwind CSS v4 + shadcn/ui
- **Base de données** : PostgreSQL 16 — Neon en dev, self-hosted Hetzner en prod
- **ORM** : Prisma 6
- **Auth** : NextAuth.js (Auth.js v5)
- **Validation** : Zod
- **Forms** : React Hook Form
- **Tableaux** : TanStack Table v8
- **Graphiques** : Recharts
- **Dates** : date-fns + locale `fr`
- **PDF** : `@react-pdf/renderer`
- **Email** : Resend (sortants + webhooks inbound)
- **Déploiement** : Docker Compose sur Hetzner Cloud CX22+

Langue UI : **français suisse uniquement**. Devise : **CHF** (apostrophe milliers).

---

## Installation locale

### Pré-requis

- **Node.js 22+** (testé sur Node 24)
- **npm 10+**
- Un projet **Neon Postgres** (free tier suffisant) — [console.neon.tech](https://console.neon.tech)

### Installation en 4 étapes

```bash
# 1. Entrer dans le dossier
cd CRM

# 2. Installer les dépendances
npm install

# 3. Copier le template d'environnement et renseigner DATABASE_URL + AUTH_SECRET
cp .env.example .env.local
# Éditer .env.local — coller l'URL Neon et générer AUTH_SECRET :
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 4. Appliquer les migrations Prisma + seed des données fictives
npm run prisma:migrate
npm run db:seed

# Lancer le serveur de dev
npm run dev
```

L'application est accessible sur [http://localhost:3000](http://localhost:3000).

### Identifiants de démarrage (seed)

- **Sophie** : `sophie@aclr.ch` / `(affiché à la fin du seed)`
- **Arthur** : `arthur@aclr.ch` / `(affiché à la fin du seed)`

---

## Commandes utiles

| Commande                 | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `npm run dev`            | Serveur Next.js en mode dev (hot reload)            |
| `npm run build`          | Build de production                                 |
| `npm start`              | Sert le build de production                         |
| `npm run lint`           | Lint ESLint                                         |
| `npm run prisma:studio`  | Explorateur visuel de la BDD (`localhost:5555`)     |
| `npm run prisma:migrate` | Crée et applique une nouvelle migration             |
| `npm run prisma:deploy`  | Applique les migrations existantes (prod)           |
| `npm run db:seed`        | Réinjecte les données fictives                      |

---

## Déploiement Hetzner Cloud

Le guide complet sera ajouté à l'étape 29 (`docs/DEPLOIEMENT_HETZNER.md`).

Résumé en 5 étapes :

1. **Créer un serveur Hetzner Cloud CX22** (~CHF 5/mois) sous Ubuntu 24.04 LTS
2. **Installer Docker** + activer le pare-feu Hetzner (ports 22, 80, 443 uniquement)
3. **Cloner le repo + copier `.env.example` → `.env`** et remplir tous les secrets
4. **Lancer** `docker compose up -d` (postgres + web + backup quotidien)
5. **Pointer un domaine + Caddy/Traefik en façade** pour le TLS

---

## Structure du projet

```
CRM/
├── app/                     # Routes App Router (pages, layouts, API)
├── components/              # Composants React partagés
├── lib/                     # Helpers transverses
│   ├── db.ts                # Singleton Prisma Client
│   ├── format.ts            # Formatage CHF + dates fr suisses
│   └── constants.ts         # Constantes métier (taux commission, etc.)
├── prisma/
│   ├── schema.prisma        # Modèle de données
│   ├── migrations/          # Historique des migrations (généré)
│   └── seed.ts              # Script d'amorçage (à venir étape 2)
├── public/                  # Assets statiques
├── docs/                    # Spec, guide de déploiement
├── docker-compose.yml       # Orchestration prod Hetzner
├── Dockerfile               # Image web prod multi-stage
├── .env.example             # Template variables d'env
└── README.md
```

---

## État d'avancement

Le CRM est construit en **30 étapes** suivant l'ordre du prompt initial.

- [x] **Étape 1** — Scaffolding Next.js + Prisma + Postgres + Docker Compose
- [ ] **Étape 2** — Schéma Prisma complet + migration + seed (2 users, 12 produits, 10 prospects)
- [ ] **Étape 3** — Auth NextAuth + middleware
- [ ] **Étape 4** — Layout principal (sidebar + topbar)
- [ ] **Étape 5** — Module Prospects (liste + détail + import CSV)
- [ ] _… 25 étapes restantes_

---

## Convention de format suisse

Tout est formaté avec les helpers de [`lib/format.ts`](lib/format.ts) :

| Donnée            | Format             | Exemple              |
| ----------------- | ------------------ | -------------------- |
| Montant CHF       | `CHF X'XXX.XX`     | `CHF 2'500.00`       |
| Date longue       | `JJ mois AAAA`     | `28 mai 2026`        |
| Date courte       | `JJ/MM/AAAA`       | `28/05/2026`         |
| Date + heure      | `JJ/MM/AAAA HH:MM` | `28/05/2026 14:30`   |
| Téléphone CH      | `+41 XX XXX XX XX` | `+41 79 123 45 67`   |
| Durée d'appel     | `M:SS` ou `H:MM:SS`| `2:05` / `1:02:05`   |
