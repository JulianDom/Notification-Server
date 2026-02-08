# Notifications Server

Servidor centralizado de notificaciones push con Firebase Cloud Messaging.

## Requisitos del Sistema

- **CPU:** 4 cores
- **RAM:** 4 GB mínimo
- **Disco:** 40 GB SSD
- **OS:** Ubuntu 22.04+ / CentOS 8+
- **Node.js:** 20.x o superior
- **PostgreSQL:** 14.x o superior

## Instalación Local

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd notifications-server
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
PORT=3010
NODE_ENV=development

DATABASE_URL="postgresql://user:password@localhost:5432/notifications_db?schema=public"

JWT_SECRET=tu-secreto-jwt-muy-seguro
JWT_ACCESS_EXPIRATION=45m
JWT_REFRESH_EXPIRATION=7d

ADMIN_EMAIL=admin@tudominio.com
ADMIN_USERNAME=admin@tudominio.com
ADMIN_PASSWORD=tu-password-seguro
```

### 4. Crear la base de datos

```bash
# En PostgreSQL
createdb notifications_db
```

### 5. Ejecutar migraciones y seed

```bash
npm run prisma:migrate
npm run prisma:seed
```

### 6. Iniciar el servidor

```bash
# Desarrollo
npm run start:dev

# Producción
npm run build
npm run start:prod
```

## Despliegue en Servidor Ubuntu

### 1. Preparar el servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar PM2 globalmente
sudo npm install -g pm2
```

### 2. Crear base de datos en PostgreSQL

```bash
sudo -u postgres psql

CREATE DATABASE notifications_db;
CREATE USER notifications_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE notifications_db TO notifications_user;
\q
```

### 3. Desplegar la aplicación

```bash
# Clonar en /var/www
cd /var/www
git clone <repository-url> notifications-server
cd notifications-server

# Instalar dependencias
npm install --production

# Configurar .env
cp .env.example .env
nano .env
```

Configurar `.env` para producción:

```env
PORT=3010
NODE_ENV=production

DATABASE_URL="postgresql://notifications_user:tu_password_seguro@localhost:5432/notifications_db?schema=public"

JWT_SECRET=genera-un-secreto-muy-largo-y-seguro-aqui
JWT_ACCESS_EXPIRATION=45m
JWT_REFRESH_EXPIRATION=7d

ADMIN_EMAIL=admin@tudominio.com
ADMIN_USERNAME=admin@tudominio.com
ADMIN_PASSWORD=password-seguro-para-admin
```

### 4. Ejecutar migraciones y seed

```bash
npm run prisma:migrate:prod
npm run prisma:seed
```

### 5. Compilar y ejecutar con PM2

```bash
npm run build

pm2 start dist/main.js --name notifications-server
pm2 save
pm2 startup
```

### 6. Configurar Nginx (Reverse Proxy)

```bash
sudo nano /etc/nginx/sites-available/notifications.tudominio.com
```

```nginx
server {
    listen 80;
    server_name notifications.tudominio.com;

    location / {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/notifications.tudominio.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Configurar SSL con Certbot

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d notifications.tudominio.com
```

## API Endpoints

### Autenticación de Administradores

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/administrators/login` | Login de administrador |
| POST | `/api/refreshToken` | Refrescar token de acceso |
| PUT | `/api/v1/administrators/:id` | Actualizar administrador |
| PUT | `/api/v1/administrators/:id/changePassword` | Cambiar contraseña |

### Gestión de Aplicaciones (requiere token admin)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/apps` | Crear aplicación |
| GET | `/api/v1/apps` | Listar aplicaciones |
| GET | `/api/v1/apps/:id` | Obtener aplicación |
| PUT | `/api/v1/apps/:id` | Actualizar aplicación |
| DELETE | `/api/v1/apps/:id` | Eliminar aplicación |

### Gestión de Usuarios (requiere firma HMAC)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/v1/users/ensure` | Habilitar usuario |
| POST | `/api/v1/users/unEnsure` | Deshabilitar usuario |

### Notificaciones

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/v1/notifications` | HMAC | Enviar notificación |
| POST | `/api/v1/notifications/admin` | Token | Enviar como admin |

## Integración desde tu aplicación

### Ejemplo en Node.js

```javascript
const crypto = require('crypto');
const axios = require('axios');

const API_URL = 'https://notifications.tudominio.com';
const API_KEY = 'nk_tu_api_key';
const API_SECRET = 'tu_api_secret';

async function sendRequest(method, endpoint, body = {}) {
  const timestamp = `${Date.now()}`;
  const signaturePayload = `/api${endpoint}${timestamp}${JSON.stringify(body)}`;
  const signature = crypto
    .createHmac('sha384', API_SECRET)
    .update(signaturePayload)
    .digest('hex');

  const headers = {
    'Content-Type': 'application/json',
    'x-timestamp': timestamp,
    'x-api-key': API_KEY,
    'x-signature': signature,
  };

  const response = await axios({
    method,
    url: `${API_URL}/api${endpoint}`,
    headers,
    data: body,
  });

  return response.data;
}

// Habilitar usuario
await sendRequest('post', '/v1/users/ensure', {
  reference: 'user-123',
  osType: 'android',
  token: 'firebase-device-token',
});

// Enviar notificación
await sendRequest('post', '/v1/notifications', {
  type: 'send',
  references: 'user-123',
  firebaseData: {
    notification: {
      title: 'Hola!',
      body: 'Tienes un nuevo mensaje',
    },
    data: {
      orderId: '12345',
    },
  },
});
```

## Documentación Swagger

En desarrollo, accede a `/docs` para ver la documentación interactiva de la API.

## Credenciales por defecto

```
Email: info@cervak.com
Username: info@cervak.com
Password: cervak
```

**IMPORTANTE:** Cambia estas credenciales en producción.

## Comandos útiles

```bash
# Ver logs
pm2 logs notifications-server

# Reiniciar
pm2 restart notifications-server

# Ver estado
pm2 status

# Ver métricas
pm2 monit
```
