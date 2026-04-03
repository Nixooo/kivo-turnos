# DETAIM — Gestión de Turnos y Filas

![DETAIM](https://raw.githubusercontent.com/username/repo/main/frontend/public/kivo-logo.png)

Plataforma profesional de gestión de turnos y filas optimizada para empresas en Colombia. Permite la personalización total de marca blanca, brindando a cada cliente una experiencia única con su propio logo y colores corporativos.

## 🚀 Características Principales

- **Marca Blanca (White Label):** Personalización dinámica por empresa vía URL (logo, colores HEX).
- **Multi-Sector:** Configuración específica para EPS, Bancos, Clínicas, Notarías y Gimnasios.
- **Turnos Híbridos:** Permite a los usuarios pedir turnos desde casa con validación por geocerca (GPS).
- **Panel Supremo:** Control total de empresas, sedes y usuarios desde una interfaz centralizada.
- **Panel Administrativo:** Estadísticas en tiempo real, gestión de preguntas personalizadas y previsualización de interfaz.
- **Interfaz Responsiva:** Optimizado para computadoras, tablets y dispositivos móviles.

## 🛠️ Tecnologías

- **Frontend:** React 19, Vite, Tailwind CSS 4, React Router 7.
- **Backend:** Node.js, Express.
- **Base de Datos:** PostgreSQL.
- **Despliegue:** Preparado para Render.com (Blueprint incluido).

## 📦 Instalación y Desarrollo Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/tu-usuario/detaim-turnos.git
   cd detaim-turnos
   ```

2. **Instalar dependencias:**
   ```bash
   npm run install-all
   ```

3. **Configurar variables de entorno:**
   Crea un archivo `.env` en la carpeta `server/` basado en `.env.example`.

4. **Iniciar en modo desarrollo:**
   - Servidor: `cd server && npm run dev`
   - Frontend: `cd frontend && npm run dev`

## ☁️ Despliegue en Render.com

Este proyecto incluye un archivo `render.yaml` para despliegue automático. 
1. Conecta tu repositorio de GitHub a Render.
2. Selecciona **Blueprint** y elige este repositorio.
3. Render configurará automáticamente la base de datos y el servicio web.

---
© 2026 DETAIM Colombia. Todos los derechos reservados.
[detaim.com](https://detaim.com)
