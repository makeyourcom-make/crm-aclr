# Déploiement Hetzner Cloud — Guide complet

## Ce que ce guide permet

À la fin de ce guide, ton CRM tourne sur un serveur Hetzner Cloud sécurisé,
accessible via `https://crm.aclr.ch` (ou autre domaine), avec :

- PostgreSQL self-hosted (plus besoin de Neon en prod)
- Backup quotidien automatique
- Tâche CRON nocturne (anniversaires + factures mensuelles + snapshots stats)
- HTTPS Let's Encrypt automatique
- Mise à jour en 1 commande

Coût estimé : **~5 CHF/mois** (Hetzner CX22) + ~2 CHF/mois pour la sauvegarde.

---

## Pré-requis

- Un compte [Hetzner Cloud](https://console.hetzner.cloud) (carte bancaire requise)
- Un nom de domaine que tu contrôles (ex. `aclr.ch`)
- Un terminal local avec `ssh` + `git`
- Le repo Git du CRM accessible (GitHub privé idéal)

---

## Étape 1 — Créer le serveur Hetzner

1. Dans la console Hetzner Cloud, crée un nouveau **projet** "crm-aclr"
2. **Add Server** avec :
   - **Location** : Nuremberg ou Falkenstein (latence Suisse optimale)
   - **Image** : Ubuntu 24.04
   - **Type** : CX22 (2 vCPU, 4 GB RAM, 40 GB SSD — ~5 CHF/mois)
   - **Networking** : IPv4 + IPv6
   - **SSH Keys** : ajoute ta clé publique locale (sinon tu recevras un mdp root par email)
   - **Name** : `crm-aclr-prod`
3. Note l'**IP publique** affichée après création

---

## Étape 2 — Configurer le DNS

Sur ton registrar (Infomaniak, Gandi, Cloudflare…) :

- Crée un enregistrement **A** pour `crm.aclr.ch` → `<IP_HETZNER>`
- Optionnel : enregistrement **AAAA** pour IPv6

Propagation : 1-60 min selon le registrar.

---

## Étape 3 — Sécuriser et préparer le serveur

```bash
ssh root@<IP_HETZNER>

# Mise à jour système
apt update && apt upgrade -y

# Création d'un user dédié (jamais utiliser root pour l'app)
adduser deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh

# Désactive le login root par SSH (sécurité)
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh

# Pare-feu : autorise SSH, HTTP, HTTPS
ufw default deny incoming
ufw allow OpenSSH
ufw allow http
ufw allow https
ufw --force enable

# Installation Docker + Compose
apt install -y docker.io docker-compose-v2 git curl
systemctl enable --now docker
usermod -aG docker deploy
```

Déconnecte-toi et reconnecte-toi en tant que `deploy` :

```bash
exit
ssh deploy@<IP_HETZNER>
```

---

## Étape 4 — Cloner le repo et configurer

```bash
cd ~
git clone https://github.com/<ton-org>/crm-aclr.git
cd crm-aclr

# Copie le template d'env et remplis-le
cp .env.example .env
nano .env
```

Variables critiques à remplir :

```bash
# Postgres
POSTGRES_USER=crm_prod
POSTGRES_PASSWORD=<générer-avec-openssl rand -base64 24>
POSTGRES_DB=crm_aclr

# URLs DB (pointent vers le service docker `postgres`)
DATABASE_URL="postgresql://crm_prod:<password>@postgres:5432/crm_aclr"
DIRECT_URL="postgresql://crm_prod:<password>@postgres:5432/crm_aclr"

# Auth — domaine de prod
AUTH_SECRET="<générer-avec-openssl rand -base64 32>"
AUTH_URL="https://crm.aclr.ch"

# CRON
CRON_SECRET="<générer-avec-openssl rand -hex 32>"

# Timezone
TZ="Europe/Zurich"
```

---

## Étape 5 — Configurer Caddy (reverse proxy HTTPS)

Caddy fait le TLS automatique avec Let's Encrypt.

```bash
# Sur le serveur
sudo nano /etc/caddy/Caddyfile
```

Contenu :

```caddyfile
crm.aclr.ch {
    reverse_proxy localhost:3000
    encode gzip zstd
    log {
        output file /var/log/caddy/crm.log
        format console
    }
}
```

Installation Caddy :

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
sudo systemctl reload caddy
```

Caddy obtient automatiquement un certificat Let's Encrypt dès que le DNS pointe vers le serveur.

---

## Étape 6 — Lancer l'application

```bash
cd ~/crm-aclr
docker compose up -d --build
```

Le build prend 3-5 min la première fois. Vérifie :

```bash
docker compose ps
docker compose logs -f web
```

Tu devrais voir :
```
✓ Ready in XXXms
```

---

## Étape 7 — Initialiser la DB et seeder

```bash
# Applique les migrations
docker compose exec web npx prisma migrate deploy

# Seed (2 users, 12 produits, etc.) — UNIQUEMENT en dev/staging,
# pas en prod où tu créeras tes vraies données :
docker compose exec web npm run db:seed
```

⚠️ Note les mots de passe affichés. Tu peux aussi te connecter directement en
admin et créer/modifier les comptes via `/parametres`.

---

## Étape 8 — Tester

Ouvre `https://crm.aclr.ch/login` dans ton navigateur :

- TLS doit être ✓ (cadenas vert)
- Page Connexion s'affiche
- Login avec les identifiants du seed → arrives sur le Dashboard

---

## Maintenance courante

### Mettre à jour le CRM après un push Git

```bash
cd ~/crm-aclr
git pull
docker compose up -d --build web
docker compose exec web npx prisma migrate deploy
```

### Voir les logs

```bash
docker compose logs -f web         # app
docker compose logs -f cron        # tâches nocturnes
docker compose logs -f backup      # dumps SQL
```

### Restaurer un backup

```bash
# Les dumps sont dans ./backups/ (rotation 30 jours)
ls -lh backups/

# Restauration
docker compose exec -T postgres pg_restore -U $POSTGRES_USER -d $POSTGRES_DB -c < backups/crm_20260601_030000.dump
```

### Stopper et redémarrer

```bash
docker compose down
docker compose up -d
```

---

## Coûts mensuels typiques

| Poste | Coût (CHF) |
|---|---|
| Hetzner CX22 (4 GB RAM, 40 GB SSD) | ~5 |
| Snapshot quotidien Hetzner (optionnel) | ~1 |
| Bande passante (inclus 20 TB) | 0 |
| **Total** | **~6** |

À comparer avec un Neon Pro + Vercel + S3 + Resend qui peut facilement
dépasser 50 CHF/mois pour le même usage.

---

## Troubleshooting

### Caddy n'obtient pas son certificat

```bash
# Vérifie que le DNS pointe bien et que les ports 80+443 sont ouverts
dig +short crm.aclr.ch
nc -zv crm.aclr.ch 443

# Force le renouvellement
sudo systemctl restart caddy
sudo journalctl -u caddy -f
```

### Le service web ne démarre pas

```bash
docker compose logs web | tail -50

# Erreur Prisma typique : DATABASE_URL pas valide
# → vérifie ton .env et relance
```

### Les tâches CRON ne tournent pas

```bash
docker compose logs cron

# Test manuel
curl -X POST -H "x-cron-secret: $CRON_SECRET" \
  http://localhost:3000/api/cron/nightly
```
