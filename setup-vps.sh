#!/bin/bash
# =============================================================================
# TeamMail VPS Setup Script
# Führe dieses Script einmalig auf deinem VPS aus, um alles einzurichten.
# Voraussetzungen: Ubuntu/Debian Server, Port 80 & 443 offen
# =============================================================================

set -e

DOMAIN="mail.tim-regener.com"
EMAIL="tim.regener@icloud.com"  # Für Let's Encrypt Benachrichtigungen

echo "🚀 TeamMail VPS Setup starting..."

# 1. Docker & Docker Compose installieren (falls nicht vorhanden)
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
fi

# 2. Nginx & Certbot installieren (für SSL)
echo "🔒 Installing Nginx & Certbot..."
sudo apt-get update -qq
sudo apt-get install -y nginx certbot python3-certbot-nginx

# 3. Nginx Konfiguration für die Domain schreiben
echo "🌐 Configuring Nginx reverse proxy..."
sudo tee /etc/nginx/sites-available/teammail > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect HTTP -> HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Sicherheits-Header
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Frontend (Expo Web App) - Port 3000
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Backend API - Port 3001
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# 4. Nginx Konfiguration aktivieren
sudo ln -sf /etc/nginx/sites-available/teammail /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# 5. SSL Zertifikat mit Let's Encrypt holen (kostenlos!)
echo "🔐 Obtaining SSL certificate for $DOMAIN..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $EMAIL

# 6. Certbot Auto-Renewal einrichten (Zertifikat läuft alle 90 Tage ab)
echo "🔄 Setting up auto-renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

echo ""
echo "✅ Setup complete!"
echo ""
echo "Nächste Schritte:"
echo "1. Kopiere dein Projekt auf den Server: git clone DEIN_REPO_URL /opt/teammail"
echo "2. cd /opt/teammail"
echo "3. cp .env.example .env && nano .env   (Werte eintragen!)"
echo "4. docker compose up -d --build"
echo ""
echo "🌐 Deine App ist dann unter https://$DOMAIN erreichbar!"
